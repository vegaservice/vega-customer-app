// ████ VEGA LAUNCH CLEAN SLATE ████
// Wipes ALL test/fake data so you start launch at ZERO revenue, no testers.
// PROTECTS: app_config (your LIVE Razorpay key) + admins (your login).
// After running: re-add your 3 real workers from the Hub/Admin app; customers sign up fresh.
//
// Run:  node cleanup-for-launch.js
// (irreversible — deletes production data)

const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Collections to WIPE completely (every document deleted)
const WIPE = [
  'bookings',          // all orders -> revenue resets to 0
  'workers',           // test workers -> re-add 3 real ones after
  'professionals',     // mirror of workers
  'users',             // test customers -> real ones sign up fresh
  'service_interests', // "notify me" test entries
  'notifications',     // test notifications
  'payment_audit',     // test payment logs
  'bug_reports',       // test bug reports
  'deleted_accounts',  // test deletion records
  'subscriptions',     // test subscriptions
];

// NEVER touched: app_config (LIVE Razorpay key), admins (your login)

async function wipeCollection(name) {
  const snap = await db.collection(name).get();
  if (snap.empty) { console.log(`  ${name}: already empty`); return 0; }
  let n = 0;
  // batches of 400 (Firestore limit is 500)
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
    n += Math.min(400, snap.docs.length - i);
  }
  console.log(`  ${name}: deleted ${n}`);
  return n;
}

(async () => {
  console.log('\n════════ VEGA LAUNCH CLEAN SLATE ════════');
  console.log('Protecting: app_config (Razorpay), admins\n');
  let total = 0;
  for (const c of WIPE) total += await wipeCollection(c);

  console.log('\n──── VERIFY PROTECTED ────');
  const cfg = await db.collection('app_config').doc('payment').get();
  console.log(`  app_config/payment: ${cfg.exists ? 'KEPT ✓ (mode=' + (cfg.data().razorpay_mode) + ')' : 'MISSING ✗'}`);
  const adminsSnap = await db.collection('admins').get();
  console.log(`  admins: ${adminsSnap.size} kept ✓`);

  console.log(`\n✓ DONE — wiped ${total} test docs. Revenue is now ₹0, no testers.`);
  console.log('Next: open Hub/Admin and add your 3 real workers.\n');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
