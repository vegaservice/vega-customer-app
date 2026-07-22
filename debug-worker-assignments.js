// Diagnostic: Find open bookings + who they're assigned to + check if worker exists.
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  console.log('======================================================');
  console.log('  BOOKINGS DIAGNOSTIC');
  console.log('======================================================\n');

  // 1. Get all bookings
  const bookings = await db.collection('bookings').get();
  console.log(`Total bookings in Firestore: ${bookings.size}\n`);

  // Group by status
  const byStatus = {};
  const allAssignedWorkers = new Set();
  bookings.forEach(doc => {
    const d = doc.data();
    const s = d.status || 'unknown';
    if (!byStatus[s]) byStatus[s] = [];
    byStatus[s].push({ id: doc.id, ...d });

    // Find assigned worker references (multiple possible field paths)
    const workerRef =
      d.assignedTo?.phone || d.assignedTo?.id || d.assignedTo?.name ||
      d.assignedWorker?.phone || d.assignedWorker?.id || d.assignedWorker?.name ||
      d.workerPhone || d.workerId || d.workerName ||
      d.professionalId || d.professionalPhone ||
      null;
    if (workerRef) allAssignedWorkers.add(JSON.stringify({ ref: workerRef, in: doc.id }));
  });

  console.log('Bookings by status:');
  for (const [s, list] of Object.entries(byStatus)) {
    console.log(`  ${s}: ${list.length}`);
  }

  // 2. List all OPEN bookings (any non-completed status) with their worker info
  console.log('\n------------------------------------------------------');
  console.log('  OPEN / ACTIVE BOOKINGS');
  console.log('------------------------------------------------------\n');
  const openStatuses = ['pending', 'confirmed', 'assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'new'];
  let openCount = 0;
  bookings.forEach(doc => {
    const d = doc.data();
    if (!openStatuses.includes(d.status)) return;
    openCount++;
    console.log(`\nBooking ${doc.id}:`);
    console.log(`  status:           ${d.status}`);
    console.log(`  service:          ${d.service || d.serviceName || '?'}`);
    console.log(`  customerPhone:    ${d.customerPhone || d.userPhone || d.userId || '?'}`);
    console.log(`  customerName:     ${d.customerName || d.userName || '?'}`);
    console.log(`  assignedTo:       ${JSON.stringify(d.assignedTo || null)}`);
    console.log(`  assignedWorker:   ${JSON.stringify(d.assignedWorker || null)}`);
    console.log(`  workerPhone:      ${d.workerPhone || '(not set)'}`);
    console.log(`  workerId:         ${d.workerId || '(not set)'}`);
    console.log(`  workerName:       ${d.workerName || '(not set)'}`);
    console.log(`  professionalId:   ${d.professionalId || '(not set)'}`);
    console.log(`  createdAt:        ${d.createdAt?.toDate?.()?.toISOString() || '?'}`);
  });

  if (openCount === 0) {
    console.log('No open bookings found.\n');
  }

  // 3. Cross-check: for each assigned worker reference, does the worker exist?
  console.log('\n------------------------------------------------------');
  console.log('  WORKER REFERENCE CHECK');
  console.log('------------------------------------------------------\n');
  const remainingWorkers = await db.collection('workers').get();
  const remainingProfs = await db.collection('professionals').get();
  const workerKeys = new Set();
  remainingWorkers.forEach(d => {
    workerKeys.add(d.id);
    if (d.data().phone) workerKeys.add(d.data().phone);
    if (d.data().name) workerKeys.add(d.data().name);
  });
  remainingProfs.forEach(d => {
    workerKeys.add(d.id);
    if (d.data().phone) workerKeys.add(d.data().phone);
    if (d.data().name) workerKeys.add(d.data().name);
  });
  console.log('Existing worker identifiers (id/phone/name):');
  workerKeys.forEach(k => console.log(`  - ${k}`));

  console.log('\nAssigned-worker references in bookings:');
  if (allAssignedWorkers.size === 0) {
    console.log('  (none)');
  } else {
    allAssignedWorkers.forEach(entry => {
      const { ref, in: bookingId } = JSON.parse(entry);
      const found = workerKeys.has(ref) || workerKeys.has(`worker_${ref}`);
      console.log(`  - "${ref}"  in booking ${bookingId}  ${found ? 'EXISTS in workers/' : 'MISSING — ORPHAN'}`);
    });
  }

  // 4. SEARCH: any document anywhere referencing 'Mahes' or 'Mahesh'?
  console.log('\n------------------------------------------------------');
  console.log('  SEARCH FOR "Mahes" / "Mahesh" IN BOOKINGS');
  console.log('------------------------------------------------------\n');
  let matched = 0;
  bookings.forEach(doc => {
    const json = JSON.stringify(doc.data()).toLowerCase();
    if (json.includes('mahes')) {
      matched++;
      console.log(`\nMATCH in booking ${doc.id}:`);
      console.log(JSON.stringify(doc.data(), null, 2).split('\n').slice(0, 30).join('\n'));
    }
  });
  if (matched === 0) console.log('No bookings reference "Mahes" or "Mahesh".');

  process.exit(0);
})().catch(err => { console.error(err); process.exit(1); });
