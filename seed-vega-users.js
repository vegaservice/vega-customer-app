// ████ VEGA FIRESTORE SEED SCRIPT ████
// Creates all test users in one shot
// Run: node seed-vega-users.js
// JAI SIDDHI VINAYAKA | JAI RADHA KRISHNA 🪷

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vega-home-service',
});

const db = admin.firestore();

// ══════════════════════════════════════════════════
// TEST DATA — All 10 users
// ══════════════════════════════════════════════════

const CUSTOMERS = [
  {
    phone: '9999999999',
    name: 'Priya Sharma',
    email: 'priya@test.com',
    area: 'Madhurawada',
    address: 'Flat 3B, Sri Sai Residency, Madhurawada, Vizag',
    wallet: 200,
    referralCode: 'PRIYA200',
  },
  {
    phone: '8888888801',
    name: 'Anitha Rao',
    email: 'anitha@test.com',
    area: 'Rushikonda',
    address: 'Flat 12A, Ocean View Apts, Rushikonda, Vizag',
    wallet: 150,
    referralCode: 'ANITHA150',
  },
  {
    phone: '8888888802',
    name: 'Lakshmi Devi',
    email: 'lakshmi@test.com',
    area: 'MVP Colony',
    address: 'H.No 45, Sri Nagar Colony, MVP Colony, Vizag',
    wallet: 300,
    referralCode: 'LAKSHMI300',
  },
  {
    phone: '8888888803',
    name: 'Ramesh Kumar',
    email: 'ramesh@test.com',
    area: 'Madhurawada',
    address: 'Flat 7C, Green Valley Apts, Madhurawada, Vizag',
    wallet: 100,
    referralCode: 'RAMESH100',
  },
  {
    phone: '8888888804',
    name: 'Sunitha Naidu',
    email: 'sunitha@test.com',
    area: 'Kommadi',
    address: 'Flat 2A, Sunrise Towers, Kommadi, Vizag',
    wallet: 250,
    referralCode: 'SUNITHA250',
  },
];

const WORKERS = [
  {
    phone: '7777777701',
    name: 'Vijaya Lakshmi',
    role: 'worker',
    services: ['Home Cleaning', 'Bathroom Cleaning'],
    currentArea: 'Madhurawada',
    ratingAvg: 4.9,
    totalJobsCompleted: 47,
    performanceScore: 92,
    salary: 13000,
    experience: '2 years',
    badge: 'Top Rated',
  },
  {
    phone: '7777777702',
    name: 'Suresh Babu',
    role: 'worker',
    services: ['Car Washing', 'Home Cleaning'],
    currentArea: 'Madhurawada',
    ratingAvg: 4.8,
    totalJobsCompleted: 31,
    performanceScore: 88,
    salary: 12000,
    experience: '1 year',
    badge: 'Verified',
  },
  {
    phone: '7777777703',
    name: 'Kavitha Reddy',
    role: 'worker',
    services: ['Beauty Care', 'Home Cleaning'],
    currentArea: 'Rushikonda',
    ratingAvg: 4.7,
    totalJobsCompleted: 23,
    performanceScore: 85,
    salary: 14000,
    experience: '1.5 years',
    badge: 'Verified',
  },
];

const HUB_MANAGER = {
  phone: '9999999998',
  name: 'Ravi Teja',
  role: 'hub_manager',
  currentArea: 'Madhurawada',
  ratingAvg: 4.9,
  totalJobsCompleted: 0,
  performanceScore: 95,
  salary: 20000,
  experience: '3 years',
  badge: 'Hub Manager',
};

const ADMIN = {
  phone: '9441270570',
  name: 'Mahesh Pappala',
  role: 'admin',
  email: 'connect@vegavizag.in',
};

// ══════════════════════════════════════════════════
// SEED FUNCTIONS
// ══════════════════════════════════════════════════

