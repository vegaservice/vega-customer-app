// Check correct field names used by Admin app
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  const snap = await db.collection('bookings').get();
  const openStatuses = ['pending','confirmed','Confirmed','assigned','Assigned','accepted','on_the_way','OnTheWay','arrived','in_progress','Started','new'];

  let open = 0, withWorker = 0, withoutWorker = 0;
  const noWorkerList = [];

  snap.forEach(doc => {
    const d = doc.data();
    if (!openStatuses.includes(d.status)) return;
    open++;
    const w = d.assignedWorkerPhone || d.professional?.phone || null;
    if (w) {
      withWorker++;
    } else {
      withoutWorker++;
      noWorkerList.push({
        id: doc.id,
        status: d.status,
        orderId: d.orderId,
        customer: d.customerName || d.userName,
        customerPhone: d.customerPhone || d.userPhone,
        // Show ALL possibly relevant fields
        assignedWorkerPhone: d.assignedWorkerPhone,
        assignedWorkerName: d.assignedWorkerName,
        assignedWorkerId: d.assignedWorkerId,
        professional: d.professional,
        createdAt: d.createdAt?.toDate?.()?.toISOString(),
      });
    }
  });

  console.log(`Open bookings: ${open}`);
  console.log(`  WITH worker assigned: ${withWorker}`);
  console.log(`  WITHOUT worker (orphan):  ${withoutWorker}\n`);

  console.log('=== ORPHAN OPEN BOOKINGS (status set, but no worker) ===\n');
  noWorkerList.slice(0, 30).forEach(b => {
    console.log(`${b.id} | ${b.orderId || ''} | ${b.status} | ${b.customer || ''} (${b.customerPhone || ''}) | ${b.createdAt || ''}`);
  });

  // Now show WITH-worker bookings
  console.log('\n=== BOOKINGS WITH WORKER ASSIGNED ===\n');
  let cnt = 0;
  snap.forEach(doc => {
    const d = doc.data();
    if (!openStatuses.includes(d.status)) return;
    const w = d.assignedWorkerPhone || d.professional?.phone || null;
    if (w) {
      cnt++;
      console.log(`${doc.id} | ${d.orderId || ''} | ${d.status} | worker=${w} | name=${d.assignedWorkerName || d.professional?.name || ''}`);
    }
  });
  console.log(`(${cnt} bookings shown)`);

  process.exit(0);
})();
