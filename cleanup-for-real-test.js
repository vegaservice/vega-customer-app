// ████ AGGRESSIVE CLEANUP FOR REAL-WORLD TESTING ████
// Removes ALL leftover seeded test data.
// KEEPS ONLY: admins/9441270570, workers/worker_7207719922
//
// Run: node cleanup-for-real-test.js

const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ══════════════════════════════════════════════════
// KEEP-LIST (real test accounts — DO NOT DELETE)
// ══════════════════════════════════════════════════
const KEEP_WORKER_DOCS = ['worker_7207719922'];
const KEEP_CUSTOMER_PHONES = []; // Empty — fresh customer on first login
const KEEP_ADMIN_PHONES = ['9441270570'];

// ══════════════════════════════════════════════════
// EXTRA: Customers to delete by name pattern
// ══════════════════════════════════════════════════
const PROTECT_CUSTOMER_PATTERNS = [
  /^Test Customer$/i,
  /^Test\b/i,
  /^Customer$/i, // generic placeholder
];

(async () => {
  console.log('═════════════════════════════════════════════════');
  console.log('  AGGRESSIVE CLEANUP — wiping all test data');
  console.log('═════════════════════════════════════════════════\n');

  // ============================================================
  // 1. DELETE all workers EXCEPT worker_7207719922
  // ============================================================
  console.log('1. Cleaning workers/ + professionals/...\n');
  const allWorkers = await db.collection('workers').get();
  let deletedWorkers = 0;
  for (const doc of allWorkers.docs) {
    if (KEEP_WORKER_DOCS.includes(doc.id)) {
      console.log(`  KEEP workers/${doc.id} (real test worker)`);
      continue;
    }
    await doc.ref.delete();
    await db.collection('professionals').doc(doc.id).delete().catch(() => {});
    console.log(`  DELETE workers/${doc.id} + professionals/${doc.id}`);
    deletedWorkers++;
  }
  console.log(`\n  -> Removed ${deletedWorkers} workers\n`);

  // ============================================================
  // 2. DELETE leftover professionals (any not matching workers)
  // ============================================================
  console.log('2. Cleaning orphan professionals/...\n');
  const allProfs = await db.collection('professionals').get();
  let deletedProfs = 0;
  for (const doc of allProfs.docs) {
    if (KEEP_WORKER_DOCS.includes(doc.id)) continue;
    await doc.ref.delete();
    console.log(`  DELETE professionals/${doc.id}`);
    deletedProfs++;
  }
  console.log(`\n  -> Removed ${deletedProfs} orphan professionals\n`);

  // ============================================================
  // 3. DELETE specific test customer (9133222344 — Isha)
  // ============================================================
  console.log('3. Deleting users/9133222344 (Isha) — fresh start...\n');
  await db.collection('users').doc('9133222344').delete().catch(() => {});
  console.log(`  DELETE users/9133222344\n`);

  // ============================================================
  // 4. Show what customers remain (for awareness only — keep all real)
  // ============================================================
  console.log('4. Surveying remaining customers (keeping real ones)...\n');
  const allUsers = await db.collection('users').get();
  console.log(`  Total customers: ${allUsers.size}`);
  let testCustomersFound = 0;
  for (const doc of allUsers.docs) {
    const d = doc.data();
    const name = d.name || '(no name)';
    const isTest = PROTECT_CUSTOMER_PATTERNS.some(p => p.test(name));
    if (isTest) {
      console.log(`  POTENTIAL TEST DATA: users/${doc.id} | "${name}" — consider deleting`);
      testCustomersFound++;
    }
  }
  if (testCustomersFound === 0) {
    console.log(`  All remaining customers look real. No more deletions needed.`);
  } else {
    console.log(`\n  Found ${testCustomersFound} possible test customers (not auto-deleted — they may have real bookings).`);
  }

  // ============================================================
  // 5. FINAL STATE
  // ============================================================
  console.log('\n═════════════════════════════════════════════════');
  console.log('  FINAL STATE');
  console.log('═════════════════════════════════════════════════\n');

  const finalWorkers = await db.collection('workers').get();
  console.log(`Workers (${finalWorkers.size}):`);
  finalWorkers.forEach(doc => {
    const d = doc.data();
    console.log(`  - ${doc.id} | ${d.name || '?'} | role=${d.role || '?'} | phone=${d.phone || '?'}`);
  });

  const finalAdmins = await db.collection('admins').get();
  console.log(`\nAdmins (${finalAdmins.size}):`);
  finalAdmins.forEach(doc => {
    const d = doc.data();
    console.log(`  - ${doc.id} | ${d.name || '?'}`);
  });

  const finalUsers = await db.collection('users').get();
  console.log(`\nCustomers (${finalUsers.size}): (all kept — real signups from your testers)`);

  console.log('\nDONE — Firestore is now minimal for real testing.\n');
  process.exit(0);
})().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
