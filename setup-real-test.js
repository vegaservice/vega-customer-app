// ████ REAL-WORLD TESTING SETUP ████
// Cleans up dummy/seeded users and creates ONLY the 3 real testing accounts.
//
// REAL TEST PHONES:
//   9441270570 → Admin    (iPhone, Mahesh)
//   9133222344 → Customer (iPhone, secondary)
//   7207719922 → Worker   (Android)
//
// Run: node setup-real-test.js
// Requires: serviceAccountKey.json in this folder

const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ══════════════════════════════════════════════════
// REAL TEST PHONES
// ══════════════════════════════════════════════════
const ADMIN_PHONE    = '9441270570'; // iPhone, Mahesh (admin)
const CUSTOMER_PHONE = '9133222344'; // iPhone (customer)
const WORKER_PHONE   = '7207719922'; // Android (worker)

// ══════════════════════════════════════════════════
// DUMMY PHONES TO DELETE (seeded test data)
// ══════════════════════════════════════════════════
const DUMMY_WORKER_PHONES = [
  '7777777701', '7777777702', '7777777703', '7777777704', '7777777705',
  '9999999998', // Old hub manager dummy
];
const DUMMY_CUSTOMER_PHONES = [
  '8888888888', '9999999999', '9876543210',
];

// ══════════════════════════════════════════════════
// CLEANUP
// ══════════════════════════════════════════════════
async function cleanupDummies() {
  console.log('\nðŸ§¹ CLEANUP — Removing dummy seeded users...\n');

  // Delete dummy customers from users/
  for (const phone of DUMMY_CUSTOMER_PHONES) {
    try {
      await db.collection('users').doc(phone).delete();
      console.log(`  âœ‚ï¸  Deleted users/${phone}`);
    } catch (e) {
      console.log(`  ðŸ‘» users/${phone} not found (already gone)`);
    }
  }

  // Delete dummy workers from workers/ AND professionals/
  for (const phone of DUMMY_WORKER_PHONES) {
    for (const col of ['workers', 'professionals']) {
      try {
        await db.collection(col).doc(`worker_${phone}`).delete();
        console.log(`  âœ‚ï¸  Deleted ${col}/worker_${phone}`);
      } catch (e) {
        console.log(`  ðŸ‘» ${col}/worker_${phone} not found`);
      }
    }
  }

  // Also clean up any test bookings (older than today, status=test)
  console.log('\n  ðŸ”Ž Scanning for old test bookings...');
  const oldBookings = await db.collection('bookings')
    .where('isTest', '==', true)
    .limit(100)
    .get();
  let deletedBookings = 0;
  for (const doc of oldBookings.docs) {
    await doc.ref.delete();
    deletedBookings++;
  }
  console.log(`  âœ‚ï¸  Deleted ${deletedBookings} flagged test bookings`);
}

