// ████ VEGA — Load-Test Seed Script (Section 17 — Tests 196-206) ████
//
// PURPOSE: Seed 50 workers + 100 bookings (50 instant, 30 scheduled,
//          20 subscription parents + 100 child docs) and tag them so they
//          can be deleted in a single sweep.
//
// PREREQUISITE: A Firebase service-account JSON key.
//   1. Open https://console.firebase.google.com/project/<your-vega-project>/settings/serviceaccounts/adminsdk
//   2. Click "Generate new private key" → save as service-account.json
//      ALONGSIDE this file (./service-account.json — same folder).
//   3. NEVER commit that JSON. (Already covered by .gitignore for *.json
//      in scripts/ — verify before pushing.)
//
// RUN:
//   cd Vega-app/scripts
//   npm install firebase-admin       # only first time
//   node load-test-seed.js seed      # creates everything
//   node load-test-seed.js cleanup   # removes everything tagged loadTest:true
//
// SAFETY:
//   • Every doc is tagged { loadTest: true } so cleanup can find them.
//   • Test phones use a `9000` prefix (e.g. 9000000001) — keep this
//     range OFF the Firebase test-numbers whitelist in prod.
//   • Script refuses to run against a project whose ID doesn't include
//     'vega' (guards against accidental production hit).
//
// ─────────────────────────────────────────────────────────────────────

const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, 'service-account.json');
let serviceAccount;
try {
  serviceAccount = require(KEY);
} catch (e) {
  console.error('\n❌ Cannot find ./service-account.json next to this script.');
  console.error('   Download from Firebase console → Project Settings → Service accounts.');
  console.error('   Then re-run.\n');
  process.exit(1);
}

