// ████ MIGRATION: normalize statuses + fix worker schema ████
// 1. Lowercase-normalize every booking.status to canonical form
// 2. Fix worker docs so auto-assign can find them (currentStatus + area)
// 3. Reset test worker to available + cancel 3 stale test bookings
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CANON_STATUS = {
  pending:'pending', confirmed:'confirmed', assigned:'assigned',
  ontheway:'on_the_way', on_the_way:'on_the_way', onway:'on_the_way',
  inprogress:'in_progress', in_progress:'in_progress', started:'in_progress', ongoing:'in_progress',
  completed:'completed', complete:'completed', done:'completed', finished:'completed',
  cancelled:'cancelled', canceled:'cancelled',
  rejected:'rejected', declined:'rejected', rescheduled:'rescheduled',
};
function normStatus(s){
  if(!s) return s;
  const key=String(s).trim().toLowerCase().replace(/[\s-]+/g,'_');
  return CANON_STATUS[key] || CANON_STATUS[key.replace(/_/g,'')] || key;
}

const STALE_TEST_BOOKINGS = ['VG290120','VG352731','VG354964'];
const TEST_WORKER_ID = 'worker_7207719922';

(async () => {
  console.log('=== 1. NORMALIZING BOOKING STATUSES ===\n');
  const bookings = await db.collection('bookings').get();
  let changed = 0, batch = db.batch(), batchCount = 0;
  for (const doc of bookings.docs) {
    const cur = doc.data().status;
    const norm = normStatus(cur);
    if (cur !== norm) {
      batch.update(doc.ref, { status: norm });
      console.log(`  ${doc.id}: "${cur}" -> "${norm}"`);
      changed++; batchCount++;
      if (batchCount >= 400) { await batch.commit(); batch = db.batch(); batchCount = 0; }
    }
  }
  if (batchCount > 0) await batch.commit();
  console.log(`\n  Normalized ${changed} booking statuses.\n`);

  console.log('=== 2. FIXING WORKER SCHEMA (currentStatus + area) ===\n');
  const workers = await db.collection('workers').get();
  for (const doc of workers.docs) {
    const w = doc.data();
    const role = (w.role || 'worker').toLowerCase();
    if (role === 'hub_manager' || role === 'admin') {
      console.log(`  skip ${doc.id} (${role})`);
      continue;
    }
    // Set currentStatus from isAvailable; set area from currentArea/assignedAreas
    const currentStatus = w.isAvailable === false ? 'on_job' : 'available';
    const area = w.area || w.currentArea || (w.assignedAreas && w.assignedAreas[0]) || 'Madhurawada';
    await doc.ref.update({
      currentStatus,
      area,
      isActive: w.isActive !== false,
      status: (w.status || 'active'),
    });
    console.log(`  ${doc.id}: currentStatus=${currentStatus}, area=${area}`);
  }
  console.log();

  console.log('=== 3. RESET TEST WORKER + CANCEL STALE TEST BOOKINGS ===\n');
  // Cancel the 3 stale "Mahes" test bookings so the guided run is clean
  for (const oid of STALE_TEST_BOOKINGS) {
    try {
      await db.collection('bookings').doc(oid).update({
        status: 'cancelled',
        cancelledReason: 'Cleared for clean end-to-end test',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  Cancelled ${oid}`);
    } catch (e) { console.log(`  ${oid} not found`); }
  }
  // Reset test worker to fully available
  await db.collection('workers').doc(TEST_WORKER_ID).update({
    currentStatus: 'available',
    isAvailable: true,
    isActive: true,
    status: 'active',
    currentJobId: null,
    currentBookingId: null,
    area: 'Madhurawada',
    currentArea: 'Madhurawada',
    assignedAreas: ['Madhurawada','Yendada','PM Palem'],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('professionals').doc(TEST_WORKER_ID).set({
    currentStatus: 'available', isAvailable: true, currentJobId: null, currentBookingId: null,
  }, { merge: true });
  console.log(`  Reset ${TEST_WORKER_ID} -> available, area=Madhurawada\n`);

  console.log('=== VERIFY ===\n');
  const tw = await db.collection('workers').doc(TEST_WORKER_ID).get();
  const d = tw.data();
  console.log(`  Test worker: currentStatus=${d.currentStatus}, isAvailable=${d.isAvailable}, currentJobId=${d.currentJobId}, area=${d.area}, fcmToken=${d.fcmToken ? 'SET' : 'none (will set on worker login)'}`);

  console.log('\nDONE. Backend ready for clean end-to-end auto-assign test.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