// ══════════════════════════════════════════════════
// SETUP REAL ACCOUNTS
// ══════════════════════════════════════════════════
async function setupAdmin() {
  console.log('\nðŸ‘‘ ADMIN — Creating/updating admins/9441270570...\n');
  await db.collection('admins').doc(ADMIN_PHONE).set({
    phone: ADMIN_PHONE,
    name: 'Mahesh Pappala',
    role: 'admin',
    email: 'connect@vegaservice.in',
    isAdmin: true,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  âœ… admins/${ADMIN_PHONE} ready`);
}

async function setupWorker() {
  console.log('\nðŸ‘· WORKER — Creating workers/worker_7207719922...\n');
  const workerId = `worker_${WORKER_PHONE}`;
  const workerData = {
    id: workerId,
    phone: WORKER_PHONE,
    name: 'VEGA Test Worker',
    role: 'worker',
    status: 'active',
    isAvailable: true,
    isActive: true,
    services: ['Home Cleaning', 'Kitchen Cleaning', 'Bathroom Cleaning', 'Car Washing'],
    currentArea: 'Madhurawada',
    assignedAreas: ['Madhurawada', 'Yendada', 'PM Palem'],
    ratingAvg: 5.0,
    totalReviews: 0,
    totalJobsCompleted: 0,
    performanceScore: 100,
    salary: 12000,
    experience: 'Test',
    badge: 'Verified',
    fcmToken: null,
    attendance: {
      jobsToday: 0,
      jobsWeek: 0,
      daysPresent: 0,
      daysAbsent: 0,
      daysLeave: 0,
      todayStatus: 'Not Marked',
    },
    earnings: { today: 0, thisWeek: 0, thisMonth: 0, total: 0 },
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  // Write to BOTH collections (as the app expects)
  await db.collection('workers').doc(workerId).set(workerData, { merge: true });
  await db.collection('professionals').doc(workerId).set(workerData, { merge: true });
  console.log(`  âœ… workers/${workerId} ready`);
  console.log(`  âœ… professionals/${workerId} ready`);
}

async function noteCustomer() {
  console.log('\nðŸ›’ CUSTOMER — 9133222344');
  console.log('  â„¹ï¸  No Firestore doc needed yet. The Customer App auto-creates');
  console.log('     users/9133222344 on first OTP login.');
}

// ══════════════════════════════════════════════════
// FIX app_config.settings.supportEmail
// (was: connect@vegavizag.in — should be connect@vegaservice.in)
// ══════════════════════════════════════════════════
async function fixAppConfig() {
  console.log('\nâš™ï¸  APP CONFIG — Verifying supportPhone + supportEmail...\n');
  await db.collection('app_config').doc('settings').set({
    supportPhone: '7207719922',
    supportEmail: 'connect@vegaservice.in',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  âœ… app_config/settings.supportPhone = 7207719922`);
  console.log(`  âœ… app_config/settings.supportEmail = connect@vegaservice.in`);
}

// ══════════════════════════════════════════════════
// VERIFY STATE
// ══════════════════════════════════════════════════
async function verifyState() {
  console.log('\nðŸ” VERIFICATION — Reading all 3 docs back from Firestore...\n');

  const adminDoc = await db.collection('admins').doc(ADMIN_PHONE).get();
  console.log(`  ${adminDoc.exists ? 'âœ…' : 'âŒ'} admins/${ADMIN_PHONE}: ${adminDoc.exists ? adminDoc.data().name : 'MISSING'}`);

  const workerDoc = await db.collection('workers').doc(`worker_${WORKER_PHONE}`).get();
  console.log(`  ${workerDoc.exists ? 'âœ…' : 'âŒ'} workers/worker_${WORKER_PHONE}: ${workerDoc.exists ? workerDoc.data().name : 'MISSING'}`);

  const profDoc = await db.collection('professionals').doc(`worker_${WORKER_PHONE}`).get();
  console.log(`  ${profDoc.exists ? 'âœ…' : 'âŒ'} professionals/worker_${WORKER_PHONE}: ${profDoc.exists ? profDoc.data().name : 'MISSING'}`);

  // Count remaining workers
  const allWorkers = await db.collection('workers').get();
  console.log(`\n  ðŸ“Š Total workers in Firestore: ${allWorkers.size}`);
  allWorkers.forEach(doc => {
    const d = doc.data();
    console.log(`     - ${doc.id} | ${d.name || '?'} | ${d.phone || '?'} | ${d.role || '?'}`);
  });

  // Count customers
  const allUsers = await db.collection('users').get();
  console.log(`\n  ðŸ“Š Total customers in Firestore: ${allUsers.size}`);
  allUsers.forEach(doc => {
    const d = doc.data();
    console.log(`     - users/${doc.id} | ${d.name || '?'}`);
  });
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════
(async () => {
  console.log('═════════════════════════════════════════════════');
  console.log('  VEGA REAL-WORLD TESTING SETUP');
  console.log('═════════════════════════════════════════════════');
  console.log(`  ADMIN     : ${ADMIN_PHONE} (iPhone)`);
  console.log(`  CUSTOMER  : ${CUSTOMER_PHONE} (iPhone)`);
  console.log(`  WORKER    : ${WORKER_PHONE} (Android)`);
  console.log('═════════════════════════════════════════════════');

  await cleanupDummies();
  await setupAdmin();
  await setupWorker();
  await noteCustomer();
  await fixAppConfig();
  await verifyState();

  console.log('\nâœ… DONE. Firestore is now clean + ready for real testing.\n');
  process.exit(0);
})().catch(err => {
  console.error('âŒ Setup failed:', err);
  process.exit(1);
});