if (!serviceAccount.project_id || !/vega/i.test(serviceAccount.project_id)) {
  console.error('\n❌ Project ID does not contain "vega" — refusing to run.');
  console.error(`   project_id = ${serviceAccount.project_id}`);
  console.error('   This is a safety guard. Use a VEGA test/staging project.\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const NUM_WORKERS              = 50;
const NUM_INSTANT_BOOKINGS     = 50;
const NUM_SCHEDULED_BOOKINGS   = 30;
const NUM_SUBSCRIPTION_PARENTS = 20;
const VISITS_PER_SUBSCRIPTION  = 5;

const AREAS = ['Madhurawada','Rushikonda','MVP Colony','Gajuwaka','Pendurthi'];
const SVCS  = ['Home Cleaning','Bathroom Cleaning','Kitchen Cleaning','Car Cleaning','Sofa Cleaning'];

const pad3 = (n) => String(n).padStart(3,'0');
const rand = (arr) => arr[Math.floor(Math.random()*arr.length)];
const isoToday = () => new Date().toISOString().split('T')[0];
const isoOffset = (days) => {
  const d = new Date(); d.setDate(d.getDate()+days);
  return d.toISOString().split('T')[0];
};

async function seedWorkers() {
  console.log(`▶ Seeding ${NUM_WORKERS} workers…`);
  const batch = db.batch();
  for (let i = 1; i <= NUM_WORKERS; i++) {
    const id = `worker_${pad3(i)}`;
    const ref = db.collection('workers').doc(id);
    batch.set(ref, {
      id,
      name: `Test Worker ${pad3(i)}`,
      phone: `9000${pad3(i).padStart(6,'0').slice(-6)}`,
      role: 'worker',
      status: 'active',
      isActive: true,
      isAvailable: true,
      currentArea: rand(AREAS),
      ratingAvg: 4.5 + Math.random()*0.5,
      totalJobsCompleted: Math.floor(Math.random()*200),
      joinedAt: FieldValue.serverTimestamp(),
      loadTest: true,
    });
    if (i % 400 === 0) { await batch.commit(); }
  }
  await batch.commit();
  console.log(`✅ ${NUM_WORKERS} workers seeded`);
}

function makeBooking(kind, idx) {
  const phone = `9001${pad3(idx).padStart(6,'0').slice(-6)}`;
  const area  = rand(AREAS);
  const svc   = rand(SVCS);
  const base  = {
    customerPhone: phone,
    userPhone:     phone,
    userId:        phone,
    customerName:  `Load Test User ${idx}`,
    userName:      `Load Test User ${idx}`,
    items:         [{ name: svc, price: 99 + Math.floor(Math.random()*400) }],
    subtotal:      199, total: 228, totalPaid: 228, platformFee: 29,
    address: { area, city:'Visakhapatnam', flat:`${idx}A` },
    addressFull:   `${idx}A, ${area}, Vizag`,
    status:        'confirmed',
    paymentMethod: 'upi', paymentStatus:'paid',
    createdAt:     FieldValue.serverTimestamp(),
    loadTest:      true,
  };
  if (kind === 'instant') {
    return { ...base, bookingMode:'instant', totalVisits:1, visitNumber:1, slot:'30-45 min', scheduledDate: isoToday() };
  }
  if (kind === 'scheduled') {
    return { ...base, bookingMode:'scheduled', totalVisits:1, visitNumber:1,
      scheduledDate: isoOffset(1 + Math.floor(Math.random()*7)), scheduledTime:'10:00 AM',
      slot: `Scheduled visit at 10:00 AM` };
  }
  // subscription parent
  return { ...base, bookingMode:'subscription', totalVisits: VISITS_PER_SUBSCRIPTION, visitNumber:1,
    subscriptionStartDate: isoToday(),
    subscriptionEndDate:   isoOffset(VISITS_PER_SUBSCRIPTION*2),
    subscriptionDays: ['Mon','Wed','Fri'],
    subscriptionDiscount: 23, scheduledDate: isoToday(), scheduledTime:'9:00 AM',
    slot: `Subscription · ${VISITS_PER_SUBSCRIPTION} visits` };
}

async function seedBookings() {
  console.log(`▶ Seeding ${NUM_INSTANT_BOOKINGS} instant bookings…`);
  for (let i = 1; i <= NUM_INSTANT_BOOKINGS; i++) {
    const orderId = `LT_INS_${pad3(i)}`;
    await db.collection('bookings').doc(orderId).set({ orderId, ...makeBooking('instant', i) });
  }

  console.log(`▶ Seeding ${NUM_SCHEDULED_BOOKINGS} scheduled bookings…`);
  for (let i = 1; i <= NUM_SCHEDULED_BOOKINGS; i++) {
    const orderId = `LT_SCH_${pad3(i)}`;
    await db.collection('bookings').doc(orderId).set({ orderId, ...makeBooking('scheduled', i+100) });
  }

  console.log(`▶ Seeding ${NUM_SUBSCRIPTION_PARENTS} subscription parents + ${NUM_SUBSCRIPTION_PARENTS*(VISITS_PER_SUBSCRIPTION-1)} child visits…`);
  for (let i = 1; i <= NUM_SUBSCRIPTION_PARENTS; i++) {
    const parentOrderId = `LT_SUB_${pad3(i)}`;
    await db.collection('bookings').doc(parentOrderId).set({ orderId:parentOrderId, ...makeBooking('subscription', i+200) });
    // 4 child visits per parent (parent itself is visit #1)
    for (let v = 2; v <= VISITS_PER_SUBSCRIPTION; v++) {
      const childRef = db.collection('bookings').doc();
      const childOrder = `LT_SUB_${pad3(i)}_V${v}`;
      await childRef.set({
        ...makeBooking('subscription', i+200),
        orderId: childOrder,
        visitNumber: v,
        parentSubscriptionId: parentOrderId,
        isChildVisit: true,
        totalPaid: 0,            // CRITICAL: child docs have 0 — parent holds full amount
        scheduledDate: isoOffset(v*2),
        slot: `Subscription · Visit ${v} of ${VISITS_PER_SUBSCRIPTION}`,
      });
    }
  }
  const total = NUM_INSTANT_BOOKINGS + NUM_SCHEDULED_BOOKINGS + NUM_SUBSCRIPTION_PARENTS*VISITS_PER_SUBSCRIPTION;
  console.log(`✅ ${total} booking docs created`);
}

async function cleanup() {
  console.log('▶ Cleanup: deleting all docs tagged loadTest:true');
  for (const col of ['workers','bookings']) {
    const snap = await db.collection(col).where('loadTest','==',true).get();
    console.log(`  ${col}: ${snap.size} docs`);
    // Batch in chunks of 400
    let batch = db.batch(); let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref); n++;
      if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
  }
  console.log('✅ Cleanup complete');
}

async function main() {
  const cmd = (process.argv[2] || '').toLowerCase();
  if (cmd === 'seed') {
    await seedWorkers();
    await seedBookings();
    console.log('\n🎉 SEED DONE. To remove everything later, run:\n   node load-test-seed.js cleanup\n');
  } else if (cmd === 'cleanup') {
    await cleanup();
  } else {
    console.log('Usage: node load-test-seed.js [seed|cleanup]');
  }
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
