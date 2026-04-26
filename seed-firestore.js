const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seed() {
  console.log('Starting seed...');

  // 1. Delete old broken promo_codes if exists
  await db.collection('app_config').doc('promo_codes').delete().catch(() => {});
  
  // 2. Add promo codes (CORRECT spelling)
  await db.collection('app_config').doc('promo_codes').set({
    VEGA50: { type: 'pct', val: 50, label: '50% off first order', active: true },
    FIRST20: { type: 'pct', val: 20, label: '20% off', active: true },
    FLAT100: { type: 'flat', val: 100, label: '₹100 flat off', active: true }
  });
  console.log('✅ promo_codes added');

  // 3. Add professional
  await db.collection('professionals').doc('pro_lakshmi01').set({
    name: 'Lakshmi Devi',
    phone: '9999991111',
    services: ['home', 'bathroom'],
    rating: 4.9,
    isAvailable: true,
    currentArea: 'Madhurawada'
  });
  console.log('✅ professional added');

  // 4. Add area
  await db.collection('areas').doc('madhurawada').set({
    name: 'Madhurawada',
    city: 'Visakhapatnam',
    isActive: true
  });
  console.log('✅ area added');

  console.log('\n🎉 ALL SEED DATA LOADED SUCCESSFULLY!');
  process.exit(0);
}

seed().catch(err => { console.error('❌ Error:', err); process.exit(1); });