async function seedCustomers() {
  console.log('\n📱 Creating customers...');
  for (const c of CUSTOMERS) {
    await db.collection('users').doc(c.phone).set({
      ...c,
      userId: c.phone,
      totalBookings: 0,
      totalSpent: 0,
      isActive: true,
      walletBalance: c.wallet,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✅ Customer: ${c.name} (+91 ${c.phone})`);
  }
}

async function seedWorkers() {
  console.log('\n👷 Creating workers...');
  for (const w of WORKERS) {
    const id = `worker_${w.phone}`;
    const workerData = {
      id,
      ...w,
      status: 'active',
      isAvailable: true,
      isActive: true,
      assignedAreas: [w.currentArea],
      totalReviews: Math.floor(w.totalJobsCompleted * 0.8),
      fcmToken: null,
      attendance: {
        jobsToday: 0,
        jobsWeek: 0,
        daysPresent: 0,
        daysAbsent: 0,
        daysLeave: 0,
        todayStatus: 'Not Marked',
      },
      earnings: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        total: 0,
      },
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Write to BOTH collections
    await db.collection('workers').doc(id).set(workerData);
    await db.collection('professionals').doc(id).set(workerData);
    console.log(`  ✅ Worker: ${w.name} (+91 ${w.phone}) — ${w.services.join(', ')}`);
  }
}

async function seedHubManager() {
  console.log('\n🏢 Creating hub manager...');
  const id = `worker_${HUB_MANAGER.phone}`;
  const mgr = {
    id,
    ...HUB_MANAGER,
    status: 'active',
    isAvailable: true,
    isActive: true,
    services: ['All Services'],
    assignedAreas: ['Madhurawada', 'Rushikonda', 'Kommadi'],
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
  await db.collection('workers').doc(id).set(mgr);
  await db.collection('professionals').doc(id).set(mgr);
  console.log(`  ✅ Hub Manager: ${HUB_MANAGER.name} (+91 ${HUB_MANAGER.phone})`);
}

async function seedAdmin() {
  console.log('\n👑 Creating admin...');
  await db.collection('admins').doc(ADMIN.phone).set({
    ...ADMIN,
    isAdmin: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`  ✅ Admin: ${ADMIN.name} (+91 ${ADMIN.phone})`);
}

async function seedPromoCodes() {
  console.log('\n🎟️  Creating promo codes...');
  await db.collection('app_config').doc('promo_codes').set({
    'VEGA50':  { type: 'pct',  val: 50,  label: '50% off — First order',     active: true,  minOrder: 99  },
    'FIRST20': { type: 'pct',  val: 20,  label: '20% off — New user',        active: true,  minOrder: 0   },
    'FLAT100': { type: 'flat', val: 100, label: '₹100 flat off',             active: true,  minOrder: 299 },
    'VIZAG20': { type: 'pct',  val: 20,  label: '20% off — Vizag special',   active: true,  minOrder: 0   },
    'VEGA2025':{ type: 'pct',  val: 20,  label: '20% off — Welcome offer',   active: true,  minOrder: 0   },
  });
  console.log('  ✅ Promo codes: VEGA50, FIRST20, FLAT100, VIZAG20, VEGA2025');
}

async function seedAppConfig() {
  console.log('\n⚙️  Creating app config...');
  await db.collection('app_config').doc('settings').set({
    platformFee: 19,
    minOrderValue: 49,
    maxWalletUse: 200,
    referralBonus: 200,
    ratingBonus: 50,
    supportPhone: '9441270570',
    supportEmail: 'connect@vegavizag.in',
    serviceCities: ['Visakhapatnam'],
    serviceAreas: [
      'Madhurawada', 'Rushikonda', 'MVP Colony',
      'Dwaraka Nagar', 'Kommadi', 'Seethammadhara',
      'Gajuwaka', 'Pendurthi', 'Waltair', 'Siripuram'
    ],
    maxSlotsPerDay: 15,
    autoAssign: true,
    maintenanceMode: false,
    version: '1.0.0',
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ App config created');
}

async function seedTestBooking() {
  console.log('\n📦 Creating 1 test booking...');
  const orderId = 'VGTEST001';
  await db.collection('bookings').doc(orderId).set({
    orderId,
    userId: '9999999999',
    userName: 'Priya Sharma',
    userPhone: '9999999999',
    items: [{ name: 'Home Cleaning', variant: '2 Hours', price: 199, icon: '🏠' }],
    subtotal: 199,
    total: 218,
    platformFee: 19,
    promoDiscount: 0,
    walletUsed: 0,
    status: 'Confirmed',
    slot: 'Arriving in 30-45 minutes',
    bookingMode: 'instant',
    address: {
      flat: 'Flat 3B',
      buildingName: 'Sri Sai Residency',
      area: 'Madhurawada',
    },
    addressFull: 'Flat 3B, Sri Sai Residency, Madhurawada, Vizag',
    otp: '5678',
    rated: false,
    assignedWorkerId: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('  ✅ Test booking created: VGTEST001 (status: Confirmed — ready to assign)');
}

// ══════════════════════════════════════════════════
// FIREBASE AUTH — Add test phone numbers
// ══════════════════════════════════════════════════

async function printFirebaseAuthInstructions() {
  console.log('\n📱 FIREBASE AUTH TEST NUMBERS:');
  console.log('   Add these manually in Firebase Console:');
  console.log('   Authentication → Sign-in method → Phone → Test numbers\n');

  const allPhones = [
    ...CUSTOMERS.map(c => ({ phone: `+91 ${c.phone}`, role: `Customer: ${c.name}` })),
    ...WORKERS.map(w => ({ phone: `+91 ${w.phone}`, role: `Worker: ${w.name}` })),
    { phone: `+91 ${HUB_MANAGER.phone}`, role: `Hub Manager: ${HUB_MANAGER.name}` },
    { phone: `+91 ${ADMIN.phone}`, role: `Admin: ${ADMIN.name}` },
  ];

  allPhones.forEach(({ phone, role }) => {
    console.log(`   Phone: ${phone}  →  OTP: 123456  [${role}]`);
  });
}

// ══════════════════════════════════════════════════
// RUN ALL
// ══════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('████████████████████████████████████████');
  console.log('  🪷 VEGA FIRESTORE SEED SCRIPT');
  console.log('  Creating all test users...');
  console.log('████████████████████████████████████████');

  try {
    await seedCustomers();
    await seedWorkers();
    await seedHubManager();
    await seedAdmin();
    await seedPromoCodes();
    await seedAppConfig();
    await seedTestBooking();
    await printFirebaseAuthInstructions();

    console.log('\n████████████████████████████████████████');
    console.log('  ✅ ALL DONE! VEGA test data created.');
    console.log('\n  LOGIN SUMMARY:');
    console.log('  ──────────────────────────────────────');
    console.log('  App         | Phone       | OTP    | Role');
    console.log('  ──────────────────────────────────────');
    console.log('  Customer    | 9999999999  | 123456 | Priya Sharma');
    console.log('  Customer    | 8888888801  | 123456 | Anitha Rao');
    console.log('  Customer    | 8888888802  | 123456 | Lakshmi Devi');
    console.log('  Customer    | 8888888803  | 123456 | Ramesh Kumar');
    console.log('  Customer    | 8888888804  | 123456 | Sunitha Naidu');
    console.log('  Worker      | 7777777701  | 123456 | Vijaya Lakshmi');
    console.log('  Worker      | 7777777702  | 123456 | Suresh Babu');
    console.log('  Worker      | 7777777703  | 123456 | Kavitha Reddy');
    console.log('  Hub Manager | 9999999998  | 123456 | Ravi Teja');
    console.log('  Admin       | 9441270570  | SMS    | Mahesh Pappala');
    console.log('  ──────────────────────────────────────');
    console.log('\n  TEST FLOW:');
    console.log('  1. Customer (9999999999) places order');
    console.log('  2. Admin (9441270570) assigns to Worker 7777777701');
    console.log('  3. Worker (7777777701) sees job and accepts');
    console.log('  4. Customer sees live status update');
    console.log('  5. Worker completes with photos + OTP');
    console.log('  6. Customer rates the service');
    console.log('');
    console.log('  JAI SIDDHI VINAYAKA | JAI RADHA KRISHNA 🪷');
    console.log('████████████████████████████████████████\n');

  } catch (e) {
    console.error('\n❌ Seed failed:', e.message);
  }
  process.exit(0);
}

main();
