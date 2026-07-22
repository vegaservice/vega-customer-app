// Fix orphan bookings: reassign or cancel.
//   - 3 "Mahes" bookings → reassign to worker_7207719922 (real test worker)
//   - 31 other orphan bookings (Vijaya/Kavitha/etc. — deleted workers) → cancel
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const REAL_WORKER = {
  id:    'worker_7207719922',
  name:  'VEGA Test Worker',
  phone: '7207719922',
  rating: 5.0,
};

(async () => {
  console.log('Fetching all bookings...');
  const snap = await db.collection('bookings').get();
  const openStatuses = ['pending','confirmed','Confirmed','assigned','Assigned','accepted','on_the_way','OnTheWay','arrived','in_progress','Started','new'];

  let reassigned = 0, cancelled = 0, untouched = 0;
  const batch = db.batch();
  let batchCount = 0;
  const COMMIT_EVERY = 400;

  async function flush() {
    if (batchCount === 0) return;
    await batch.commit();
    batchCount = 0;
  }

  for (const doc of snap.docs) {
    const d = doc.data();
    if (!openStatuses.includes(d.status)) { untouched++; continue; }

    const assignedPhone = d.assignedWorkerPhone || d.professional?.phone;
    const assignedName  = d.assignedWorkerName || d.professional?.name;

    if (assignedPhone === REAL_WORKER.phone) {
      // Already the real worker — leave alone
      untouched++;
      continue;
    }

    if (assignedName && /mahes/i.test(assignedName)) {
      // REASSIGN: a "Mahes" booking → real worker
      batch.update(doc.ref, {
        professional: REAL_WORKER,
        assignedWorkerId:    REAL_WORKER.id,
        assignedWorkerName:  REAL_WORKER.name,
        assignedWorkerPhone: REAL_WORKER.phone,
        status: 'assigned',
        assignedAt:  admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
        reassignNote: 'Auto-reassigned: original worker (Mahes/9441270570) was admin, not a real worker',
      });
      reassigned++;
      console.log(`REASSIGN ${doc.id} (${d.orderId}) was=${assignedName} -> ${REAL_WORKER.name}`);
    } else {
      // CANCEL: orphan booking → deleted worker
      batch.update(doc.ref, {
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        cancelledReason: 'Auto-cancel: assigned worker no longer exists in Firestore',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      cancelled++;
      console.log(`CANCEL   ${doc.id} (${d.orderId}) was=${assignedName} (orphan)`);
    }

    batchCount++;
    if (batchCount >= COMMIT_EVERY) await flush();
  }

  await flush();

  console.log('\n--- SUMMARY ---');
  console.log(`Reassigned to ${REAL_WORKER.name}:  ${reassigned}`);
  console.log(`Auto-cancelled (orphan):           ${cancelled}`);
  console.log(`Untouched (already real / closed): ${untouched}`);
  console.log('\nDone.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
