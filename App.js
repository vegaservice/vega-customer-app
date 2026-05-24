// ████ VEGA HOME SERVICES — COMPLETE APP v16 ████
// PREMIUM EDITION — Web App Design System Applied
//
// ✅ 1. Fraunces serif on ALL headings (install @expo-google-fonts/fraunces)
// ✅ 2. Floating pill tab bar — 4 tabs, blur effect, gradient active state
// ✅ 3. Larger border radius — cards 20px, hero 24px, buttons full pill
// ✅ 4. Soft translucent badges — rgba background + thin border everywhere
// ✅ 5. 3-level shadow system — card / soft / glow (orange-tinted CTA)
// ✅ 6. Hero texture overlay — diagonal stripe pattern for depth
// ✅ 7. Frosted glass badge on hero — backdrop blur pill style
// ✅ 8. Background corner radial glows — subtle warm ambient light
// ✅ All v15 functionality preserved (Firebase OTP, Firestore, Razorpay hooks)
//
// FONT SETUP (one-time):
//   expo install @expo-google-fonts/fraunces expo-font
//   Then uncomment the font imports below
//
// BUILD: 17-APR-2026

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, ScrollView, Alert, SafeAreaView, Dimensions,
  Animated, Modal, ActivityIndicator, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import messaging from '@react-native-firebase/messaging';
import { WebView } from 'react-native-webview';

// ── FONT SETUP ────────────────────────────────────────────────────
// Uncomment after: expo install @expo-google-fonts/fraunces expo-font
// import * as Font from 'expo-font';
// import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
//
// Inside App(): const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold });
// Then use: fontFamily: 'Fraunces_600SemiBold' on all display text

// ── Firebase (ACTIVATED — Production mode)
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// ── Firestore Service Functions (inline — no separate file needed) ──
const createOrUpdateUser = async (phone, data) => {
  try {
    await firestore().collection('users').doc(phone).set({
      ...data, updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (e) { console.error('createOrUpdateUser:', e); return false; }
};

const getUser = async (phone) => {
  try {
    const doc = await firestore().collection('users').doc(phone).get();
    return doc.exists ? doc.data() : null;
  } catch (e) { console.error('getUser:', e); return null; }
};

const updateUserWallet = async (phone, newBalance) => {
  try {
    await firestore().collection('users').doc(phone).update({ walletBalance: newBalance });
    return true;
  } catch (e) { console.error('updateUserWallet:', e); return false; }
};

// Bug 2: Audit trail for every wallet credit/debit (immutable ledger)
const logWalletTransaction = async (phone, amount, reason, type = 'credit') => {
  try {
    await firestore().collection('wallet_transactions').add({
      phone,
      amount,
      reason,           // 'signup_bonus' | 'referral_reward' | 'booking_refund' | 'rating_reward' | etc
      type,             // 'credit' | 'debit'
      timestamp: firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) { console.error('logWalletTransaction:', e); return false; }
};

// ── Bug 7: Saved Addresses CRUD ─────────────────────────────────────
// Subcollection: users/{phone}/addresses/{autoId}
// Fields: label ('Home'|'Office'|'Other'), flat, buildingName, streetName,
//         landmark, area, fullAddress, isDefault, createdAt
const saveAddress = async (phone, addressData, existingId = null) => {
  try {
    const data = {
      ...addressData,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };
    if (existingId) {
      await firestore().collection('users').doc(phone)
        .collection('addresses').doc(existingId).set(data, { merge: true });
      return existingId;
    } else {
      const ref = await firestore().collection('users').doc(phone)
        .collection('addresses').add({
          ...data,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
      return ref.id;
    }
  } catch (e) { console.error('saveAddress:', e); return null; }
};

const deleteAddress = async (phone, addressId) => {
  try {
    await firestore().collection('users').doc(phone)
      .collection('addresses').doc(addressId).delete();
    return true;
  } catch (e) { console.error('deleteAddress:', e); return false; }
};

const setDefaultAddress = async (phone, addressId) => {
  try {
    // Clear isDefault from all addresses, then set on the target
    const snap = await firestore().collection('users').doc(phone)
      .collection('addresses').get();
    const batch = firestore().batch();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isDefault: doc.id === addressId });
    });
    await batch.commit();
    return true;
  } catch (e) { console.error('setDefaultAddress:', e); return false; }
};

const createBooking = async (bookingData) => {
  try {
    const orderId = 'VG' + Date.now().toString().slice(-6);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const booking = {
      ...bookingData, orderId, otp, status: 'confirmed',
      createdAt: firestore.FieldValue.serverTimestamp(), rated: false,
    };
    await firestore().collection('bookings').doc(orderId).set(booking);
    if (bookingData.userId) {
      await firestore().collection('users').doc(bookingData.userId)
        .collection('bookings').doc(orderId)
        .set({ orderId, status: 'confirmed', createdAt: firestore.FieldValue.serverTimestamp() });
    }

    // ── Change 3: Recurring child docs are NOT auto-created here.
    // They are created ONLY after full upfront payment succeeds (see placeOrder).
    // This prevents unpaid recurring bookings from appearing in Firestore.

    return { success: true, orderId, otp, booking };
  } catch (e) { console.error('createBooking:', e); return { success: false, error: e.message }; }
};

const submitBookingRating = async (orderId, userId, rating, note) => {
  try {
    await firestore().collection('bookings').doc(orderId).update({
      rated: true, rating, ratingNote: note,
      ratedAt: firestore.FieldValue.serverTimestamp(),
    });
    // Reward wallet +50
    const user = await getUser(userId);
    if (user) await updateUserWallet(userId, (user.walletBalance || 0) + 50);
    return true;
  } catch (e) { console.error('submitBookingRating:', e); return false; }
};

const validatePromoCode = async (code) => {
  try {
    const doc = await firestore().collection('app_config').doc('promo_codes').get();
    if (doc.exists) {
      const codes = doc.data();
      const promo = codes[code.toUpperCase()];
      if (promo && promo.active) return promo;
    }
    return null;
  } catch (e) { console.error('validatePromoCode:', e); return null; }
};

const listenToBooking = (orderId, callback) => {
  return firestore().collection('bookings').doc(orderId)
    .onSnapshot(
      doc => { if (doc.exists) callback({ id: doc.id, ...doc.data() }); },
      err => console.log('listenToBooking error:', err.message)
    );
};

const DEMO_MODE = false;  // 🚀 PRODUCTION — Firebase active

// ── FIX 1: OTP TEST PHONES — no browser redirect for these numbers
const TEST_PHONES = ['9999999999','7777777701','9999999998','9133222344','1111111111'];

// ── FIX 2: GOOGLE MAPS STATIC API
const MAPS_API_KEY = 'AIzaSyDIQw9tYW5x2NMHZWEIsMlsYkwdxYUbilU';
const getMapUrl = (area, building) => {
  const loc = encodeURIComponent(`${building ? building+', ' : ''}${area||'Madhurawada'}, Visakhapatnam, AP, India`);
  return `https://maps.googleapis.com/maps/api/staticmap?center=${loc}&zoom=16&size=600x240&scale=2&maptype=roadmap&markers=color:0xE8520A%7Clabel:V%7C${loc}&key=${MAPS_API_KEY}`;
};
const DEFAULT_MAP_URL = `https://maps.googleapis.com/maps/api/staticmap?center=Madhurawada,Visakhapatnam,AP,India&zoom=14&size=600x240&scale=2&maptype=roadmap&key=${MAPS_API_KEY}`;

// ── 3D ICONS — local bundled assets (no internet needed) ──────────────
const SVC_ICONS = {
  cleaning: require('./assets/icons/home-clean.png'),
  bathroom: require('./assets/icons/bathroom.png'),
  kitchen:  require('./assets/icons/kitchen.png'),
  car:      require('./assets/icons/car-clean.png'),
  beauty:   require('./assets/icons/beauty.png'),
  // CDN fallbacks for icons not yet downloaded locally
  sofa:     'https://img.icons8.com/3d-fluency/128/sofa.png',
  vacuum:   'https://img.icons8.com/3d-fluency/128/vacuum-cleaner.png',
  elder:    'https://img.icons8.com/3d-fluency/128/elderly-person.png',
  cook:     'https://img.icons8.com/3d-fluency/128/cooking-pot.png',
  repair:   'https://img.icons8.com/3d-fluency/128/maintenance.png',
};
// Maps service id → SVC_ICONS key
const SVC_ICON_MAP = {
  home: 'cleaning', bathroom: 'bathroom', kitchen: 'kitchen',
  car:  'car',      sofa:     'sofa',     beauty:  'beauty',
  deep: 'vacuum',   elder:    'elder',    cook:    'cook',   repair: 'repair',
};
// Helper — returns Image source for any service id (handles both local require + CDN uri)
const svcImgSource = (svcId) => {
  const icon = SVC_ICONS[SVC_ICON_MAP[svcId]];
  if(!icon) return null;
  return typeof icon === 'string' ? { uri: icon } : icon;
};
const SvcIcon = ({ id, emoji, size=40, style }) => {
  const [err, setErr] = React.useState(false);
  const icon = SVC_ICONS[id];
  if (!icon || err) return <Text style={{ fontSize:size*0.75, lineHeight:size, ...style }}>{emoji}</Text>;
  const source = typeof icon === 'string' ? { uri: icon } : icon;
  return <Image source={source} style={{ width:size, height:size, ...style }} resizeMode="contain" onError={()=>setErr(true)} />;
};


const { width: W, height: H } = Dimensions.get('window');
const COL = (W - 48) / 4;

// ════════════════════════════════════════════════════════════════
// PREMIUM DESIGN TOKENS — from web app design system
// ════════════════════════════════════════════════════════════════
const C = {
  // Backgrounds
  splash:     '#FDF6EE',
  bg:         '#F8F3EE',   // --background: oklch(0.975 0.012 80)
  white:      '#FFFFFF',
  card:       '#FEFCF8',   // --card: oklch(0.99 0.008 80) — slightly warmer than white

  // Primary saffron
  orange:     '#C8541A',   // --primary: oklch(0.66 0.18 45)
  orange2:    '#E8621A',
  orangeSoft: '#FF7A3D',
  orangeBg:   'rgba(200,84,26,0.10)',   // translucent — web app style
  orangeBd:   'rgba(200,84,26,0.22)',   // soft border
  orangeSolid:'#FEF0E7',               // for icon backgrounds

  // Gold
  gold:       '#9A6B10',
  gold2:      '#C8960A',
  goldLight:  '#F5D070',
  goldBg:     'rgba(154,107,16,0.10)',
  goldBd:     'rgba(154,107,16,0.22)',
  goldSolid:  '#FDF3D8',

  // Text — web app uses lighter weights
  text:       '#18080A',   // --foreground: oklch(0.22 0.04 50)
  text2:      '#3A1A0A',
  muted:      '#8A6858',   // --muted-foreground: oklch(0.5 0.03 60)
  muted2:     '#C8A898',
  light:      '#F0E8DE',
  border:     '#E8DDD4',   // --border: oklch(0.9 0.018 75) — slightly warmer
  border2:    'rgba(200,160,100,0.15)',

  // Shadows — 3-level system from web app
  shadowCard: 'rgba(100,40,10,0.12)',   // --shadow-card
  shadowSoft: 'rgba(100,40,10,0.18)',   // --shadow-soft
  shadowGlow: 'rgba(200,84,26,0.40)',   // --shadow-glow (orange-tinted)

  // Status
  green:      '#1E6B3A',
  greenBg:    'rgba(30,107,58,0.10)',
  greenBd:    'rgba(30,107,58,0.22)',
  greenSolid: '#E4F3EC',
  red:        '#B02818',
  redBg:      'rgba(176,40,24,0.10)',
  redBd:      'rgba(176,40,24,0.22)',
  redSolid:   '#FAEAE8',
  teal:       '#0E5848',
  tealBg:     'rgba(14,88,72,0.10)',
  tealBd:     'rgba(14,88,72,0.22)',
  purple:     '#4E2480',
  purpleBg:   'rgba(78,36,128,0.10)',
  purpleBd:   'rgba(78,36,128,0.22)',
  blue:       '#183880',
  blueBg:     'rgba(24,56,128,0.10)',
  rose:       '#9A1848',
  roseBg:     'rgba(154,24,72,0.10)',
  star:       '#F0A020',
  dark:       '#1A0E08',
  darkCard:   '#2A1A10',
  darkBd:     '#3A2A20',
};

// ── Typography helpers — web app uses letterSpacing: -0.025em on display
// fontDisplay: use for headings (swap to 'Fraunces_600SemiBold' after install)
const FONT = {
  display: Platform.OS === 'ios' ? 'Georgia' : 'serif',  // fallback until Fraunces installed
  body:    undefined,  // system font
};

// ── Shadow presets — 3 levels
const SHADOW = {
  card:     { elevation:3,  shadowColor:C.shadowCard, shadowOffset:{width:0,height:2},  shadowOpacity:0.12, shadowRadius:6  },
  soft:     { elevation:6,  shadowColor:C.shadowSoft, shadowOffset:{width:0,height:4},  shadowOpacity:0.18, shadowRadius:10 },
  glow:     { elevation:10, shadowColor:C.shadowGlow, shadowOffset:{width:0,height:6},  shadowOpacity:0.38, shadowRadius:16 },
  floating: { elevation:12, shadowColor:'rgba(0,0,0,0.18)', shadowOffset:{width:0,height:-3}, shadowOpacity:0.15, shadowRadius:10 },
};

const PROMOS = {
  'VEGA50':  {type:'pct',  val:50,  label:'50% off — First order'},
  'FIRST20': {type:'pct',  val:20,  label:'20% off — New user'},
  'FLAT100': {type:'flat', val:100, label:'₹100 flat off'},
  'VIZAG20': {type:'pct',  val:20,  label:'20% off — Vizag special'},
  'VEGA2025':{type:'pct',  val:20,  label:'20% off — Welcome offer'},
};

const PROFESSIONALS = [
  {id:'p1',name:'Lakshmi Devi',  rating:4.9,jobs:312,exp:'3 yrs',badge:'Top Rated',initial:'L',color:'#C8541A'},
  {id:'p2',name:'Priya Sharma',  rating:4.8,jobs:247,exp:'2 yrs',badge:'Verified',  initial:'P',color:'#0E5848'},
  {id:'p3',name:'Anitha Rao',    rating:4.9,jobs:189,exp:'2 yrs',badge:'Top Rated',initial:'A',color:'#4E2480'},
  {id:'p4',name:'Sunitha Naidu', rating:4.7,jobs:156,exp:'1 yr', badge:'Verified',  initial:'S',color:'#183880'},
  {id:'p5',name:'Meena Kumari',  rating:5.0,jobs:98, exp:'4 yrs',badge:'Elite Pro', initial:'M',color:'#B02818'},
];

const SERVICES = [
  { id:'home',    name:'Home\nCleaning',  shortName:'Home Cleaning',   icon:'🏠', gradient:['#FF6B35','#C8541A'], shadow:'rgba(200,84,26,0.4)',  iconBg:'#FF8B55', tagline:'Sweeping, mopping & full home clean',       workerLabel:'Cleaners',    badge:'Most Booked',
    durations:[
      { id:'fm_ut', label:'Floor + Mop + Utensils', price:99, mrp:250, popular:true, badge:'MOST BOOKED',
        tasks:['Sweeping all rooms','Wet mopping all floors','Washing all utensils','Kitchen sink quick wipe'],
        note:'Daily favourite — covers floors + utensils in one visit' },
      { id:'fm',    label:'Floor + Mop',              price:89, mrp:149, popular:false,
        tasks:['Sweeping all rooms','Wet mopping all floors','Surface dust on tables'],
        note:'Quick daily floor refresh' },
      { id:'ut',    label:'Utensils Only',            price:59, mrp:99,  popular:false,
        tasks:['Wash all utensils in sink','Wipe stove top after','Clean sink area'],
        note:'Just dishes — fast turnaround' },
      { id:'kb',    label:'Basic Kitchen',            price:39, mrp:59,  popular:false,
        tasks:['Kitchen counter scrub','Sink cleaning & descaling','Stove top wipe'],
        note:'Quick kitchen daily clean' },
      { id:'kc',    label:'Kitchen Cupboard',         price:39, mrp:59,  popular:false,
        tasks:['Cupboard exterior wipe','Handle polish','Door surface clean'],
        note:'Cupboard exterior shine' },
      { id:'st',    label:'Stove Cleaning',           price:39, mrp:59,  popular:false,
        tasks:['Stove top deep scrub','Burner clean','Drip tray wash'],
        note:'Remove built-up grease from stove' },
      { id:'fg',    label:'Refrigerator Cleaning',    price:59, mrp:99,  popular:false,
        tasks:['Interior shelf wipe','Door seal cleaning','Exterior polish','Vegetable tray wash'],
        note:'Interior + exterior fridge refresh' },
    ],
    addons:[
      {id:'fan',       name:'Fan Cleaning',             price:25,  icon:'🌀', desc:'All ceiling fans cleaned'},
      {id:'balcony',   name:'Balcony Cleaning',          price:25,  icon:'🌿', desc:'Sweep + mop balcony'},
      {id:'iron_extra',name:'Iron Extra Clothes',        price:25,  icon:'👔', desc:'Iron up to 10 extra pairs'},
      {id:'dry_hang',  name:'Dry / Hang Clothes',        price:25,  icon:'🧺', desc:'Dry or hang washed clothes'},
      {id:'load_wash', name:'Load Washing Machine',      price:39,  icon:'🌀', desc:'Load + start washing machine'},
      {id:'fridge',    name:'Fridge Cleaning',           price:99,  icon:'❄️', desc:'Interior + exterior clean'},
      {id:'washing_m', name:'Washing Machine Clean',     price:99,  icon:'🫧', desc:'Drum + exterior cleaning'},
      {id:'pack',      name:'Packing + Unpacking',       price:39,  icon:'📦', desc:'Pack or unpack belongings'},
      {id:'party',     name:'After Party Express Clean', price:199, icon:'🎉', desc:'Quick restore after party'},
    ],
    covered:['Mopping & sweeping all rooms','Kitchen counter & utensil cleaning','Surface dusting — tables, shelves','Clothes folding and ironing (included in 2hr & 3hr)','Bathroom exterior wipe (not deep clean)'],
    notCovered:['Bathroom deep cleaning — book Bathroom Cleaning separately','Outside window glass cleaning','Sofa or carpet cleaning — book separately','Moving heavy furniture','Pest control or repairs','Cooking or food preparation'],
  },
  { id:'bathroom', name:'Bathroom\nCleaning', shortName:'Bathroom Cleaning', icon:'🚿', gradient:['#2C88D9','#183880'], shadow:'rgba(24,56,128,0.4)', iconBg:'#4A98E8', tagline:'Deep scrub — tiles, commode, mirror & taps', workerLabel:'Cleaners', badge:'High Demand',
    durations:[
      { id:'b1', hrs:1, label:'1 Bathroom', price:149, mrp:299, popular:true,
        tasks:[
          'Toilet scrubbing and disinfection with Harpic',
          'Wash basin cleaning and polishing',
          'Floor scrubbing and mopping',
          'Mirror cleaning with Colin spray (streak-free finish)',
          'Wall tiles wiping and cleaning',
          'Tap and fitting polishing',
          'Exhaust fan cleaning',
          'Dustbin cleaning and sanitization',
          'Final smell check — bathroom smells of Harpic when done',
        ],
        notIncluded:[
          'Bathroom renovation or painting',
          'Plumbing repairs or unclogging',
          'Geyser or water heater repairs',
          'Waterproofing or tile work',
          'Outside the bathroom area',
        ],
        note:'1 bathroom — complete deep clean',
      },
      { id:'b2', hrs:2, label:'2 Bathrooms', price:249, mrp:499, popular:false,
        tasks:[
          'Both toilets scrubbed and disinfected with Harpic',
          'Both wash basins cleaned and polished',
          'Both bathroom floors scrubbed and mopped',
          'Both mirrors cleaned with Colin (streak-free)',
          'All wall tiles in both bathrooms wiped',
          'All taps and fittings in both bathrooms polished',
          'Both exhaust fans cleaned',
          'Both dustbins cleaned and sanitized',
          'Final smell check on both bathrooms',
        ],
        notIncluded:[
          'Bathroom renovation or painting',
          'Plumbing repairs or unclogging',
          'Geyser or water heater repairs',
          'Waterproofing or tile work',
          'Outside the bathroom area',
        ],
        note:'2 bathrooms — every item done in both',
      },
      { id:'b3', hrs:3, label:'3+ Bathrooms', price:349, mrp:699, popular:false,
        tasks:[
          'All 3+ toilets scrubbed and disinfected with Harpic',
          'All wash basins cleaned and polished',
          'All bathroom floors scrubbed and mopped',
          'All mirrors cleaned with Colin (streak-free)',
          'All wall tiles in every bathroom wiped',
          'All taps and fittings polished',
          'All exhaust fans cleaned',
          'All dustbins cleaned and sanitized',
          'Final smell check — all bathrooms',
        ],
        notIncluded:[
          'Bathroom renovation or painting',
          'Plumbing repairs or unclogging',
          'Geyser or water heater repairs',
          'Waterproofing or tile work',
          'Outside the bathroom area',
        ],
        note:'3 or more bathrooms',
      },
    ],
    addons:[{id:'descale',name:'Hard Water Descaling',price:49,icon:'💧',desc:'Remove yellow stains'},{id:'exhaust',name:'Exhaust Fan Clean (extra)',price:29,icon:'🌀',desc:'Additional exhaust fans beyond bathrooms'}],
    covered:['Toilet/commode inside & outside — deep scrub with Harpic','Wall & floor tiles — scrubbed clean','Mirror — streak-free polish with Colin','Taps & fittings — polished','Wash basin — cleaned & polished','Exhaust fan cleaning','Dustbin cleaning & sanitization'],
    notCovered:['Bathroom renovation or painting','Plumbing repairs or unclogging','Geyser or water heater repairs','Waterproofing or tile work','Areas outside the bathroom'],
  },
  { id:'kitchen', name:'Kitchen\nCleaning',shortName:'Kitchen', icon:'🍳',gradient:['#E87030','#A84A10'],shadow:'rgba(168,74,16,0.4)',iconBg:'#E88040',tagline:'Stove, chimney, counters & sink',workerLabel:'Cleaners',badge:null,
    durations:[
      {id:'k1',hrs:1,label:'Basic',   price:99, mrp:199,popular:false,tasks:['Kitchen counter scrub','Sink cleaning & descaling','Stove top & burners cleaned','Cabinet exterior wipe'],note:'Quick clean — daily maintenance'},
      {id:'k2',hrs:2,label:'Standard',price:199,mrp:399,popular:true, tasks:['Kitchen counter scrub','Sink cleaning & descaling','Stove top & burners cleaned','Cabinet exterior wipe','Chimney exterior cleaning','Tiles wipe-down'],note:'Best for weekly cleaning'},
      {id:'k3',hrs:3,label:'Deep',    price:299,mrp:599,popular:false,tasks:['All Standard tasks','Chimney filter/mesh deep clean','Inside cabinet cleaning (empty, wipe, refill)','Gas stove deep degrease','Floor degreasing & mop'],note:'Monthly deep clean — remove built-up grease'},
    ],
    addons:[
      {id:'inside_cab',name:'Inside Cabinets',  price:49, icon:'🗄️',desc:'Empty + deep wipe + replace'},
      {id:'microwave',  name:'Microwave Clean',  price:49, icon:'📡',desc:'Interior + exterior deep clean'},
      {id:'chimney_f',  name:'Chimney Filter',   price:99, icon:'🔧',desc:'Filter/mesh removed & cleaned'},
    ],
    covered:['Stove burners & top','Counter scrub','Sink descaling & shine','Cabinet exterior','Chimney exterior','Kitchen floor mopping'],
    notCovered:['Gas pipe repair or replacement','Plumbing issues','Pest control','Electrical appliance repair','Inside refrigerator (book Fridge add-on separately)'],
  },
  { id:'car', name:'Car\nCleaning', shortName:'Car Cleaning', icon:'🚗', gradient:['#18A888','#0E5848'], shadow:'rgba(14,88,72,0.4)', iconBg:'#28C8A8', tagline:'Dry waterless cleaning — no water spraying', workerLabel:'Detailers', badge:'Eco Friendly',
    // carType: 'hatchback' | 'sedan' | 'suv'  — selected dynamically in step1
    carPricing:{
      single:   {hatchback:100, sedan:130, suv:160},
      weekly:   {hatchback:299, sedan:399, suv:399},
      monthly:  {hatchback:499, sedan:649, suv:649},
    },
    carExamples:{
      hatchback:'Swift, Alto, i10, WagonR, Baleno',
      sedan:    'City, Verna, Ciaz, Dzire',
      suv:      'Creta, Seltos, Brezza, XUV300',
    },
    durations:[
      { id:'c1', label:'Single Clean (Outer Body)', price:100, mrp:200, popular:false,
        duration:'20–30 mins',
        tasks:['Full outer body cleaning (doors, bonnet, boot)','All headlights & tail lights cleaned and shiny','All mirrors cleaned (streak-free)','Tyre surface wiped and cleaned','Window glass cleaned (outer side)','Number plate cleaned'],
        note:'Exterior only — great for a quick refresh',
      },
      { id:'c2', label:'Weekly Cleaning (Outer × 4/month)', price:299, mrp:499, popular:true,
        duration:'20–30 mins per visit',
        tasks:['Everything in Single Clean × 4 times per month','Same professional each visit','Same day & time every week (you choose once)','Automatic scheduling — no need to book each week'],
        note:'Full month upfront — hassle-free weekly service',
      },
      { id:'c3', label:'Monthly Premium (Outer + Inner)', price:499, mrp:799, popular:false,
        duration:'Outer 20–30 min · Inner 60 min (once)',
        tasks:['Outer body cleaning every week (4 visits/month)','1 inner cabin deep clean per month','Dashboard wiped & polished','All seats wiped','Door panels cleaned','Floor mats cleaned','Centre console wiped','Tyre cleaning every outer visit'],
        note:'Full month upfront — complete premium care',
      },
    ],
    addons:[],
    covered:['Full outer body (dry/waterless method)','Headlights, tail lights, mirrors','Tyres & number plate','Outer window glass','Inner cabin (Monthly Premium package only)'],
    notCovered:['Water spraying — we use waterless method only','Inside cabin cleaning (Single / Weekly packages)','Under the car or engine bay','Dent or scratch repair','AC gas or servicing','Moving your car from parking'],
  },
  { id:'sofa',    name:'Sofa\nCleaning', shortName:'Sofa Clean', icon:'🛋️',gradient:['#7840C8','#4E2480'],shadow:'rgba(78,36,128,0.4)',iconBg:'#9860E0',tagline:'Foam clean, stain removal & deodorize',workerLabel:'Specialists',badge:null,
    durations:[
      {id:'s1',hrs:1,label:'2-Seater',price:249,mrp:449,popular:false,tasks:['Foam extraction cleaning','Stain pre-treatment & removal','Deodorize with fresh spray','Surface dry — ready in 2 hours'],note:'2-seater or small sofa'},
      {id:'s2',hrs:2,label:'3-Seater',price:349,mrp:649,popular:true, tasks:['Foam extraction cleaning','Stain pre-treatment & removal','Deodorize with fresh spray','Cushion covers cleaned','Surface dry — ready in 2 hours'],note:'Standard 3-seater sofa'},
      {id:'s3',hrs:3,label:'Full Set', price:599,mrp:999,popular:false,tasks:['All sofa seats in living room','Foam extraction + stain removal','All cushion covers cleaned','Carpet or rug cleaning included','Deodorize entire living room'],note:'All sofas + carpet — full living room'},
    ],
    addons:[
      {id:'carpet',  name:'Carpet Cleaning',  price:199,icon:'🏡',desc:'Full carpet shampoo + dry'},
      {id:'mattress',name:'Mattress Clean',   price:149,icon:'🛏️',desc:'Vacuum + sanitize + deodorize'},
      {id:'chair',   name:'Chair Cleaning',   price:99, icon:'🪑',desc:'Per dining/desk chair'},
    ],
    covered:['Foam extraction (professional machine)','Stain pre-treatment','All visible surface stains','Deodorizing & fresh spray','Cushion top cleaning','Surface dry within 2 hours'],
    notCovered:['Torn or ripped fabric repair','Wooden frame polishing or repair','Structural damage','Pet urine deep saturation (may need extra session)','Antique or leather sofas (call us first)'],
  },
  { id:'beauty',  name:'Beauty\nCare',   shortName:'Beauty Care',icon:'💆',gradient:['#D03878','#9A1848'],shadow:'rgba(154,24,72,0.4)', iconBg:'#E85898',tagline:'Salon services at your doorstep',workerLabel:'Beauticians',badge:'Women Loved',
    durations:[
      {id:'be1',hrs:1,label:'Basic Facial',   price:149, mrp:299, popular:false,tasks:['Skin cleansing','Scrub & exfoliation','Face pack — Lotus or Biotique products','Moisturizer application'],note:'45 minutes — everyday glow'},
      {id:'be2',hrs:2,label:'Glow Facial',    price:299, mrp:499, popular:true, tasks:['Skin cleansing & toning','D-tan pack — remove tan & pigmentation','Glow pack application','Face massage — 10 minutes','Moisturizer + sunscreen finish'],note:'60 min — D-tan + visible glow'},
      {id:'be3',hrs:4,label:'Bridal Package', price:1499,mrp:2499,popular:false,tasks:['Full bridal makeup — HD foundation','Hair styling — bun or open style','Eyebrow threading & shaping','Full body waxing','Manicure + pedicure','Mehndi (optional, discuss in advance)'],note:'4 hours — complete bridal preparation'},
    ],
    addons:[
      {id:'wax',      name:'Full Body Wax',    price:499,icon:'✨',desc:'Premium cold or warm wax'},
      {id:'mani_pedi',name:'Mani + Pedi',      price:179,icon:'💅',desc:'Nail care + scrub + massage'},
      {id:'threading',name:'Full Face Thread', price:79, icon:'🧵',desc:'Eyebrow + upper lip + forehead'},
      {id:'haircut',  name:'Haircut + Blowdry',price:299,icon:'✂️',desc:'Wash + cut + blowdry + style'},
    ],
    covered:['Facial & skincare','Threading & shaping','Haircut & blowdry','Waxing (book add-on)','Manicure & pedicure (book add-on)','Bridal preparation'],
    notCovered:['Hair color or highlights — book separately','Rebonding or keratin treatment','Medical skin treatments','Acne extraction or derma procedures','Any service requiring salon-only equipment'],
  },
  { id:'deep',    name:'Deep\nCleaning', shortName:'Deep Clean', icon:'✨',gradient:['#D84020','#901810'],shadow:'rgba(144,24,16,0.4)', iconBg:'#E86050',tagline:'Complete home transformation',workerLabel:'Specialists',badge:'Premium',
    durations:[
      {id:'d1',hrs:4,label:'1 BHK',price:799, mrp:1499,popular:false,tasks:['All rooms — mop, sweep, dust','Kitchen counter + stove + chimney exterior','Bathroom deep clean — tiles, commode, mirror','All fans & light fixtures','Behind fridge & washing machine','Inside wardrobes exterior wipe'],note:'4 hours — complete 1 BHK transformation'},
      {id:'d2',hrs:6,label:'2 BHK',price:1199,mrp:2199,popular:true, tasks:['All 1 BHK tasks × 2 bedrooms + hall','2 full bathrooms deep clean','Kitchen full deep clean','Balcony sweep & mop','All fans & AC filter exterior','Sofa exterior dusting'],note:'6 hours — complete 2 BHK — most popular'},
      {id:'d3',hrs:8,label:'3 BHK',price:1599,mrp:2999,popular:false,tasks:['All 2 BHK tasks × 3 bedrooms','3 bathrooms deep clean','Full kitchen including chimney filter','2 balconies','All windows exterior wipe','Full sofa exterior dusting + cushions'],note:'8 hours — complete 3 BHK transformation'},
    ],
    addons:[
      {id:'pest', name:'Pest Control',     price:299,icon:'🐛',desc:'Cockroach + ant + mosquito treatment'},
      {id:'water',name:'Water Tank Clean', price:499,icon:'💧',desc:'Tank scrub + disinfect'},
      {id:'sofa_d',name:'Sofa Deep Clean', price:349,icon:'🛋️',desc:'Add sofa foam extraction'},
    ],
    covered:['Every room — floor, walls, surfaces','Kitchen deep clean','Bathroom deep clean','Fan blades & light fixtures','Behind and under heavy appliances','Inside cupboard exterior','Balcony cleaning'],
    notCovered:['Exterior walls or compound area','Terrace or garden cleaning','Swimming pool','Pest control — book as add-on','Painting, plumbing or electrical work','Car cleaning — book separately'],
  },
  { id:'elder',   name:'Elder\nCare',    shortName:'Elder Care',  icon:'❤️',gradient:['#E04848','#B02818'],shadow:'rgba(176,40,24,0.4)', iconBg:'#E86868',tagline:'Compassionate care for your parents',workerLabel:'Caregivers',badge:'Trusted',
    durations:[
      {id:'e1',hrs:4, label:'4 Hours',  price:499,mrp:799, popular:false,tasks:['Companionship & conversation','Medication reminder at correct time','Light meal preparation or serving','Basic hygiene assistance if needed','Reading, TV, gentle walk — as preferred'],note:'Half day care — ideal for working hours'},
      {id:'e2',hrs:8, label:'Full Day', price:799,mrp:1299,popular:true, tasks:['All 4-hour tasks — full day','Breakfast + lunch + evening snacks help','Medication tracking & reminders','Hygiene assistance — bathing, dressing help','Doctor or hospital escort if needed','Emergency contact on standby'],note:'Full day 8hrs — peace of mind for families'},
      {id:'e3',hrs:10,label:'Night Care',price:699,mrp:1099,popular:false,tasks:['Night companionship & safety watch','Medication reminder (night dose)','Assist with toilet trips safely','Emergency response + contact family','Light morning help before day shift'],note:'10pm – 8am overnight care'},
    ],
    addons:[
      {id:'physio',name:'Physiotherapy',    price:399,icon:'🏥',desc:'Certified physio home visit'},
      {id:'doctor',name:'Doctor Escort',    price:199,icon:'👨‍⚕️',desc:'Accompany to hospital/clinic'},
      {id:'nurse', name:'Nurse Visit',      price:499,icon:'💊',desc:'Registered nurse home visit'},
    ],
    covered:['Companionship & emotional support','Medication reminders (not injections)','Meal preparation assistance','Basic hygiene assistance','Emergency contact & family updates','Doctor escort (as add-on)'],
    notCovered:['Medical procedures or injections','IV drips or clinical nursing','Lifting very heavy patients (inform us in advance)','Overnight care (book Night Care separately)','Cooking full meals from scratch (light meal help only)'],
  },
];

const AREAS=['Madhurawada','Rushikonda','MVP Colony','Dwaraka Nagar','Kommadi','Seethammadhara','Gajuwaka','Pendurthi','Waltair','Siripuram'];

// ── INDIVIDUAL TASK CARDS (Pronto-style, tap + to add multiple) ──
const TASKS = [
  {id:'t_fan', name:'Fan Cleaning', price:25, mrp:75, icon:'🌀', color:'#4A98E8', desc:'Per ceiling fan cleaned', unit:'fan',
    includes:['Dust removal from fan blades','Wiping blade surfaces with damp cloth','Cleaning fan motor housing exterior','Wiping visible light fixtures attached','Basic polish for a clean finish'],
    excludes:['Electrical rewiring or motor repair','Dismantling fan for deep clean','Removing blades from shaft','Work on fans above 12 feet height','Replacing bulbs or capacitors']},
  {id:'t_fridge', name:'Fridge Cleaning', price:149, mrp:249, icon:'❄️', color:'#4A98E8', desc:'Interior + exterior clean', unit:'fridge',
    includes:['Switching off fridge safely before work','Removing all food items aside carefully','Cleaning shelves, trays, drawers, door bins','Wiping inner walls and rubber door lining','Basic deodorising of fridge interior','Cleaning exterior front and side panels','Replacing food items neatly back'],
    excludes:['Moving or lifting the refrigerator','Cleaning back panel or condenser coils','Repair or servicing of the fridge','Deep freezer defrosting (takes hours)','Disposing garbage outside the home','Handling meat or raw seafood for hygiene']},
  {id:'t_pack', name:'Packing or Unpacking', price:49, mrp:125, icon:'📦', color:'#1E6B3A', desc:'Organise clothes, kitchen & more', unit:'session',
    includes:['Packing or unpacking clothes, shoes, linens','Packing or unpacking kitchen items and groceries','Folding and organising items before packing','Placing items into boxes, suitcases, cupboards','Labelling boxes (room-wise or item-wise)','Light dusting before placing items back','Basic organisation using existing storage'],
    excludes:['Heavy lifting or moving of furniture','Carrying boxes up or down stairs','Handling jewellery, cash, documents, valuables','Packing fragile antiques or artwork','Furniture dismantling or assembly']},
  {id:'t_kprep', name:'Kitchen Prep', price:49, mrp:125, icon:'🥘', color:'#E88040', desc:'Veggie chop, meat marinate, salad prep', unit:'session',
    includes:['Vegetable chopping and salad preparation','Meat marination as per your instructions','Serving food to family members','Basic mise-en-place (preparation before cooking)','Washing vegetables thoroughly before prep'],
    excludes:['Cooking full meals from scratch','Specialised cuisine preparation','Handling raw seafood or exotic meats','Baking or dessert preparation','Storing prepared food for long-term']},
  {id:'t_dust', name:'Dusting & Wiping', price:49, mrp:125, icon:'🧹', color:'#9860E0', desc:'Shelves, furniture, tables, decor', unit:'session',
    includes:['Dusting shelves and furniture surfaces','Wiping counters, tables, and decor items','Cleaning window sills and grills (reachable)','Removing accessible cobwebs','Wiping appliance exteriors'],
    excludes:['Dusting ceilings or very high areas','Using unstable stools or ladders','Handling chandeliers or fragile items','Cleaning exterior grills or outside windows','Stain removal or restoration work']},
  {id:'t_iron', name:'Ironing & Folding', price:25, mrp:125, icon:'👔', color:'#9860E0', desc:'Per 10 clothes ironed & folded', unit:'set of 10',
    includes:['Sorting clothes for ironing','Ironing regular daily wear clothes','Folding clothes neatly after ironing','Arranging clothes in stacks','Basic tidying of ironing area after work'],
    excludes:['Ironing delicate silks or expensive fabrics','Handling biohazard-stained clothes','Cleaning the washing machine or iron','Advanced stain treatment','Hand washing bed sheets or footwear']},
  {id:'t_window', name:'Window Cleaning', price:25, mrp:125, icon:'🪟', color:'#2C88D9', desc:'Per window — streak-free shine', unit:'window',
    includes:['Inside glass wipe — streak-free finish','Window sill cleaning','Grill dust removal (reachable)','Window frame wiping','Final polish with dry cloth'],
    excludes:['Outside glass of high-floor windows','Work requiring ladders or safety harness','Broken glass replacement or repair','Cleaning curtains or blinds','Exterior grill painting or restoration']},
  {id:'t_utensils', name:'Utensils Washing', price:49, mrp:99, icon:'🍽️', color:'#E88040', desc:'All utensils washed & dried', unit:'session',
    includes:[
      'Scrubbing and cleaning all utensils (plates, cups, bowls, glasses)',
      'Scrubbing pots, pans, pressure cookers, kadai',
      'Cleaning the kitchen sink thoroughly',
      'Cleaning all burners on the stove',
      'Wiping the stove top surface',
      'Leaving the sink area clean and completely dry',
      'Cleaning any dishes left soaking',
    ],
    excludes:[
      'Cooking or food preparation',
      'Buying cleaning supplies or soap',
      'Washing clothes or other items',
      'Moving heavy appliances or furniture',
      'Appliance repair or servicing',
      'Items outside the kitchen sink area',
    ]},
  {id:'t_sofa', name:'Sofa Cleaning', price:249, mrp:449, icon:'🛋️', color:'#9860E0', desc:'Foam clean + stain removal', unit:'sofa',
    includes:['Foam extraction cleaning (professional method)','Stain pre-treatment and removal','Cushion top surface cleaning','Deodorizing with fresh spray','Surface dry within 2 hours'],
    excludes:['Torn or ripped fabric repair','Wooden frame polishing or repair','Structural damage fixes','Pet urine deep saturation (may need extra session)','Antique or leather sofas (call us first)']},
  {id:'t_party', name:'After Party Clean', price:199, mrp:375, icon:'🎉', color:'#D03878', desc:'Express post-party restore', unit:'session',
    includes:['Clearing leftover food and plates','Mopping and sweeping all party areas','Taking out garbage and bottles','Wiping tables, counters, and surfaces','Basic bathroom quick clean'],
    excludes:['Deep carpet stain removal','Vomit or biohazard waste cleanup','Broken glass collection without safety gear','Wall stain or marker removal','Furniture polish or restoration']},
  {id:'t_wm', name:'Washing Machine Clean', price:99, mrp:199, icon:'🫧', color:'#183880', desc:'Drum + exterior cleaning', unit:'machine',
    includes:['Cleaning drum interior','Wiping rubber gasket thoroughly','Cleaning detergent drawer','Exterior wipe-down of machine','Running a cleaning cycle with cleaner'],
    excludes:['Repair of motor or electronic parts','Drainage pipe deep unclog','Descaling very old heavy buildup','Moving the machine from position','Any servicing needing dismantling']},
];

// ─── COMING SOON — not yet operational ──────────────────────────────────────
const COMING_SOON_TASKS = [
  {id:'cs_chimney',  name:'Chimney Cleaning',  emoji:'🔧', color:'#A84A10', desc:'Deep filter & mesh cleaning'},
  {id:'cs_mattress', name:'Mattress Cleaning',  emoji:'🛏️', color:'#4E2480', desc:'Vacuum + sanitize + deodorize'},
  {id:'cs_sofa_deep',name:'Sofa Deep Cleaning', emoji:'🛋️', color:'#9860E0', desc:'Foam extraction & stain removal'},
];

// ─── HOME CLEANING: 7 Task-Based Packages ────────────────────────────────────
const HOME_PACKAGES = [
  { id:'hp1',
    name:'Floor Cleaning + Wet Mopping + Utensils',
    icon:'https://img.icons8.com/3d-fluency/128/broom.png',
    emoji:'🧹',
    desc:'Sweeping all rooms, wet mopping all floors, washing all utensils and dishes, cleaning sink',
    mrp:250, price:99, popular:true, badge:'MOST BOOKED', color:'#C8541A', canSubscribe:true,
    includes:['Sweeping all rooms','Wet mopping all floors','Washing all utensils and dishes','Cleaning kitchen sink thoroughly','Leaving sink area clean and dry'],
  },
  { id:'hp2',
    name:'Floor Cleaning + Wet Mopping',
    icon:'https://img.icons8.com/3d-fluency/128/mop.png',
    emoji:'🧺',
    desc:'Sweeping all rooms and wet mopping all floors',
    mrp:149, price:69, popular:false, badge:null, color:'#2C88D9', canSubscribe:true,
    includes:['Sweeping all rooms','Wet mopping all floors with clean water'],
  },
  { id:'hp3',
    name:'Utensils Cleaning Only',
    icon:'https://img.icons8.com/3d-fluency/128/dishwasher.png',
    emoji:'🍽️',
    desc:'Washing all utensils, scrubbing pots and pans, cleaning sink, leaving sink area dry',
    mrp:99, price:59, popular:false, badge:null, color:'#E87030', canSubscribe:false,
    includes:['Washing all utensils (plates, cups, bowls, glasses)','Scrubbing pots, pans, pressure cooker, kadai','Cleaning kitchen sink thoroughly','Leaving sink area clean and completely dry','Cleaning dishes left soaking'],
  },
  { id:'hp4',
    name:'Basic Kitchen Cleaning',
    icon:'https://img.icons8.com/3d-fluency/128/kitchen.png',
    emoji:'🍳',
    desc:'Wiping countertops, cleaning visible surfaces, basic tidying of kitchen area',
    mrp:59, price:25, popular:false, badge:null, color:'#A84A10', canSubscribe:false,
    includes:['Wiping all countertops','Cleaning visible surfaces','Basic tidying of kitchen area'],
  },
  { id:'hp5',
    name:'Kitchen Cupboard Cleaning',
    icon:'https://img.icons8.com/3d-fluency/128/cupboard.png',
    emoji:'🗄️',
    desc:'Wiping cupboard exteriors, removing dust, cleaning handles and knobs',
    mrp:59, price:25, popular:false, badge:null, color:'#4E2480', canSubscribe:false,
    includes:['Wiping cupboard exteriors','Removing dust from top and sides','Cleaning handles and knobs'],
  },
  { id:'hp6',
    name:'Stove Cleaning',
    icon:'https://img.icons8.com/3d-fluency/128/gas-stove.png',
    emoji:'🔥',
    desc:'Cleaning all burners, wiping stove top, removing grease and food residue',
    mrp:59, price:25, popular:false, badge:null, color:'#D84020', canSubscribe:false,
    includes:['Cleaning all burners','Wiping stove top surface','Removing grease and food residue'],
  },
  { id:'hp7',
    name:'Refrigerator Cleaning',
    icon:'https://img.icons8.com/3d-fluency/128/fridge.png',
    emoji:'❄️',
    desc:'Wiping exterior and door seals, cleaning top, basic interior wipe, cleaning handle',
    mrp:99, price:59, popular:false, badge:null, color:'#183880', canSubscribe:false,
    includes:['Wiping exterior surfaces','Cleaning door seals and gaskets','Cleaning top of fridge','Basic interior wipe','Cleaning handle'],
  },
];
const getDates=()=>{const D=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],t=new Date();return Array.from({length:7},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()+i);const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return{label:i===0?'Today':i===1?'Tomorrow':D[d.getDay()],num:d.getDate(),mon:M[d.getMonth()],iso};});};
const TIMES=['8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'];

// ════════════════════════════════════════════════════════════════
// PREMIUM REUSABLE COMPONENTS
// ════════════════════════════════════════════════════════════════

// Display text — uses serif font for premium headlines
const DText = ({ children, style, ...props }) => (
  <Text style={[{ fontFamily: FONT.display, letterSpacing: -0.4 }, style]} {...props}>
    {children}
  </Text>
);

// Premium Card — web app shadow-card level
const Card = ({ children, style, shadow = 'card', glow }) => (
  <View style={[{
    backgroundColor: C.card,
    borderRadius: 20,           // ✅ upgrade: 14→20
    padding: 16,
    borderWidth: 0.5,
    borderColor: glow ? C.orangeBd : C.border2,
    ...SHADOW[shadow],
  }, style]}>
    {children}
  </View>
);

// Soft badge — web app translucent style  ✅ upgrade: solid→translucent
const Badge = ({ label, color = C.orange, bgColor, bdColor, style }) => (
  <View style={[{
    backgroundColor: bgColor || `${color}18`,
    borderWidth: 0.5,
    borderColor: bdColor || `${color}35`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  }, style]}>
    <Text style={{ fontSize: 10, fontWeight: '600', color, letterSpacing: 0.3 }}>
      {label}
    </Text>
  </View>
);

// Bill row
const BR = ({ l, r, rc, bold }) => (
  <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:8 }}>
    <Text style={{ color:C.muted, fontSize:13, flex:1 }} numberOfLines={1}>{l}</Text>
    <Text style={{ fontWeight:bold?'800':'600', color:rc||C.text, fontSize:13 }}>{r}</Text>
  </View>
);

const StarRating = ({ rating, onRate, size=28 }) => (
  <View style={{ flexDirection:'row', gap:6 }}>
    {[1,2,3,4,5].map(n=>(
      <TouchableOpacity key={n} onPress={()=>onRate&&onRate(n)}>
        <Text style={{ fontSize:size, color:n<=rating?C.star:'#DDD' }}>{n<=rating?'★':'☆'}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// ✅ UPGRADE 2: 3D Icon with real Icons8 Fluency images
const Icon3D = ({ svc, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue:0.9, useNativeDriver:true, speed:60 }),
      Animated.spring(scaleAnim, { toValue:1,   useNativeDriver:true, speed:60 }),
    ]).start(() => onPress?.());
  };
  const sz = COL - 8;
  const iconUri = svcImgSource(svc.id);
  return (
    <TouchableOpacity activeOpacity={1} onPress={handlePress} style={{ width:COL, alignItems:'center', marginBottom:20 }}>
      <Animated.View style={{ transform:[{ scale:scaleAnim }], alignItems:'center' }}>
        {/* Drop shadow layer */}
        <View style={{ width:sz-2, height:sz-2, borderRadius:22, backgroundColor:svc.shadow.replace('0.4)','0.20)'), position:'absolute', top:6, left:2 }}/>
        {/* Main card */}
        <View style={{
          width:sz-2, height:sz-2, borderRadius:22,
          backgroundColor:svc.iconBg,
          alignItems:'center', justifyContent:'center',
          borderBottomWidth:4, borderRightWidth:2,
          borderBottomColor:svc.gradient[1],
          borderRightColor:svc.gradient[1]+'80',
          borderTopWidth:1, borderLeftWidth:1,
          borderTopColor:'rgba(255,255,255,0.55)',
          borderLeftColor:'rgba(255,255,255,0.35)',
          ...SHADOW.soft,
          shadowColor: svc.gradient[1],
        }}>
          {/* Top-left shine */}
          <View style={{ position:'absolute', top:7, left:7, width:sz*0.44, height:sz*0.32, borderRadius:12, backgroundColor:'rgba(255,255,255,0.28)' }}/>
          {iconUri
            ? <Image source={iconUri} style={{ width:sz*0.58, height:sz*0.58 }} resizeMode="contain"/>
            : <Text style={{ fontSize:sz*0.42, lineHeight:sz*0.52 }}>{svc.icon}</Text>}
        </View>
        {/* Star badge */}
        {svc.badge && (
          <View style={{ position:'absolute', top:-7, right:0, backgroundColor:C.gold2, paddingHorizontal:5, paddingVertical:2, borderRadius:8, elevation:3 }}>
            <Text style={{ color:'#FFF', fontSize:7, fontWeight:'800' }}>★</Text>
          </View>
        )}
        <Text style={{ fontSize:10, fontWeight:'600', color:C.text2, textAlign:'center', marginTop:8, lineHeight:13, width:COL-4 }}>{svc.name}</Text>
        <Text style={{ fontSize:10, color:svc.gradient[0], fontWeight:'800', marginTop:2 }}>₹{svc.durations[0].price}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Step indicator
const StepBar = ({ step, total=4, labels }) => (
  <View style={{ paddingHorizontal:16, paddingVertical:10, backgroundColor:C.white, borderBottomWidth:0.5, borderBottomColor:C.border2 }}>
    <View style={{ flexDirection:'row', alignItems:'center' }}>
      {Array.from({length:total},(_,i)=>(
        <React.Fragment key={i}>
          <View style={{ alignItems:'center' }}>
            <View style={{
              width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center',
              backgroundColor:i<step?C.orange:i===step?C.orange:C.light,
              ...( i<=step ? SHADOW.glow : {}),
            }}>
              {i<step
                ?<Text style={{color:'#FFF',fontSize:13,fontWeight:'900'}}>✓</Text>
                :<Text style={{color:i===step?'#FFF':C.muted,fontSize:12,fontWeight:'700'}}>{i+1}</Text>}
            </View>
            {labels&&<Text style={{fontSize:8,color:i<=step?C.orange:C.muted2,marginTop:3,textAlign:'center',width:56,fontWeight:i===step?'700':'400'}}>{labels[i]}</Text>}
          </View>
          {i<total-1&&<View style={{flex:1,height:2,backgroundColor:i<step?C.orange:C.border,marginHorizontal:2,marginBottom:labels?14:0}}/>}
        </React.Fragment>
      ))}
    </View>
  </View>
);

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════

// ── Mock Payment Modal (replace with real Razorpay when keys available) ──────
const MockPayModal = ({ visible, amount, method, onSuccess }) => {
  const [step, setStep] = React.useState(0); // 0=processing, 1=success
  React.useEffect(() => {
    if (!visible) { setStep(0); return; }
    const t = setTimeout(() => setStep(1), 2400);
    return () => clearTimeout(t);
  }, [visible]);
  const label = { upi:'UPI / GPay', card:'Debit / Credit Card', netbanking:'Net Banking' }[method] || method;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.65)',alignItems:'center',justifyContent:'center',padding:32}}>
        <View style={{backgroundColor:'#FFF',borderRadius:24,padding:32,width:'100%',alignItems:'center',shadowColor:'#000',shadowOpacity:0.25,shadowRadius:20,elevation:12}}>
          {step===0?(
            <>
              <ActivityIndicator size="large" color="#F97316" style={{marginBottom:18}}/>
              <Text style={{fontWeight:'700',fontSize:17,color:'#18080A',marginBottom:6}}>Processing Payment…</Text>
              <Text style={{color:'#9D6A47',fontSize:14}}>₹{amount} via {label}</Text>
              <Text style={{color:'#C4A07A',fontSize:11,marginTop:10}}>Please do not press back</Text>
            </>
          ):(
            <>
              <View style={{width:68,height:68,borderRadius:34,backgroundColor:'#DCFCE7',alignItems:'center',justifyContent:'center',marginBottom:16}}>
                <Text style={{fontSize:34}}>✓</Text>
              </View>
              <Text style={{fontWeight:'800',fontSize:19,color:'#18080A',marginBottom:4}}>Payment Successful!</Text>
              <Text style={{color:'#4A8A2A',fontSize:14,marginBottom:26}}>₹{amount} paid via {label}</Text>
              <TouchableOpacity onPress={onSuccess}
                style={{backgroundColor:'#F97316',paddingHorizontal:36,paddingVertical:15,borderRadius:28,shadowColor:'#F97316',shadowOpacity:0.45,shadowRadius:8,elevation:6}}>
                <Text style={{color:'#FFF',fontWeight:'700',fontSize:16}}>Continue to Booking →</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default function App() {
  const [screen,        setScreen]        = useState('splash');
  const [tab,           setTab]           = useState('home');
  const [phone,         setPhone]         = useState('');
  const [otpVal,        setOtpVal]        = useState('');
  const [uname,         setUname]         = useState('');
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [confirm,       setConfirm]       = useState(null);
  const [showSearch,    setShowSearch]    = useState(false);
  const [search,        setSearch]        = useState('');
  const [notifCount,    setNotifCount]    = useState(2);
  const [selSvc,        setSelSvc]        = useState(null);
  const [selDur,        setSelDur]        = useState(null);
  const [bookMode,      setBookMode]      = useState('instant');
  const [selAddons,     setSelAddons]     = useState([]);
  const [selDate,       setSelDate]       = useState(0);
  const [selTime,       setSelTime]       = useState(null);
  const [recurFreq,     setRecurFreq]     = useState('Weekly');
  const [selArea,       setSelArea]       = useState('Madhurawada');
  const [flat,          setFlat]          = useState('');
  const [buildingName,  setBuildingName]  = useState('');
  const [streetName,    setStreetName]    = useState('');
  const [landmark,      setLandmark]      = useState('');
  const [showArea,      setShowArea]      = useState(false);
  const [showTerms,     setShowTerms]     = useState(false);
  const [selPayMethod,  setSelPayMethod]  = useState('upi');
  const [showPayModal,  setShowPayModal]  = useState(false);
  const [cart,          setCart]          = useState([]);
  const [promoCode,     setPromoCode]     = useState('');
  const [appliedPromo,  setAppliedPromo]  = useState(null);
  const [wallet,        setWallet]        = useState(0);    // Bug 2: NOT 200 — only real signups get bonus
  const [useWallet,     setUseWallet]     = useState(false);
  const [orders,        setOrders]        = useState([]);
  const [ordersUnsub,   setOrdersUnsub]   = useState(null);
  const [taskCart,      setTaskCart]      = useState({}); // {taskId: count}
  const [activeTask,    setActiveTask]    = useState(null); // for task detail screen
  const [placing,       setPlacing]       = useState(false);
  const [trackOrd,      setTrackOrd]      = useState(null);
  const [ratingOrd,     setRatingOrd]     = useState(null);
  const [userRating,    setUserRating]    = useState(0);
  const [ratingNote,    setRatingNote]    = useState('');
  const [workerLoc,     setWorkerLoc]     = useState(null); // {lat, lng} live GPS
  // ── Change 1: Home Cleaning multi-package cart
  const [selPkgs,       setSelPkgs]       = useState({}); // {packageId: true}
  // ── Change 3: Recurring duration
  const [recurDuration, setRecurDuration] = useState('1month'); // '1month'|'3months'|'6months'
  // ── Change 4: Calendar date selection
  const [calMonth,      setCalMonth]      = useState(new Date()); // current month displayed
  const [calSelDate,    setCalSelDate]    = useState(null); // Date object
  // ── Change 6: Car type selector
  const [carType,       setCarType]       = useState('hatchback'); // 'hatchback'|'sedan'|'suv'
  // ── Change 9: Inline OTP/phone errors
  const [phoneError,    setPhoneError]    = useState('');
  const [otpError,      setOtpError]      = useState('');

  // ── Bug 7: Saved Addresses state ────────────────────────────────
  const [savedAddrs,    setSavedAddrs]    = useState([]);    // [{id, label, flat, ...}]
  const [addrsUnsub,    setAddrsUnsub]    = useState(null);
  const [showSaveAddr,  setShowSaveAddr]  = useState(false); // post-booking save prompt
  const [pendingAddr,   setPendingAddr]   = useState(null);  // address pending save
  const [addrLabel,     setAddrLabel]     = useState('Home'); // label for save modal
  const [editingAddrId, setEditingAddrId] = useState(null);  // for edit mode

  // ── Bug 4: Multi-date scheduling state ──────────────────────────
  // Array of YYYY-MM-DD strings — when scheduled mode, customer picks multiple dates
  const [selDatesMulti, setSelDatesMulti] = useState([]);

  // ── Bug 5: Monthly Subscription state ───────────────────────────
  const [subStartDate, setSubStartDate] = useState(null);      // Date object
  const [subEndDate,   setSubEndDate]   = useState(null);      // Date object
  const [subDays,      setSubDays]      = useState([1, 3, 5]); // 0=Sun..6=Sat; default Mon/Wed/Fri

  const fadeA  = useRef(new Animated.Value(0)).current;
  const trackMapRef = useRef(null); // WebView ref for live map
  const scaleA = useRef(new Animated.Value(0.85)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;
  const DATES  = getDates();

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeA,  {toValue:1,duration:1400,useNativeDriver:true}),
      Animated.spring(scaleA, {toValue:1,tension:35,friction:9,useNativeDriver:true}),
    ]).start();
    // ── Session Restore — keep user logged in between app opens ──
    // FIX (Bug 6): setUser MUST fire whenever Firebase Auth has the user,
    // regardless of whether the Firestore document exists. Otherwise the
    // React `user` state stays null and every booking attempt triggers
    // the login alert — making the app FEEL like it logged the user out.
    const unsubAuth = auth().onAuthStateChanged(async(fUser) => {
      if(fUser){
        try{
          const ph = fUser.phoneNumber?.replace('+91','');
          if(ph){
            setPhone(ph);
            let existingUser = await getUser(ph);

            // ── HEAL: If Firestore doc missing (e.g. Bug 1 caused write fail
            //    during signup), create the doc AND credit the signup bonus.
            //    Reason: Firebase Auth has them, so they completed OTP at
            //    some point — they earned the ₹200. Without crediting here,
            //    a user who never re-logs in stays stuck at ₹0 forever.
            //    The signupBonusGiven flag still guards against double-credit.
            if(!existingUser){
              const refCode = 'VG'+Math.random().toString(36).substr(2,5).toUpperCase();
              await createOrUpdateUser(ph, {
                name: 'Customer',
                phone: ph,
                walletBalance: 200,            // ← Bug 6 FIX: credit bonus on heal
                referralCode: refCode,
                totalBookings: 0,
                signupBonusGiven: true,        // ← Bonus given (flag prevents re-credit)
                createdAt: new Date().toISOString(),
                restoredFromAuth: true,        // ← marker for analytics
              });
              await logWalletTransaction(ph, 200, 'signup_bonus_heal', 'credit');
              existingUser = await getUser(ph);
            }

            // ── ALWAYS setUser when Firebase Auth has the user (this IS the fix)
            const finalUser = {
              name: existingUser?.name || 'Customer',
              phone: `+91${ph}`,
              code: existingUser?.referralCode || ('VG'+Math.random().toString(36).substr(2,5).toUpperCase()),
              walletBalance: existingUser?.walletBalance || 0,
            };
            setUser(finalUser);
            setWallet(existingUser?.walletBalance || 0);

            // FIX (Bug 6 listener leak): onAuthStateChanged fires on token
            // refresh too. Tear down any existing listeners first so we don't
            // accumulate orphan onSnapshots that leak memory.
            setOrdersUnsub(prev => { if (prev) try { prev(); } catch(_){} return null; });
            setAddrsUnsub(prev  => { if (prev) try { prev(); } catch(_){} return null; });

            const unsub = firestore().collection('bookings')
              .where('userId','==',ph).orderBy('createdAt','desc').limit(50)
              .onSnapshot(snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
                err=>console.error('orders:',err));
            setOrdersUnsub(()=>unsub);
            registerCustomerFCM(ph);

            // ── Bug 7: Saved addresses listener ──────────────────
            const unsubAddr = firestore().collection('users').doc(ph)
              .collection('addresses').orderBy('createdAt','desc')
              .onSnapshot(
                s => setSavedAddrs(s.docs.map(d => ({ id: d.id, ...d.data() }))),
                err => console.error('addresses:', err)
              );
            setAddrsUnsub(()=>unsubAddr);
          }
        }catch(e){ console.log('session restore:',e); }
      }
      // Firebase Auth handles session persistence natively (secure storage).
      // Token auto-refreshes — user stays logged in indefinitely until they
      // tap Logout. No code here resets the session.
      setScreen('main');
    });
    return ()=>unsubAuth();
  },[]);

  // ── Bug 7: Auto-fill default address when entering step4 with empty form ──
  useEffect(()=>{
    if (screen !== 'step4') return;
    if (flat || buildingName) return; // already has data — don't overwrite
    if (savedAddrs.length === 0) return;
    const def = savedAddrs.find(a => a.isDefault) || savedAddrs[0];
    if (!def) return;
    setFlat(def.flat || '');
    setBuildingName(def.buildingName || '');
    setStreetName(def.streetName || '');
    setLandmark(def.landmark || '');
    if (def.area) setSelArea(def.area);
  }, [screen, savedAddrs.length]);

  // ── Live worker location listener ─────────────────────────────────
  useEffect(()=>{
    const wid = trackOrd?.assignedWorkerId;
    if(!wid){ setWorkerLoc(null); return; }
    const unsub = firestore().collection('workers').doc(wid)
      .onSnapshot(
        doc=>{
          const d = doc.data();
          if(d?.lastLat && d?.lastLng){
            const newLoc = {lat: d.lastLat, lng: d.lastLng};
            setWorkerLoc(newLoc);
            // Inject JS to smoothly move the marker without full reload
            if(trackMapRef.current){
              trackMapRef.current.injectJavaScript(
                `if(window.workerMarker){ window.workerMarker.setLatLng([${d.lastLat},${d.lastLng}]); window.liveMap.panTo([${d.lastLat},${d.lastLng}], {animate:true, duration:1}); } true;`
              );
            }
          }
        },
        err => console.log('worker location listener error:', err.message)
      );
    return ()=>unsub();
  },[trackOrd?.assignedWorkerId]);

  // ── Keep trackOrd in sync with live orders ─────────────────────────
  // When worker taps On My Way / Service Started / Completed, the orders
  // array updates via onSnapshot. Sync that into trackOrd so the tracking
  // screen reflects status changes in real time (within ~3 seconds).
  useEffect(()=>{
    if(!trackOrd) return;
    const updated = orders.find(o => o.id === trackOrd.id || o.orderId === trackOrd.orderId);
    if(updated && updated.status !== trackOrd.status) setTrackOrd(updated);
  },[orders]);

  const addonTotal  = selAddons.reduce((s,id)=>{const a=selSvc?.addons?.find(x=>x.id===id);return s+(a?a.price:0);},0);
  const unitPrice   = selDur?selDur.price:0;
  const totalPrice  = unitPrice + addonTotal;
  const cartTotal   = cart.reduce((s,i)=>s+i.price,0);
  const cartCount   = cart.length;
  // ── Bug 4 & 5: Calculate visits + total based on booking mode ─────────
  // Bug 5: Subscription — count days in [start..end] that match subDays (weekdays)
  const calcSubVisits = () => {
    if (!subStartDate || !subEndDate || subDays.length === 0) return 0;
    let count = 0;
    const d = new Date(subStartDate);
    const end = new Date(subEndDate);
    while (d <= end) {
      if (subDays.includes(d.getDay())) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };
  const subVisits = bookMode === 'subscription' ? calcSubVisits() : 0;

  // Bug 4: Scheduled multi-date — N visits = N selected dates
  const schedVisits = bookMode === 'scheduled' ? Math.max(1, selDatesMulti.length) : 0;

  // Number of visits this booking covers (1 for instant, N for scheduled/subscription)
  const totalVisits =
    bookMode === 'subscription' ? Math.max(1, subVisits) :
    bookMode === 'scheduled'    ? Math.max(1, schedVisits) :
    1;

  // Base = cart × visits
  const baseBeforeDisc = cartTotal * totalVisits;

  // Bug 5: 10% subscription discount on subscription bookings
  const subscriptionDiscount = bookMode === 'subscription' && subVisits > 0
    ? Math.round(baseBeforeDisc * 0.10) : 0;

  const recurBase = baseBeforeDisc - subscriptionDiscount;
  const promoSave   = appliedPromo?appliedPromo.type==='pct'?Math.round(recurBase*appliedPromo.val/100):appliedPromo.val:0;
  const walletSave  = useWallet?Math.min(wallet,recurBase-promoSave):0;
  const finalTotal  = Math.max(0,recurBase-promoSave-walletSave)+29;

  // Legacy aliases for older code references
  const recurVisits = totalVisits;

  const toggleAddon = (id)=>setSelAddons(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const openService = (svc)=>{
    setSelSvc(svc);
    setSelDur(svc.durations.find(d=>d.popular)||svc.durations[0]);
    setSelAddons([]);
    setScreen('step1');
  };

  const buildCartItem = ()=>{
    if(!selSvc||!selDur) return null;
    const addonNames=selAddons.map(id=>selSvc.addons?.find(a=>a.id===id)?.name).filter(Boolean);
    return {
      svcId:selSvc.id, id:selDur.id+'_'+Date.now(),
      icon:selSvc.icon, name:`${selSvc.shortName} — ${selDur.label}`,
      extras:addonNames,
      price:totalPrice, mrp:selDur.mrp+addonTotal,
      color:selSvc.gradient[0], workers:1, durLabel:selDur.label,
    };
  };

  // ── Task cart helpers (Pronto-style)
  const taskCartCount = Object.values(taskCart).reduce((s,v)=>s+v,0);
  const taskCartTotal = Object.entries(taskCart).reduce((s,[id,qty])=>{
    const t=TASKS.find(x=>x.id===id); return s+(t?t.price*qty:0);
  },0);
  const addTask = (id)=>setTaskCart(p=>({...p,[id]:(p[id]||0)+1}));
  const removeTask = (id)=>setTaskCart(p=>{const n={...p};if(n[id]>1)n[id]--;else delete n[id];return n;});
  const checkoutTaskCart = ()=>{
    if(!user){Alert.alert('Login Required','',[ {text:'Login',onPress:()=>setScreen('login')} ]);return;}
    // Convert task cart to booking cart items
    const items = Object.entries(taskCart).map(([id,qty])=>{
      const t=TASKS.find(x=>x.id===id);
      return t?{svcId:t.id,id:t.id+'_'+Date.now(),icon:t.icon,name:t.name+(qty>1?` × ${qty}`:''),extras:[],price:t.price*qty,mrp:t.mrp*qty,color:t.color,workers:1,durLabel:`${qty} ${t.unit}`}:null;
    }).filter(Boolean);
    setCart(items);
    setScreen('step4');
  };

  const applyPromo = ()=>{    const p=PROMOS[promoCode.trim().toUpperCase()];
    if(p){setAppliedPromo(p);Alert.alert('Applied! 🎉',p.label);}
    else Alert.alert('Invalid Code','Try: VEGA50, FIRST20, FLAT100, VIZAG20');
  };

  const sendOTP = async()=>{
    setPhoneError('');
    const digits = phone.replace(/\D/g,'');
    if(!digits || digits.length < 10){
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }
    if(digits.length > 10){
      setPhoneError('Enter only 10 digits without country code');
      return;
    }
    setLoading(true);
    try{
      // React Native Firebase phone auth — no browser redirect, no reCAPTCHA
      const confirmation = await auth().signInWithPhoneNumber(`+91${digits}`);
      setConfirm(confirmation);
      setLoading(false);
      setScreen('otp');
      // Test numbers get fixed OTP 123456 — no real SMS
      if(TEST_PHONES.includes(digits)){
        setOtpError(''); // clear any previous error
        // Show inline test OTP hint — not an alert
      }
    }catch(err){
      setLoading(false);
      console.error('sendOTP error:', err);
      const code = err?.code || '';
      if(code.includes('invalid-phone-number'))    setPhoneError('Invalid phone number format');
      else if(code.includes('too-many-requests'))  setPhoneError('Too many attempts. Try after 1 hour');
      else if(code.includes('network-request-failed')) setPhoneError('Check your internet connection');
      else setPhoneError(err.message || 'Could not send OTP. Please try again');
    }
  };


  // Registers FCM token so Cloud Functions can push notifications to this customer
  const registerCustomerFCM = async (ph) => {
    try {
      await messaging().requestPermission();
      const token = await messaging().getToken();
      if (token) await firestore().collection('users').doc(ph).set({ fcmToken: token }, { merge: true });
    } catch(e) { console.log('Customer FCM:', e); }
  };

  const verifyOTP = async()=>{
    setOtpError('');
    if(!otpVal||otpVal.length<6){setOtpError('Please enter the 6-digit OTP');return;}
    setLoading(true);
    if(DEMO_MODE){
      if(otpVal!=='123456'){setLoading(false);setOtpError('Wrong OTP. Enter 123456 for demo');return;}
      const u={name:uname||'Customer',phone:`+91${phone}`,code:'VG'+Math.random().toString(36).substr(2,5).toUpperCase(),walletBalance:200};
      setUser(u);setWallet(200);setLoading(false);setScreen('main');setTab('home');
      return;
    }
    try{
      // Verify OTP with Firebase Auth — no browser redirect in React Native
      if(!confirm){setLoading(false);setOtpError('OTP session expired. Go back and request a new OTP');return;}
      await confirm.confirm(otpVal);
      // Get or create user document in Firestore
      const existingUser = await getUser(phone);
      let finalUser;
      if(existingUser){
        // ── RETURNING USER ──────────────────────────────────────────────
        // Bug 2 FIX: use actual walletBalance (default 0, NOT 200).
        let walletBal = existingUser.walletBalance || 0;

        // ── HEAL EDGE CASE: user doc exists but signup bonus never given.
        // Bug 2 RACE FIX: Use Firestore transaction to read+write atomically.
        // Without this, double-tap on Verify causes double-credit.
        if(!existingUser.signupBonusGiven){
          let credited = false;
          try {
            await firestore().runTransaction(async (txn) => {
              const ref = firestore().collection('users').doc(phone);
              const snap = await txn.get(ref);
              if (!snap.exists) return;            // race: doc deleted
              const data = snap.data();
              if (data.signupBonusGiven) return;   // already credited by another tab
              const newBal = (data.walletBalance || 0) + 200;
              txn.update(ref, {
                walletBalance: newBal,
                signupBonusGiven: true,
              });
              walletBal = newBal;
              credited = true;
            });
            if (credited) await logWalletTransaction(phone, 200, 'signup_bonus', 'credit');
          } catch (e) {
            console.error('signup bonus txn:', e);
            // Don't block login; user can retry by logging out/in
          }
        }

        finalUser = {
          name: existingUser.name || uname || 'Customer',
          phone: `+91${phone}`,
          code: existingUser.referralCode || ('VG'+Math.random().toString(36).substr(2,5).toUpperCase()),
          walletBalance: walletBal,
        };
        setUser(finalUser);
        setWallet(walletBal);

        const unsub = firestore().collection('bookings')
          .where('customerPhone','==',phone)
          .orderBy('createdAt','desc').limit(20)
          .onSnapshot(snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
            err=>console.error('orders:',err));
        setOrdersUnsub(()=>unsub);
        // Bug 7: Saved addresses listener
        const unsubAddr = firestore().collection('users').doc(phone)
          .collection('addresses').orderBy('createdAt','desc')
          .onSnapshot(s => setSavedAddrs(s.docs.map(d => ({ id: d.id, ...d.data() }))),
            err=>console.error('addresses:',err));
        setAddrsUnsub(()=>unsubAddr);
        registerCustomerFCM(phone);
        setLoading(false);
        setScreen('main');setTab('home');
        Alert.alert('🪷 Welcome back!',`Namaste ${finalUser.name}!`);
      }else{
        // ── BRAND NEW USER — create profile + credit signup bonus ONCE ──
        // Bug 2 FIX: signupBonusGiven flag prevents double-credit if this
        // code path ever runs twice (race conditions, network retries).
        const refCode = 'VG'+Math.random().toString(36).substr(2,5).toUpperCase();
        finalUser = {name:uname||'Customer',phone:`+91${phone}`,code:refCode,walletBalance:200};
        await createOrUpdateUser(phone,{
          name: uname || 'Customer',
          phone: phone,
          walletBalance: 200,
          referralCode: refCode,
          totalBookings: 0,
          signupBonusGiven: true,        // ← Bug 2: mark bonus as given
          createdAt: new Date().toISOString(),
        });
        await logWalletTransaction(phone, 200, 'signup_bonus', 'credit');
        setUser(finalUser);
        setWallet(200);

        const unsub2 = firestore().collection('bookings')
          .where('customerPhone','==',phone)
          .orderBy('createdAt','desc').limit(20)
          .onSnapshot(snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
            err=>console.error('orders:',err));
        setOrdersUnsub(()=>unsub2);
        // Bug 7: Saved addresses listener (new users start empty)
        const unsubAddr2 = firestore().collection('users').doc(phone)
          .collection('addresses').orderBy('createdAt','desc')
          .onSnapshot(s => setSavedAddrs(s.docs.map(d => ({ id: d.id, ...d.data() }))),
            err=>console.error('addresses:',err));
        setAddrsUnsub(()=>unsubAddr2);
        registerCustomerFCM(phone);
        setLoading(false);
        setScreen('main');setTab('home');
        Alert.alert('🪷 Welcome!',`Namaste ${uname||'Customer'}!\n🎁 ₹200 wallet bonus added!`);
      }
    }catch(err){
      setLoading(false);
      console.error('verifyOTP error:',err);
      const code = err?.code || '';
      if(code.includes('invalid-verification-code')) setOtpError('Wrong OTP. Please check and try again');
      else if(code.includes('code-expired'))          setOtpError('OTP expired. Go back and request a new one');
      else if(code.includes('session-expired'))       setOtpError('Session expired. Go back and request OTP again');
      else setOtpError(err.message || 'Verification failed. Please try again');
    }
  };

  // Intercepts non-cash payments to show mock payment modal before booking
  const handleConfirmBooking = () => {
    if (selPayMethod === 'cash') { placeOrder(); return; }
    setShowPayModal(true);
  };

  const placeOrder = async()=>{
    if(!user){Alert.alert('Login Required','',[ {text:'Login',onPress:()=>setScreen('login')} ]);return;}
    // Validate per mode
    if(bookMode==='scheduled'){
      if(!selTime){Alert.alert('Time Required','Please select a time slot');return;}
      if(selDatesMulti.length===0){Alert.alert('Date Required','Please select at least one date');return;}
    }
    if(bookMode==='subscription'){
      if(!subStartDate || !subEndDate){Alert.alert('Date Range Required','Please select start and end dates');return;}
      if(subDays.length===0){Alert.alert('Days Required','Please pick at least one day of the week');return;}
      if(!selTime){Alert.alert('Time Required','Please select a time slot');return;}
      if(subVisits===0){Alert.alert('No Visits','Selected dates don\'t include any of your chosen weekdays — adjust dates or days.');return;}
      // FIX: Subscription is per-service. If multiple items in cart, ask user
      // to pick ONE — daily/weekly subscription for "Home Cleaning + Bathroom +
      // Kitchen" doesn't make sense; each service has different ideal cadence.
      if(cart.length > 1){
        const buttons = cart.map(item => ({
          text: `${item.icon || '•'} ${item.name}`,
          onPress: () => {
            setCart([item]);
            setTimeout(() => {
              Alert.alert('✅ Cart Updated', `Subscribing to "${item.name}".\n\nOther services were removed — book them separately later.\n\nTap "🔒 Confirm Booking" again to proceed.`);
            }, 150);
          },
        }));
        buttons.push({ text: 'Cancel', style: 'cancel' });
        Alert.alert(
          '🔁 Subscribe to Which Service?',
          'Monthly subscriptions are for ONE service at a time (different services need different cadence — Home Cleaning daily makes sense, Bathroom daily doesn\'t).\n\nPick the service you want repeated:',
          buttons
        );
        return;
      }
    }
    if(cart.length===0){Alert.alert('Cart Empty','Please add a service first');return;}
    // FIX (audit): block bookings with empty address — was silently submitting before
    if(!flat || flat.trim().length===0){Alert.alert('Address Required','Please enter your flat / house number');return;}
    if(!selArea){Alert.alert('Area Required','Please pick your service area');return;}
    setPlacing(true);
    const pro=PROFESSIONALS[Math.floor(Math.random()*PROFESSIONALS.length)];
    const fullAddr = [flat, buildingName, streetName, landmark, selArea, 'Vizag'].filter(Boolean).join(', ');
    const _fmtDate = calSelDate
      ? calSelDate.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})
      : DATES[selDate] ? `${DATES[selDate].label} ${DATES[selDate].num} ${DATES[selDate].mon}` : 'TBD';
    let slot;
    if(bookMode==='instant'){slot='Arriving in 30–45 minutes';}
    else if(bookMode==='subscription'){slot=`Subscription · ${subVisits} visits · ${subStartDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} → ${subEndDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} at ${selTime}`;}
    else if(bookMode==='scheduled' && selDatesMulti.length > 1){slot=`${selDatesMulti.length} visits · ${selDatesMulti[0]} → ${selDatesMulti[selDatesMulti.length-1]} at ${selTime}`;}
    else if(bookMode==='scheduled'){slot=`${selDatesMulti[0] || _fmtDate} at ${selTime}`;}
    else{slot=`${_fmtDate} at ${selTime}`;}

    const resetForm = ()=>{
      setCart([]);setAppliedPromo(null);setUseWallet(false);setPromoCode('');
      setFlat('');setBuildingName('');setStreetName('');setLandmark('');setSelTime(null);setSelAddons([]);setSelPayMethod('upi');
      setSelDatesMulti([]);      // Bug 4 reset
      setSubStartDate(null);     // Bug 5 reset
      setSubEndDate(null);
      setPlacing(false);
    };

    if(DEMO_MODE){
      // Legacy demo path
      setTimeout(()=>{
        const otp=Math.floor(1000+Math.random()*9000).toString();
        const oid='VG'+Date.now().toString().slice(-6);
        const o={orderId:oid,otp,items:[...cart],total:finalTotal,slot,addr:fullAddr,status:'confirmed',time:new Date().toLocaleString('en-IN'),professional:pro,rated:false,bookingMode:bookMode,totalVisits};
        setOrders(p=>[o,...p]);
        if(useWallet&&walletSave>0) setWallet(w=>w-walletSave);
        resetForm();
        Alert.alert('🎉 Booking Confirmed!',`Order #${oid}\n📅 ${slot}\n👩 ${pro.name}\n🔐 OTP: ${otp}`,[
          {text:'Track Order',onPress:()=>{setTrackOrd(o);setScreen('track');}},
        ]);
      },1800);
      return;
    }

    // Production path — save to Firestore
    const bookingMode = bookMode; // alias for Firestore field
    try{
      // Fetch best available worker
      let pro = PROFESSIONALS[Math.floor(Math.random()*PROFESSIONALS.length)];
      try {
        const wSnap = await firestore().collection('workers')
          .where('isAvailable','==',true)
          .where('status','==','active')
          .where('role','==','worker')
          .limit(3).get();
        if(!wSnap.empty) {
          const ws = wSnap.docs.map(d=>({id:d.id,...d.data()}));
          const best = ws.sort((a,b)=>(b.ratingAvg||4)-(a.ratingAvg||4))[0];
          pro = {id:best.id,name:best.name,phone:best.phone,rating:best.ratingAvg||4.9,initial:(best.name||'V')[0],color:'#C8541A',badge:'VEGA Pro'};
        }
      } catch(e){ console.log('Worker fetch:',e); }

      // ── Bug 5: Determine first visit date based on mode ──
      // FIX: Use DATES[i].iso field directly (added to getDates) — avoids
      // month-rollover bug where Feb 1 was being saved as Jan 1.
      const firstVisitDate =
        bookMode==='subscription' && subStartDate
          ? subStartDate.toISOString().split('T')[0]
          : bookMode==='scheduled' && selDatesMulti.length > 0
          ? selDatesMulti[0]
          : calSelDate
          ? calSelDate.toISOString().split('T')[0]
          : DATES[selDate]?.iso
          ? DATES[selDate].iso
          : null;

      const bookingData = {
        userId: phone,
        customerPhone: phone,
        userName: user.name,
        customerName: user.name,
        userPhone: phone,
        assignedWorkerId: null,
        assignedWorkerName: null,
        assignedWorkerPhone: null,
        items: cart,
        subtotal: totalPrice,
        total: finalTotal,
        promoCode: appliedPromo?.code||null,
        promoDiscount: promoSave||0,
        walletUsed: walletSave||0,
        subscriptionDiscount: subscriptionDiscount || 0,    // Bug 5: 10% off if subscription
        platformFee: 29,
        slot,
        bookingMode: bookMode,                              // 'instant' | 'scheduled' | 'subscription'
        // Bug 5: Subscription fields
        subscriptionStartDate: bookMode==='subscription' && subStartDate ? subStartDate.toISOString().split('T')[0] : null,
        subscriptionEndDate:   bookMode==='subscription' && subEndDate   ? subEndDate.toISOString().split('T')[0]   : null,
        subscriptionDays:      bookMode==='subscription' ? subDays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]) : null,
        // Bug 4 + 5: Visit tracking
        totalVisits:           totalVisits || 1,
        visitNumber:           1,                           // this is the first visit doc
        parentSubscriptionId:  null,                        // set when creating child docs below
        totalPaid:             finalTotal,
        // Legacy fields kept for backward compat with admin/worker apps
        recurFreq:     null,
        recurDuration: null,
        recurVisits:   bookMode==='subscription' ? subVisits : (bookMode==='scheduled' ? selDatesMulti.length : null),
        scheduledDate: bookMode!=='instant' ? firstVisitDate : null,
        scheduledTime: selTime||null,
        address: {
          flat, buildingName, streetName, landmark,
          area: selArea, city: 'Visakhapatnam',
        },
        addressFull: fullAddr,
        professional: {
          id: pro.id||'pro_auto',
          name: pro.name,
          // FIX (audit): no fake fallback phone — if missing, leave null so
          // UI shows "Phone not available" rather than the customer dialing
          // a test/random number.
          phone: pro.phone || null,
          rating: pro.rating||4.9,
          photo: pro.photo||null,
        },
        paymentMethod: selPayMethod,
        paymentStatus: selPayMethod==='cash'?'pending':'paid',
      };

      const result = await createBooking(bookingData);
      if(!result.success)throw new Error(result.error||'Failed to create booking');

      // ── Bug 4 + 5: Create child booking docs AFTER payment success ──────────
      // For SCHEDULED multi-date: one doc per selected date
      // For SUBSCRIPTION: one doc per visit date in [start..end] matching subDays
      // First visit doc is already created above; create N-1 children here.
      const childDates = [];
      if (bookMode === 'scheduled' && selDatesMulti.length > 1) {
        for (let i = 1; i < selDatesMulti.length; i++) childDates.push(selDatesMulti[i]);
      } else if (bookMode === 'subscription' && subStartDate && subEndDate) {
        // CRITICAL: clone subStartDate before iterating — never mutate state.
        const d = new Date(subStartDate.getTime());
        const end = new Date(subEndDate.getTime());
        let firstCounted = false;
        while (d <= end) {
          if (subDays.includes(d.getDay())) {
            if (!firstCounted) firstCounted = true;
            else childDates.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
          }
          d.setDate(d.getDate() + 1);
        }
      }

      if (childDates.length > 0) {
        // FIX: Retry batch up to 3 times on failure. If still fails,
        // tell user explicitly so they can contact support rather than
        // silently leaving orphan parent without children (money lost).
        let childAttempt = 0, childOK = false, lastErr = null;
        while (childAttempt < 3 && !childOK) {
          try {
            const batch = firestore().batch();
            childDates.forEach((dateStr, idx) => {
              const visitIdx = idx + 2;
              // FIX: Use Firestore auto-id instead of Date.now()+visitIdx*1000.slice
              // The old approach could collide if last-6-digits rolled over.
              const docRef = firestore().collection('bookings').doc();
              const nextOrderId = 'VG' + docRef.id.substring(0, 8).toUpperCase();
              const nextSlot = bookMode === 'subscription'
                ? `Subscription · Visit ${visitIdx} of ${totalVisits} · ${dateStr} at ${selTime}`
                : `Visit ${visitIdx} of ${totalVisits} · ${dateStr} at ${selTime}`;
              batch.set(docRef, {
                ...bookingData,
                orderId: nextOrderId,
                otp: Math.floor(1000 + Math.random() * 9000).toString(),
                status: 'confirmed',
                slot: nextSlot,
                scheduledDate: dateStr,
                visitNumber: visitIdx,
                parentSubscriptionId: result.orderId,
                isChildVisit: true,
                totalPaid: 0,                  // already paid by parent
                createdAt: firestore.FieldValue.serverTimestamp(),
                rated: false,
              });
            });
            await batch.commit();
            childOK = true;
          } catch (e) {
            lastErr = e;
            childAttempt++;
            await new Promise(r => setTimeout(r, 1000 * childAttempt));  // backoff
          }
        }
        if (!childOK) {
          // Mark parent doc as needing manual repair — surfaces to admin
          try {
            await firestore().collection('bookings').doc(result.orderId).update({
              needsChildVisitsRepair: true,
              childVisitsAttempted: childDates.length,
              childVisitsError: String(lastErr?.message || lastErr),
            });
          } catch (_) {}
          Alert.alert(
            '⚠️ Visits Partially Saved',
            `Your first visit is booked, but the ${childDates.length} follow-up visits could not be saved automatically. Our team has been notified and will create them within 1 hour. Call +91-891-VEGA-999 if urgent. Order: ${result.orderId}`,
          );
        }
      }

      const o = {
        orderId: result.orderId,
        otp: result.otp,
        items: [...cart],
        total: finalTotal,
        slot, addr: fullAddr,
        status: 'confirmed',
        time: new Date().toLocaleString('en-IN'),
        professional: pro,
        rated: false,
        bookingMode: bookMode,
        totalVisits,
      };

      setOrders(p=>[o,...p]);

      // Update wallet in Firestore if used
      if(useWallet && walletSave>0){
        const newBalance = Math.max(0, wallet - walletSave);
        await updateUserWallet(phone, newBalance);
        setWallet(newBalance);
      }

      // ── Bug 7: Save the address used in this booking (avoid duplicates) ──
      const addrSig = (a) => `${(a.flat||'').trim().toLowerCase()}|${(a.buildingName||'').trim().toLowerCase()}|${(a.area||'').trim().toLowerCase()}`;
      const currentSig = addrSig({flat, buildingName, area: selArea});
      const alreadySaved = savedAddrs.some(a => addrSig(a) === currentSig);
      const addrSnapshot = {
        flat, buildingName, streetName, landmark,
        area: selArea, city: 'Visakhapatnam',
        fullAddress: fullAddr,
      };

      resetForm();
      Alert.alert('🎉 Booking Confirmed!',`Order #${result.orderId}\n📅 ${slot}\n👩 ${pro.name}\n🔐 OTP: ${result.otp}`,[
        {text:'Track Order',onPress:()=>{
          setTrackOrd(o);
          setScreen('track');
          // Bug 7: Offer to save address (only if new + has flat number)
          if (flat && !alreadySaved) {
            setTimeout(()=>{
              Alert.alert(
                '📍 Save this address?',
                'Next time you book, this will be auto-filled — no retyping.',
                [
                  { text: 'No thanks', style: 'cancel' },
                  { text: '🏢 Office', onPress: ()=>{
                    saveAddress(phone, {...addrSnapshot, label:'Office', isDefault: savedAddrs.length===0});
                  }},
                  { text: '🏠 Home', onPress: ()=>{
                    saveAddress(phone, {...addrSnapshot, label:'Home', isDefault: savedAddrs.length===0});
                  }},
                ]
              );
            }, 800);
          }
        }},
      ]);
    }catch(err){
      console.error('placeOrder error:',err);
      setPlacing(false);
      Alert.alert('Booking Failed',err.message||'Could not save booking. Please try again.');
    }
  };

  const submitRating = async()=>{
    if(userRating===0){Alert.alert('Please rate','Select at least 1 star');return;}

    if(DEMO_MODE){
      setOrders(prev=>prev.map(o=>o.orderId===ratingOrd.orderId?{...o,rated:true,rating:userRating,ratingNote}:o));
      setWallet(w=>w+50);
      Alert.alert('Thank You! 🙏',`${userRating}★ submitted!\n🎁 ₹50 wallet bonus!`);
      setRatingOrd(null);setUserRating(0);setRatingNote('');setScreen('main');setTab('bookings');
      return;
    }

    // Production — save rating to Firestore + update wallet
    try{
      const ok = await submitBookingRating(ratingOrd.orderId, phone, userRating, ratingNote);
      if(!ok)throw new Error('Failed to submit rating');

      setOrders(prev=>prev.map(o=>o.orderId===ratingOrd.orderId?{...o,rated:true,rating:userRating,ratingNote}:o));
      setWallet(w=>w+50);  // submitBookingRating already adds 50 in Firestore
      Alert.alert('Thank You! 🙏',`${userRating}★ submitted!\n🎁 ₹50 wallet bonus!`);
      setRatingOrd(null);setUserRating(0);setRatingNote('');setScreen('main');setTab('bookings');
    }catch(err){
      console.error('submitRating error:',err);
      Alert.alert('Error',err.message||'Could not submit rating. Please try again.');
    }
  };

  // ════════════════════════════════════════════════════════════════
  // SPLASH — Lotus logo, cream bg, gold text
  // ════════════════════════════════════════════════════════════════
  if(screen==='splash') return(
    <View style={{flex:1,backgroundColor:C.splash}}>
      <StatusBar barStyle="dark-content" backgroundColor={C.splash}/>
      {/* ✅ UPGRADE 8: Corner radial glows */}
      <View style={{position:'absolute',top:H*0.15,left:-80,width:280,height:280,borderRadius:140,backgroundColor:'rgba(200,84,26,0.07)'}}/>
      <View style={{position:'absolute',bottom:H*0.1,right:-60,width:200,height:200,borderRadius:100,backgroundColor:'rgba(200,140,10,0.06)'}}/>
      <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
        <Animated.View style={{alignItems:'center',opacity:fadeA,transform:[{scale:scaleA}]}}>
          {/* Lotus */}
          <View style={{width:120,height:120,alignItems:'center',justifyContent:'center',marginBottom:4}}>
            <View style={{position:'absolute',left:-4,top:28,width:38,height:62,borderRadius:24,backgroundColor:'#7A1818',transform:[{rotate:'-32deg'}],opacity:0.7}}/>
            <View style={{position:'absolute',right:-4,top:28,width:38,height:62,borderRadius:24,backgroundColor:'#7A1818',transform:[{rotate:'32deg'}],opacity:0.7}}/>
            <View style={{position:'absolute',left:8,top:12,width:36,height:60,borderRadius:22,backgroundColor:'#A83018',transform:[{rotate:'-16deg'}],opacity:0.9}}/>
            <View style={{position:'absolute',right:8,top:12,width:36,height:60,borderRadius:22,backgroundColor:'#A83018',transform:[{rotate:'16deg'}],opacity:0.9}}/>
            <View style={{position:'absolute',top:4,width:40,height:65,borderRadius:24,backgroundColor:C.orange}}/>
            <View style={{width:28,height:28,borderRadius:14,backgroundColor:'#E8C840',marginTop:20,zIndex:10,borderWidth:3,borderColor:'#F8E870',...SHADOW.glow,shadowColor:'#C8A820'}}/>
          </View>
          <DText style={{fontSize:46,fontWeight:'700',color:C.gold,letterSpacing:10,marginTop:6}}>VEGA</DText>
          <View style={{flexDirection:'row',alignItems:'center',marginVertical:14,gap:8}}>
            <View style={{width:28,height:1,backgroundColor:C.goldBd}}/>
            <View style={{width:6,height:6,borderRadius:3,backgroundColor:C.gold2}}/>
            <View style={{width:28,height:1,backgroundColor:C.goldBd}}/>
          </View>
          <Text style={{fontSize:15,color:C.muted,fontStyle:'italic',letterSpacing:0.5}}>Pure Homes. Peaceful Living.</Text>
        </Animated.View>
      </View>
      <View style={{paddingBottom:52,alignItems:'center'}}>
        <Text style={{color:C.muted2,fontSize:13}}>మీ ఇంటికి మేము పరిగెత్తి వస్తాం</Text>
      </View>
    </View>
  );

  // ── LOGIN (Change 9: inline errors, no browser redirect)
  if(screen==='login') return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar barStyle="dark-content"/>
      <ScrollView contentContainerStyle={{padding:24,paddingTop:16}} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={()=>{setScreen('main');setPhoneError('');}} style={{marginBottom:28,marginTop:8}}>
          <Text style={{fontSize:22,color:C.text}}>←</Text>
        </TouchableOpacity>
        <DText style={{fontSize:28,fontWeight:'700',color:C.orange,marginBottom:4,letterSpacing:-0.5}}>🪷 VEGA</DText>
        <DText style={{fontSize:24,fontWeight:'700',color:C.text,marginBottom:6}}>Welcome</DText>
        <Text style={{fontSize:14,color:C.muted,marginBottom:32,lineHeight:20}}>Sign in to book home services in Vizag</Text>
        <Text style={S.lbl}>Your Name</Text>
        <TextInput style={S.inp} placeholder="Full name" placeholderTextColor={C.muted2} value={uname} onChangeText={setUname}/>
        <Text style={[S.lbl,{marginTop:16}]}>Mobile Number</Text>
        <View style={[S.phoneRow, phoneError?{borderColor:C.red,borderWidth:1}:{}]}>
          <Text style={S.flag}>🇮🇳 +91</Text>
          <TextInput
            style={S.phoneInp}
            placeholder="10-digit number"
            placeholderTextColor={C.muted2}
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={t=>{setPhone(t);setPhoneError('');}}
          />
        </View>
        {/* Inline error — no Alert popup */}
        {phoneError ? (
          <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:6,marginBottom:4}}>
            <Text style={{color:C.red,fontSize:13}}>⚠️ {phoneError}</Text>
          </View>
        ) : null}
        {loading&&(
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:10,marginBottom:4,backgroundColor:C.orangeBg,borderRadius:12,padding:12,borderWidth:0.5,borderColor:C.orangeBd}}>
            <ActivityIndicator size="small" color={C.orange}/>
            <Text style={{color:C.orange,fontSize:13,fontWeight:'600'}}>Sending OTP...</Text>
          </View>
        )}
        {!loading&&(
          <TouchableOpacity
            style={[S.btn,{marginTop:phoneError?8:16},(phone.length<10)&&{opacity:0.4}]}
            disabled={phone.length<10||loading}
            onPress={sendOTP}
          >
            <Text style={S.btnT}>Send OTP →</Text>
          </TouchableOpacity>
        )}
        <View style={{marginTop:28,backgroundColor:C.orangeBg,borderRadius:16,padding:14,borderWidth:0.5,borderColor:C.orangeBd}}>
          <Text style={{color:C.orange,fontSize:12,fontWeight:'500',lineHeight:18}}>🔒 By continuing you agree to VEGA's Terms of Service. Your number is used only for booking verification.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // ── OTP (Change 9: inline errors, smooth transition from login with no browser redirect)
  if(screen==='otp') return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView contentContainerStyle={{padding:24}} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={()=>{setScreen('login');setOtpError('');setOtpVal('');}} style={{marginBottom:32,marginTop:8}}>
          <Text style={{fontSize:22,color:C.text}}>←</Text>
        </TouchableOpacity>
        <DText style={{fontSize:24,fontWeight:'700',color:C.text,marginBottom:6}}>Enter OTP</DText>
        <Text style={{fontSize:14,color:C.muted,marginBottom:4}}>Sent to +91 {phone}</Text>
        <TouchableOpacity onPress={()=>{setScreen('login');setOtpVal('');setOtpError('');}}>
          <Text style={{color:C.orange,fontSize:13,fontWeight:'600',marginBottom:28}}>Change number</Text>
        </TouchableOpacity>
        {/* Test number hint — shown inline, not as alert */}
        {TEST_PHONES.includes(phone)&&(
          <View style={{backgroundColor:C.greenSolid,borderRadius:12,padding:12,marginBottom:16,borderWidth:0.5,borderColor:C.greenBd,flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{fontSize:16}}>✅</Text>
            <Text style={{color:C.green,fontSize:13,fontWeight:'600'}}>Test number: use OTP 123456</Text>
          </View>
        )}
        <TextInput
          style={[S.inp,{fontSize:32,fontWeight:'800',letterSpacing:14,textAlign:'center',paddingVertical:18,borderRadius:20,borderColor:otpError?C.red:C.border2,borderWidth:otpError?1.5:0.5}]}
          placeholder="• • • • • •"
          placeholderTextColor={C.border}
          keyboardType="number-pad"
          maxLength={6}
          value={otpVal}
          onChangeText={t=>{setOtpVal(t);setOtpError('');}}
        />
        {/* Inline OTP error */}
        {otpError ? (
          <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:8,backgroundColor:C.redSolid,borderRadius:10,padding:10,borderWidth:0.5,borderColor:C.redBd}}>
            <Text style={{color:C.red,fontSize:13}}>⚠️ {otpError}</Text>
          </View>
        ) : null}
        <Text style={{textAlign:'center',color:C.muted,fontSize:12,marginTop:12,marginBottom:24}}>Didn't receive? Wait 60 seconds then tap back to resend.</Text>
        {loading?(
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:C.orangeBg,borderRadius:16,padding:16,borderWidth:0.5,borderColor:C.orangeBd}}>
            <ActivityIndicator size="small" color={C.orange}/>
            <Text style={{color:C.orange,fontSize:14,fontWeight:'600'}}>Verifying...</Text>
          </View>
        ):(
          <TouchableOpacity
            style={[S.btn,(otpVal.length<6)&&{opacity:0.4}]}
            disabled={otpVal.length<6||loading}
            onPress={verifyOTP}
          >
            <Text style={S.btnT}>Verify & Continue ✓</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  // ════════════════════════════════════════════════════════════════
  // STEP 1 — SERVICE DETAIL
  // ════════════════════════════════════════════════════════════════
  if(screen==='step1'&&selSvc){
    const svc=selSvc;
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <StatusBar barStyle="dark-content"/>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('main')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={[S.topTitle]}>{svc.shortName}</DText>
          <TouchableOpacity onPress={()=>setShowTerms(true)} style={{paddingHorizontal:12,paddingVertical:6,backgroundColor:C.orangeBg,borderRadius:20,borderWidth:0.5,borderColor:C.orangeBd}}>
            <Text style={{color:C.orange,fontSize:11,fontWeight:'700'}}>T&C</Text>
          </TouchableOpacity>
        </View>
        <View style={{height:3,backgroundColor:svc.gradient[0]}}/>
        <StepBar step={0} total={4} labels={['Service','Add-ons','Schedule','Address']}/>

        {/* Terms Modal */}
        <Modal visible={showTerms} animationType="slide" transparent>
          <View style={{flex:1,backgroundColor:'rgba(24,8,10,0.55)',justifyContent:'flex-end'}}>
            <View style={{backgroundColor:C.white,borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'78%'}}>
              <View style={{height:4,width:40,backgroundColor:C.border,borderRadius:2,alignSelf:'center',marginTop:12}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',padding:20,paddingTop:14,borderBottomWidth:0.5,borderBottomColor:C.border2}}>
                <DText style={{fontWeight:'700',fontSize:18,color:C.text}}>Terms & Coverage</DText>
                <TouchableOpacity onPress={()=>setShowTerms(false)} style={{width:30,height:30,borderRadius:15,backgroundColor:C.light,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{fontSize:16,color:C.muted}}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{padding:20}}>
                <Card style={{backgroundColor:C.greenSolid,borderColor:C.greenBd,marginBottom:14}}>
                  <Text style={{fontWeight:'700',color:C.green,fontSize:13,marginBottom:10}}>✅ What We Cover</Text>
                  {(svc.covered||[]).map((item,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:7}}><Text style={{color:C.green,fontWeight:'700',marginTop:1}}>✓</Text><Text style={{fontSize:13,color:C.text,flex:1}}>{item}</Text></View>)}
                </Card>
                <Card style={{backgroundColor:C.redSolid,borderColor:C.redBd,marginBottom:14}}>
                  <Text style={{fontWeight:'700',color:C.red,fontSize:13,marginBottom:10}}>❌ Not Covered</Text>
                  {(svc.notCovered||[]).map((item,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:7}}><Text style={{color:C.red,fontWeight:'700',marginTop:1}}>✗</Text><Text style={{fontSize:13,color:C.text,flex:1}}>{item}</Text></View>)}
                </Card>
                <Card style={{backgroundColor:C.goldSolid,borderColor:C.goldBd,marginBottom:28}}>
                  <Text style={{fontWeight:'700',color:C.gold,fontSize:13,marginBottom:10}}>📋 General Terms</Text>
                  {['ID card shown on arrival','OTP required to start','Call 15 min before arrival','Free re-service if unsatisfactory','Cancel free up to 2 hrs before'].map((item,i)=>(<View key={i} style={{flexDirection:'row',gap:8,marginBottom:7}}><Text style={{color:C.gold}}>•</Text><Text style={{fontSize:12,color:C.text2,flex:1}}>{item}</Text></View>))}
                </Card>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ✅ UPGRADE 6: Service hero with texture overlay */}
          <View style={{margin:16,marginBottom:14,borderRadius:24,overflow:'hidden',...SHADOW.soft,shadowColor:svc.gradient[1]}}>
            <View style={{backgroundColor:svc.iconBg,padding:20,flexDirection:'row',alignItems:'center'}}>
              {/* Texture overlay */}
              <View style={{position:'absolute',inset:0,opacity:0.06}}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(i=>(
                  <View key={i} style={{position:'absolute',top:i*14-20,left:-20,right:-20,height:1,backgroundColor:'#000',transform:[{rotate:'45deg'}]}}/>
                ))}
              </View>
              {/* Frosted badge — web app style */}
              <View style={{position:'absolute',top:14,right:14}}>
                {svc.badge&&<View style={{backgroundColor:'rgba(255,255,255,0.20)',paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:0.5,borderColor:'rgba(255,255,255,0.35)'}}>
                  <Text style={{color:'rgba(255,255,255,0.95)',fontSize:10,fontWeight:'700',letterSpacing:0.3}}>⭐ {svc.badge}</Text>
                </View>}
              </View>
              {svcImgSource(svc.id)
                ? <Image source={svcImgSource(svc.id)} style={{width:56,height:56,marginRight:16}} resizeMode="contain"/>
                : <Text style={{fontSize:48,marginRight:16}}>{svc.icon}</Text>}
              <View style={{flex:1}}>
                <DText style={{fontSize:22,fontWeight:'700',color:'#FFF'}}>{svc.shortName}</DText>
                <Text style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:3,lineHeight:18}}>{svc.tagline}</Text>
              </View>
            </View>
          </View>

          {/* ════ CHANGE 1: HOME CLEANING — 7 task-based packages (multi-select) ════ */}
          {svc.id==='home' ? (
            <>
              <Text style={[S.sectionTitle,{marginHorizontal:16,marginBottom:4}]}>Select Packages</Text>
              <Text style={{marginHorizontal:16,marginBottom:14,fontSize:13,color:C.muted}}>Tap to add — select as many as you need</Text>
              {HOME_PACKAGES.map(pkg=>{
                const sel = !!selPkgs[pkg.id];
                return(
                  <TouchableOpacity key={pkg.id}
                    style={{marginHorizontal:16,marginBottom:10,borderRadius:20,backgroundColor:sel?C.card:C.card,borderWidth:sel?2:0.5,borderColor:sel?C.orange:C.border2,overflow:'hidden',...(sel?SHADOW.glow:SHADOW.card)}}
                    onPress={()=>{
                      setSelPkgs(p=>sel?{...p,[pkg.id]:undefined}:{...p,[pkg.id]:true});
                    }}>
                    {/* MOST BOOKED badge */}
                    {pkg.badge&&(
                      <View style={{position:'absolute',top:0,right:0,backgroundColor:C.orange,paddingHorizontal:12,paddingVertical:4,borderBottomLeftRadius:14}}>
                        <Text style={{color:'#FFF',fontSize:9,fontWeight:'800',letterSpacing:0.5}}>🔥 {pkg.badge}</Text>
                      </View>
                    )}
                    <View style={{padding:16,flexDirection:'row',alignItems:'flex-start',gap:12}}>
                      {/* 3D Icon */}
                      <View style={{width:58,height:58,borderRadius:16,backgroundColor:`${pkg.color}15`,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:`${pkg.color}30`}}>
                        <SvcIcon id={pkg.emoji} emoji={pkg.emoji} size={36}/>
                      </View>
                      <View style={{flex:1}}>
                        <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:3,lineHeight:19}} numberOfLines={2}>{pkg.name}</Text>
                        <Text style={{fontSize:12,color:C.muted,lineHeight:17,marginBottom:8}} numberOfLines={2}>{pkg.desc}</Text>
                        {/* Price row */}
                        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                          <DText style={{fontSize:20,fontWeight:'800',color:C.orange}}>₹{pkg.price}</DText>
                          <Text style={{fontSize:13,color:C.muted2,textDecorationLine:'line-through'}}>₹{pkg.mrp}</Text>
                          <View style={{backgroundColor:C.greenBg,paddingHorizontal:7,paddingVertical:2,borderRadius:10,borderWidth:0.5,borderColor:C.greenBd}}>
                            <Text style={{color:C.green,fontSize:10,fontWeight:'700'}}>{Math.round((1-pkg.price/pkg.mrp)*100)}% off</Text>
                          </View>
                        </View>
                      </View>
                      {/* Checkbox */}
                      <View style={{width:28,height:28,borderRadius:9,backgroundColor:sel?C.orange:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:sel?C.orange:C.border,marginTop:4}}>
                        {sel&&<Text style={{color:'#FFF',fontSize:14,fontWeight:'800'}}>✓</Text>}
                      </View>
                    </View>
                    {/* Includes list when selected */}
                    {sel&&(
                      <View style={{backgroundColor:C.greenSolid,marginHorizontal:16,marginBottom:14,borderRadius:14,padding:12,borderWidth:0.5,borderColor:C.greenBd}}>
                        {pkg.includes.map((inc,i)=>(
                          <View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:6,marginBottom:i<pkg.includes.length-1?5:0}}>
                            <Text style={{color:C.green,fontWeight:'700',fontSize:12,marginTop:1}}>✅</Text>
                            <Text style={{fontSize:12,color:C.text,flex:1}}>{inc}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <View style={{height:120}}/>
            </>
          ) : svc.id==='car' ? (
            /* ════ CHANGE 6: CAR CLEANING — car type selector + duration cards ════ */
            <>
              <Text style={[S.sectionTitle,{marginHorizontal:16,marginBottom:8}]}>Your Car Type</Text>
              <View style={{flexDirection:'row',marginHorizontal:16,gap:8,marginBottom:20}}>
                {[['hatchback','🚗','Hatchback',svc.carExamples.hatchback],['sedan','🚙','Sedan',svc.carExamples.sedan],['suv','🛻','SUV / MUV',svc.carExamples.suv]].map(([ct,ico,label,ex])=>(
                  <TouchableOpacity key={ct}
                    style={{flex:1,borderRadius:16,padding:12,borderWidth:carType===ct?2:0.5,borderColor:carType===ct?C.teal:C.border2,backgroundColor:C.card,alignItems:'center',...(carType===ct?SHADOW.glow:SHADOW.card),shadowColor:C.teal}}
                    onPress={()=>{
                      setCarType(ct);
                      const updDur = svc.durations.find(d=>d.id===(selDur?.id||'c1'));
                      // FIX (audit #14): map duration id → pricing key (single/weekly/monthly).
                      // Previously used 'single' for every package — so SUV Weekly/Monthly stayed at hatchback price.
                      if(updDur){
                        const priceKey = updDur.id==='c1'?'single':updDur.id==='c2'?'weekly':updDur.id==='c3'?'monthly':'single';
                        setSelDur({...updDur, price: svc.carPricing[priceKey]?.[ct] || updDur.price});
                      }
                    }}>
                    <Text style={{fontSize:24,marginBottom:4}}>{ico}</Text>
                    <Text style={{fontSize:11,fontWeight:'700',color:carType===ct?C.teal:C.text,textAlign:'center'}}>{label}</Text>
                    <Text style={{fontSize:9,color:C.muted,textAlign:'center',marginTop:2,lineHeight:12}} numberOfLines={2}>{ex}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[S.sectionTitle,{marginHorizontal:16,marginBottom:12}]}>Select Package</Text>
              {svc.durations.map(dur=>{
                const priceKey = dur.id==='c1'?'single':dur.id==='c2'?'weekly':'monthly';
                const dynPrice = svc.carPricing[priceKey]?.[carType] || dur.price;
                const sel=selDur?.id===dur.id;
                return(
                  <TouchableOpacity key={dur.id}
                    style={{marginHorizontal:16,marginBottom:10,borderRadius:20,backgroundColor:C.card,borderWidth:sel?2:0.5,borderColor:sel?C.teal:C.border2,padding:16,...(sel?SHADOW.glow:SHADOW.card),shadowColor:C.teal}}
                    onPress={()=>setSelDur({...dur,price:dynPrice})}>
                    {dur.popular&&<View style={{position:'absolute',top:0,right:0,backgroundColor:C.teal,paddingHorizontal:12,paddingVertical:4,borderBottomLeftRadius:14,borderTopRightRadius:20}}><Text style={{color:'#FFF',fontSize:9,fontWeight:'800'}}>★ POPULAR</Text></View>}
                    <View style={{flexDirection:'row',alignItems:'flex-start',gap:10}}>
                      <View style={{flex:1}}>
                        <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:3}}>{dur.label}</Text>
                        <Text style={{fontSize:11,color:C.muted,marginBottom:8}}>{dur.duration}</Text>
                        {dur.tasks?.map((t,i)=>(
                          <View key={i} style={{flexDirection:'row',gap:6,marginBottom:4}}>
                            <Text style={{color:C.green,fontSize:11,fontWeight:'700'}}>✅</Text>
                            <Text style={{fontSize:12,color:C.text,flex:1}}>{t}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={{alignItems:'flex-end',gap:4}}>
                        <DText style={{fontSize:20,fontWeight:'800',color:C.teal}}>₹{dynPrice}</DText>
                        <Text style={{fontSize:11,color:C.muted2,textDecorationLine:'line-through'}}>₹{Math.round(dynPrice*1.9)}</Text>
                        {sel&&<View style={{width:28,height:28,borderRadius:9,backgroundColor:C.teal,alignItems:'center',justifyContent:'center'}}>
                          <Text style={{color:'#FFF',fontSize:13,fontWeight:'800'}}>✓</Text>
                        </View>}
                      </View>
                    </View>
                    {sel&&dur.notCovered&&(
                      <View style={{marginTop:10,backgroundColor:C.redSolid,borderRadius:12,padding:10,borderWidth:0.5,borderColor:C.redBd}}>
                        <Text style={{fontWeight:'700',color:C.red,fontSize:11,marginBottom:6}}>❌ Not Included</Text>
                        {dur.notCovered?.map((nc,i)=><View key={i} style={{flexDirection:'row',gap:6,marginBottom:3}}><Text style={{color:C.red,fontSize:10}}>✗</Text><Text style={{fontSize:11,color:C.text2,flex:1}}>{nc}</Text></View>)}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
              <View style={{height:100}}/>
            </>
          ) : (
            /* ════ OTHER SERVICES (Bathroom, Kitchen, Deep, etc.) ════ */
            <>
              {/* Duration cards */}
              <Text style={[S.sectionTitle,{marginHorizontal:16,marginBottom:12}]}>Select Option</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,paddingBottom:4}} style={{marginBottom:20}}>
                {svc.durations.map((dur)=>{
                  const sel=selDur?.id===dur.id;
                  const disc=Math.round((1-dur.price/dur.mrp)*100);
                  return(
                    <TouchableOpacity key={dur.id}
                      style={{width:152,marginRight:12,borderRadius:22,backgroundColor:sel?svc.gradient[0]:C.card,borderWidth:sel?0:0.5,borderColor:C.border2,padding:16,overflow:'hidden',
                        ...(sel?{...SHADOW.glow,shadowColor:svc.gradient[1]}:SHADOW.card)}}
                      onPress={()=>setSelDur(dur)}>
                      {sel&&<View style={{position:'absolute',top:-24,right:-24,width:80,height:80,borderRadius:40,backgroundColor:'rgba(255,255,255,0.12)'}}/>}
                      {dur.popular&&(
                        <View style={{position:'absolute',top:0,right:0,backgroundColor:sel?'rgba(255,255,255,0.25)':C.gold2,paddingHorizontal:8,paddingVertical:4,borderBottomLeftRadius:12,borderTopRightRadius:22}}>
                          <Text style={{color:'#FFF',fontSize:9,fontWeight:'800',letterSpacing:0.3}}>★ POPULAR</Text>
                        </View>
                      )}
                      <DText style={{fontSize:26,fontWeight:'700',color:sel?'#FFF':svc.gradient[0],marginBottom:4}}>₹{dur.price}</DText>
                      <Text style={{fontSize:14,fontWeight:'700',color:sel?'rgba(255,255,255,0.95)':C.text,marginBottom:8}}>{dur.label}</Text>
                      {dur.tasks?.slice(0,3).map((t,i)=>(
                        <View key={i} style={{flexDirection:'row',alignItems:'center',gap:5,marginBottom:4}}>
                          <Text style={{color:sel?'rgba(255,255,255,0.7)':C.green,fontSize:10,fontWeight:'700'}}>✓</Text>
                          <Text style={{fontSize:10,color:sel?'rgba(255,255,255,0.85)':C.muted,flex:1}} numberOfLines={1}>{t}</Text>
                        </View>
                      ))}
                      <View style={{marginTop:10,backgroundColor:sel?'rgba(255,255,255,0.20)':C.greenBg,paddingHorizontal:8,paddingVertical:3,borderRadius:20,alignSelf:'flex-start',borderWidth:0.5,borderColor:sel?'rgba(255,255,255,0.25)':C.greenBd}}>
                        <Text style={{color:sel?'#FFF':C.green,fontSize:10,fontWeight:'600'}}>{disc}% off</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* CHANGE 2: Bathroom — show full included + not-included per option */}
              {selDur?.tasks&&(
                <Card style={{marginHorizontal:16,backgroundColor:C.greenSolid,borderColor:C.greenBd,marginBottom:10}}>
                  <Text style={{fontSize:11,fontWeight:'700',color:C.green,marginBottom:10,letterSpacing:0.8}}>✅ INCLUDED — {selDur.label.toUpperCase()}</Text>
                  {selDur.tasks.map((t,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:6}}><Text style={{color:C.green,fontWeight:'700',fontSize:13}}>✅</Text><Text style={{fontSize:13,color:C.text,flex:1}}>{t}</Text></View>)}
                  {selDur.note&&<Text style={{fontSize:11,color:C.green,marginTop:6,fontStyle:'italic'}}>💡 {selDur.note}</Text>}
                </Card>
              )}
              {selDur?.notIncluded&&(
                <Card style={{marginHorizontal:16,backgroundColor:C.redSolid,borderColor:C.redBd,marginBottom:16}}>
                  <Text style={{fontSize:11,fontWeight:'700',color:C.red,marginBottom:10,letterSpacing:0.8}}>❌ NOT INCLUDED</Text>
                  {selDur.notIncluded.map((t,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:6}}><Text style={{color:C.red,fontWeight:'700',fontSize:13}}>❌</Text><Text style={{fontSize:13,color:C.text2,flex:1}}>{t}</Text></View>)}
                </Card>
              )}
              <TouchableOpacity style={{marginHorizontal:16,marginBottom:8,padding:14,borderRadius:16,borderWidth:0.5,borderColor:C.orangeBd,backgroundColor:C.orangeBg,flexDirection:'row',alignItems:'center',gap:8}} onPress={()=>setShowTerms(true)}>
                <Text style={{fontSize:16}}>📋</Text>
                <Text style={{color:C.orange,fontSize:13,fontWeight:'600',flex:1}}>View full terms & coverage</Text>
                <Text style={{color:C.orange,fontSize:18}}>›</Text>
              </TouchableOpacity>
              <View style={{height:100}}/>
            </>
          )}
        </ScrollView>

        {/* Bottom CTA — home packages vs others */}
        {svc.id==='home' ? (() => {
          const pkgList = HOME_PACKAGES.filter(p=>selPkgs[p.id]);
          const pkgTotal = pkgList.reduce((s,p)=>s+p.price,0);
          return(
            <View style={{backgroundColor:C.white,padding:16,paddingBottom:24,borderTopWidth:0.5,borderTopColor:C.border2,...SHADOW.soft}}>
              {pkgList.length>0&&(
                <Text style={{fontSize:12,color:C.muted,marginBottom:4}}>{pkgList.length} package{pkgList.length>1?'s':''} selected</Text>
              )}
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <View>
                  <DText style={{fontSize:28,fontWeight:'700',color:pkgList.length?C.orange:C.muted}}>{pkgList.length?`₹${pkgTotal}`:'Select a package'}</DText>
                </View>
                <TouchableOpacity
                  style={[S.ctaBtn,{backgroundColor:pkgList.length?svc.gradient[0]:C.muted,...(pkgList.length?SHADOW.glow:{})},!pkgList.length&&{opacity:0.5}]}
                  disabled={!pkgList.length}
                  onPress={()=>{
                    // Build cart from selected packages
                    const items = pkgList.map(p=>({
                      svcId:'home', id:p.id+'_'+Date.now(), icon:'🏠', name:p.name,
                      extras:[], price:p.price, mrp:p.mrp, color:C.orange, workers:1, durLabel:p.name,
                    }));
                    setCart(items);
                    setScreen('step3');
                  }}>
                  <Text style={S.ctaBtnT}>Schedule →</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })() : (
          <View style={{backgroundColor:C.white,padding:16,paddingBottom:24,borderTopWidth:0.5,borderTopColor:C.border2,...SHADOW.soft}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <View>
                <Text style={{fontSize:11,color:C.muted}}>1 {svc.workerLabel} · {selDur?.label}</Text>
                <DText style={{fontSize:28,fontWeight:'700',color:C.orange}}>₹{unitPrice}</DText>
              </View>
              <TouchableOpacity style={[S.ctaBtn,{backgroundColor:svc.gradient[0],...SHADOW.glow,shadowColor:svc.gradient[1]}]} onPress={()=>setScreen('step2')}>
                <Text style={S.ctaBtnT}>Add-ons →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 2 — ADD-ONS
  // ════════════════════════════════════════════════════════════════
  if(screen==='step2'&&selSvc){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('step1')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Add-ons</DText>
          <View style={{width:36}}/>
        </View>
        <View style={{height:3,backgroundColor:selSvc.gradient[0]}}/>
        <StepBar step={1} total={4} labels={['Service','Add-ons','Schedule','Address']}/>
        <ScrollView style={{flex:1,padding:16}}>
          <DText style={{fontSize:20,fontWeight:'700',color:C.text,marginBottom:4}}>Enhance Your Service</DText>
          <Text style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:19}}>Optional extras — add only what you need</Text>
          {(selSvc.addons||[]).length===0?(
            <View style={{alignItems:'center',paddingTop:40}}>
              <Text style={{fontSize:40,marginBottom:16}}>✨</Text>
              <Text style={{color:C.muted,fontSize:15,marginBottom:24}}>No add-ons for this service</Text>
              <TouchableOpacity style={S.btn} onPress={()=>setScreen('step3')}><Text style={S.btnT}>Continue to Schedule →</Text></TouchableOpacity>
            </View>
          ):(selSvc.addons||[]).map((addon)=>{
            const sel=selAddons.includes(addon.id);
            return(
              <TouchableOpacity key={addon.id}
                style={{backgroundColor:C.card,borderRadius:20,padding:16,marginBottom:10,borderWidth:sel?1.5:0.5,borderColor:sel?selSvc.gradient[0]:C.border2,flexDirection:'row',alignItems:'center',...(sel?SHADOW.soft:SHADOW.card)}}
                onPress={()=>toggleAddon(addon.id)}>
                <View style={{width:52,height:52,borderRadius:16,backgroundColor:sel?selSvc.iconBg:C.bg,alignItems:'center',justifyContent:'center',marginRight:14,borderWidth:0.5,borderColor:C.border}}><Text style={{fontSize:26}}>{addon.icon}</Text></View>
                <View style={{flex:1}}>
                  <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:2}}>{addon.name}</Text>
                  <Text style={{fontSize:12,color:C.muted}}>{addon.desc}</Text>
                </View>
                <View style={{alignItems:'flex-end',gap:8}}>
                  <DText style={{fontSize:17,fontWeight:'700',color:selSvc.gradient[0]}}>₹{addon.price}</DText>
                  <View style={{width:28,height:28,borderRadius:9,backgroundColor:sel?selSvc.gradient[0]:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:sel?selSvc.gradient[0]:C.border}}>
                    {sel&&<Text style={{color:'#FFF',fontSize:14,fontWeight:'800'}}>✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{height:100}}/>
        </ScrollView>
        <View style={{backgroundColor:C.white,padding:16,paddingBottom:24,borderTopWidth:0.5,borderTopColor:C.border2}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View>
              {selAddons.length>0&&<Text style={{fontSize:12,color:C.green,marginBottom:2}}>+{selAddons.length} add-on{selAddons.length>1?'s':''} selected</Text>}
              <DText style={{fontSize:26,fontWeight:'700',color:C.orange}}>₹{totalPrice}</DText>
            </View>
            <TouchableOpacity style={[S.ctaBtn,{backgroundColor:selSvc.gradient[0],...SHADOW.glow,shadowColor:selSvc.gradient[1]}]} onPress={()=>setScreen('step3')}>
              <Text style={S.ctaBtnT}>Schedule →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 3 — SCHEDULE
  // ════════════════════════════════════════════════════════════════
  if(screen==='step3'&&selSvc){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen(selSvc.id==='home'?'step1':'step2')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Schedule</DText>
          <View style={{width:36}}/>
        </View>
        <View style={{height:3,backgroundColor:selSvc.gradient[0]}}/>
        <StepBar step={2} total={4} labels={['Service','Add-ons','Schedule','Address']}/>
        <ScrollView style={{flex:1,padding:16}}>
          <Text style={{fontSize:15,fontWeight:'700',color:C.text,marginBottom:12}}>When do you need this?</Text>
          <View style={{flexDirection:'row',backgroundColor:C.card,borderRadius:16,padding:4,borderWidth:0.5,borderColor:C.border2,marginBottom:20,...SHADOW.card}}>
            {[{id:'instant',label:'⚡ Now'},{id:'scheduled',label:'📅 Schedule'},{id:'subscription',label:'🔁 Monthly'}].map(m=>(
              <TouchableOpacity key={m.id} style={{flex:1,paddingVertical:12,borderRadius:12,alignItems:'center',backgroundColor:bookMode===m.id?C.orange:'transparent',...(bookMode===m.id?SHADOW.glow:{})}} onPress={()=>setBookMode(m.id)}>
                <Text style={{fontSize:12,fontWeight:'700',color:bookMode===m.id?'#FFF':C.muted}}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {bookMode==='instant'&&(
            <Card style={{backgroundColor:C.greenSolid,borderColor:C.greenBd,alignItems:'center',marginBottom:20,padding:24}}>
              <Text style={{fontSize:44,marginBottom:12}}>⚡</Text>
              <DText style={{fontWeight:'700',color:C.green,fontSize:20,marginBottom:6}}>Instant Booking</DText>
              <Text style={{color:C.green,fontSize:13,textAlign:'center',lineHeight:20}}>Professional arrives at your door in 30–45 minutes</Text>
            </Card>
          )}
          {bookMode==='subscription'&&(
            <Card style={{backgroundColor:C.tealBg,borderColor:C.tealBd,marginBottom:20}}>
              <DText style={{fontWeight:'700',color:C.teal,fontSize:16,marginBottom:4}}>🔁 Monthly Subscription — Save 10%</DText>
              <Text style={{color:C.muted,fontSize:12,lineHeight:18,marginBottom:8}}>Pick your start + end dates, days of week, and time on the next step. Single upfront payment for all visits.</Text>
              <View style={{backgroundColor:'rgba(14,88,72,0.12)',borderRadius:10,padding:10,flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={{fontSize:14}}>👉</Text>
                <Text style={{color:C.teal,fontWeight:'700',fontSize:12,flex:1}}>Tap "Address →" below to configure your subscription</Text>
              </View>
            </Card>
          )}
          {bookMode==='scheduled'&&(
            <>
              <View style={{backgroundColor:C.orangeBg,borderRadius:12,padding:12,marginBottom:16,borderWidth:0.5,borderColor:C.orangeBd,flexDirection:'row',alignItems:'center',gap:10}}>
                <Text style={{fontSize:18}}>👇</Text>
                <Text style={{flex:1,fontSize:12,color:C.orange,fontWeight:'600'}}>Pick a date and time below to continue</Text>
              </View>
              {/* ── Change 4: Full Month Calendar ─────────────────────────── */}
              <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:10}}>Select Date</Text>
              <Card style={{marginBottom:16,padding:14}}>
                {/* Month navigation */}
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                  <TouchableOpacity onPress={()=>setCalMonth(m=>{const n=new Date(m);n.setMonth(m.getMonth()-1);return n;})}
                    style={{width:34,height:34,borderRadius:17,backgroundColor:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.border}}>
                    <Text style={{fontSize:16,color:C.text}}>‹</Text>
                  </TouchableOpacity>
                  <Text style={{fontWeight:'700',color:C.text,fontSize:14}}>
                    {calMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}
                  </Text>
                  <TouchableOpacity onPress={()=>setCalMonth(m=>{const n=new Date(m);n.setMonth(m.getMonth()+1);return n;})}
                    style={{width:34,height:34,borderRadius:17,backgroundColor:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.border}}>
                    <Text style={{fontSize:16,color:C.text}}>›</Text>
                  </TouchableOpacity>
                </View>
                {/* Day headers */}
                <View style={{flexDirection:'row',marginBottom:6}}>
                  {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=>(
                    <View key={d} style={{flex:1,alignItems:'center'}}>
                      <Text style={{fontSize:11,fontWeight:'700',color:C.muted}}>{d}</Text>
                    </View>
                  ))}
                </View>
                {/* Calendar grid */}
                {(()=>{
                  const todayD=new Date(); todayD.setHours(0,0,0,0);
                  const mY=calMonth.getFullYear(), mM=calMonth.getMonth();
                  const firstDow=new Date(mY,mM,1).getDay();
                  const dim=new Date(mY,mM+1,0).getDate();
                  const totalCells=Math.ceil((firstDow+dim)/7)*7;
                  const cells=Array.from({length:totalCells},(_,i)=>{const d=i-firstDow+1;return(d<1||d>dim)?null:d;});
                  const rows=[];
                  for(let i=0;i<cells.length;i+=7) rows.push(cells.slice(i,i+7));
                  return rows.map((row,ri)=>(
                    <View key={ri} style={{flexDirection:'row',marginBottom:3}}>
                      {row.map((d,ci)=>{
                        if(!d) return <View key={ci} style={{flex:1,height:40}}/>;
                        const dateObj=new Date(mY,mM,d);
                        const isPast=dateObj<todayD;
                        const isToday=dateObj.getTime()===todayD.getTime();
                        const isSel=calSelDate&&calSelDate.getTime()===dateObj.getTime();
                        return(
                          <TouchableOpacity key={ci} disabled={isPast}
                            style={{flex:1,height:40,alignItems:'center',justifyContent:'center',borderRadius:20,
                              backgroundColor:isSel?C.orange:isToday?C.orangeBg:'transparent',
                              ...(isSel?SHADOW.glow:{})}}
                            onPress={()=>setCalSelDate(new Date(mY,mM,d))}>
                            <Text style={{fontSize:14,fontWeight:isSel||isToday?'700':'400',
                              color:isSel?'#FFF':isPast?C.muted2:isToday?C.orange:C.text}}>{d}</Text>
                            {isToday&&!isSel&&<View style={{width:4,height:4,borderRadius:2,backgroundColor:C.orange,marginTop:1}}/>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ));
                })()}
                {calSelDate&&(
                  <View style={{marginTop:8,backgroundColor:C.orangeBg,borderRadius:10,padding:8,flexDirection:'row',alignItems:'center',gap:6,borderWidth:0.5,borderColor:C.orangeBd}}>
                    <Text style={{fontSize:13}}>📅</Text>
                    <Text style={{color:C.orange,fontWeight:'700',fontSize:12}}>
                      {calSelDate.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    </Text>
                  </View>
                )}
              </Card>
              <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:12}}>Select Time</Text>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:20}}>
                {TIMES.map((t,i)=>(
                  <TouchableOpacity key={i} style={{paddingHorizontal:16,paddingVertical:11,borderRadius:20,backgroundColor:selTime===t?C.orange:C.card,borderWidth:0.5,borderColor:selTime===t?C.orange:C.border2,...(selTime===t?SHADOW.glow:SHADOW.card)}} onPress={()=>setSelTime(t)}>
                    <Text style={{fontSize:13,fontWeight:'600',color:selTime===t?'#FFF':C.text2}}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <Card style={{marginBottom:8}}>
            <Text style={{fontWeight:'700',color:C.text,marginBottom:12}}>Booking Summary</Text>
            {selSvc.id==='home'?(
              cart.map((item,i)=><BR key={i} l={item.name} r={`₹${item.price}`}/>)
            ):(
              <>
                <BR l={`${selSvc.shortName} — ${selDur?.label}`} r={`₹${selDur?.price}`}/>
                {selAddons.map(id=>{const a=selSvc.addons?.find(x=>x.id===id);return a?<BR key={id} l={a.name} r={`₹${a.price}`}/>:null;})}
              </>
            )}
            {bookMode==='subscription' && subVisits > 0 && <BR l={`× ${subVisits} visits (subscription)`} r={`₹${cartTotal*subVisits}`} rc={C.teal}/>}
            {bookMode==='subscription' && subscriptionDiscount > 0 && <BR l="Subscription discount (10%)" r={`–₹${subscriptionDiscount}`} rc={C.green}/>}
            <View style={{height:1,backgroundColor:C.border,marginVertical:8}}/>
            <BR l="Total before checkout" r={`₹${recurBase}`} bold/>
          </Card>
          <View style={{height:100}}/>
        </ScrollView>
        <View style={{backgroundColor:C.white,padding:16,paddingBottom:24,borderTopWidth:0.5,borderTopColor:C.border2}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View>
              <Text style={{fontSize:11,color:C.muted}} numberOfLines={1}>
                {bookMode==='instant'?'30–45 min arrival':selTime?(
                  calSelDate?`${calSelDate.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} at ${selTime}`:'Select date'
                ):'Select time'}
              </Text>
              {bookMode==='subscription' && subVisits>0 && <Text style={{fontSize:9,color:C.teal,fontWeight:'700'}}>{subVisits} visits upfront</Text>}
              {bookMode==='scheduled' && selDatesMulti.length>0 && <Text style={{fontSize:9,color:C.orange,fontWeight:'700'}}>{selDatesMulti.length} visit{selDatesMulti.length>1?'s':''}</Text>}
              <DText style={{fontSize:24,fontWeight:'700',color:C.orange}}>
                ₹{recurBase>0?recurBase:(cartTotal>0?cartTotal:totalPrice)}
              </DText>
            </View>
            <TouchableOpacity
              style={[S.ctaBtn,{backgroundColor:selSvc.gradient[0],...SHADOW.glow,shadowColor:selSvc.gradient[1]},
                (bookMode==='scheduled' && (!selTime||!calSelDate)) && {opacity:0.4}]}
              disabled={bookMode==='scheduled' && (!selTime||!calSelDate)}
              onPress={()=>{
                const item=buildCartItem();
                if(item){setCart(prev=>{const f=prev.filter(i=>i.svcId!==selSvc.id);return [...f,item];});}
                setScreen('step4');
              }}>
              <Text style={S.ctaBtnT}>Address →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // STEP 4 — ADDRESS + PAYMENT
  // ════════════════════════════════════════════════════════════════
  if(screen==='step4'){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('step3')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Address & Payment</DText>
          <View style={{width:36}}/>
        </View>
        <View style={{height:3,backgroundColor:C.orange}}/>
        <StepBar step={3} total={4} labels={['Service','Add-ons','Schedule','Address']}/>
        <Modal visible={showArea} animationType="slide" transparent>
          <View style={{flex:1,backgroundColor:'rgba(24,8,10,0.5)',justifyContent:'flex-end'}}>
            <View style={{backgroundColor:C.white,borderTopLeftRadius:28,borderTopRightRadius:28,maxHeight:'60%'}}>
              <View style={{height:4,width:40,backgroundColor:C.border,borderRadius:2,alignSelf:'center',marginTop:12}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',padding:20,paddingTop:14,borderBottomWidth:0.5,borderBottomColor:C.border2}}>
                <DText style={{fontWeight:'700',fontSize:17,color:C.text}}>Select Area</DText>
                <TouchableOpacity onPress={()=>setShowArea(false)} style={{width:30,height:30,borderRadius:15,backgroundColor:C.light,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:14,color:C.muted}}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView>
                {AREAS.map((a,i)=>(
                  <TouchableOpacity key={i} style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',padding:16,borderBottomWidth:0.5,borderBottomColor:C.border2,backgroundColor:selArea===a?C.orangeBg:C.white}} onPress={()=>{setSelArea(a);setShowArea(false);}}>
                    <Text style={{fontSize:15,color:selArea===a?C.orange:C.text,fontWeight:selArea===a?'700':'400'}}>📍 {a}, Visakhapatnam</Text>
                    {selArea===a&&<Text style={{color:C.orange,fontWeight:'700'}}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <ScrollView style={{flex:1,padding:16}} keyboardShouldPersistTaps="handled">
          {/* ── Bug 7: Saved Addresses quick-select (only if user has saved addresses) ── */}
          {savedAddrs.length > 0 && (
            <Card style={{marginBottom:14,padding:14}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <Text style={{fontWeight:'700',color:C.text,fontSize:14}}>📍 Saved Addresses</Text>
                <TouchableOpacity onPress={()=>{
                  // Clear fields for new address entry
                  setFlat(''); setBuildingName(''); setStreetName(''); setLandmark('');
                }}>
                  <Text style={{color:C.orange,fontSize:12,fontWeight:'700'}}>+ New</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {savedAddrs.map((addr) => {
                  const isSelected = flat === addr.flat && buildingName === (addr.buildingName||'');
                  return (
                    <TouchableOpacity
                      key={addr.id}
                      onPress={() => {
                        setFlat(addr.flat || '');
                        setBuildingName(addr.buildingName || '');
                        setStreetName(addr.streetName || '');
                        setLandmark(addr.landmark || '');
                        if (addr.area) setSelArea(addr.area);
                      }}
                      style={{
                        marginRight: 10,
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: isSelected ? 2 : 0.5,
                        borderColor: isSelected ? C.orange : C.border2,
                        backgroundColor: isSelected ? C.orangeBg : C.card,
                        minWidth: 180, maxWidth: 240,
                      }}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:4}}>
                        <Text style={{fontSize:14}}>
                          {addr.label === 'Home' ? '🏠' : addr.label === 'Office' ? '🏢' : '📍'}
                        </Text>
                        <Text style={{fontWeight:'700',color:isSelected?C.orange:C.text,fontSize:13}}>
                          {addr.label || 'Saved'}
                          {addr.isDefault && <Text style={{color:C.gold,fontSize:11}}> ★ Default</Text>}
                        </Text>
                      </View>
                      <Text style={{fontSize:11,color:C.muted,lineHeight:14}} numberOfLines={2}>
                        {[addr.flat, addr.buildingName, addr.area].filter(Boolean).join(', ')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Card>
          )}
          {/* ✅ REAL MAP — updates when area or building changes */}
          <Card style={{marginBottom:16,padding:0,overflow:'hidden'}}>
            <View style={{height:150,overflow:'hidden',position:'relative'}}>
              <Image
                key={`map_${selArea}_${buildingName}`}
                source={{ uri: getMapUrl(selArea, buildingName) }}
                style={{width:'100%',height:150}}
                resizeMode="cover"
              />
              <View style={{position:'absolute',top:0,left:0,right:0,bottom:0,alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                <View style={{backgroundColor:C.orange,width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#FFF',...SHADOW.glow}}>
                  <Text style={{fontSize:16}}>🪷</Text>
                </View>
                <View style={{width:2,height:10,backgroundColor:C.orange,marginTop:-2}}/>
              </View>
              <View style={{position:'absolute',top:8,left:8,backgroundColor:'rgba(255,255,255,0.92)',paddingHorizontal:8,paddingVertical:3,borderRadius:10}}>
                <Text style={{fontSize:11,fontWeight:'700',color:C.text}}>📍 {selArea}, Vizag</Text>
              </View>
            </View>
            <TouchableOpacity style={{padding:14,flexDirection:'row',alignItems:'center',gap:10}} onPress={()=>setShowArea(true)}>
              <View style={{width:32,height:32,borderRadius:10,backgroundColor:C.tealBg,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.tealBd}}><Text style={{fontSize:16}}>🛡️</Text></View>
              <View style={{flex:1}}>
                <Text style={{fontWeight:'700',color:C.text}}>{selArea} Apartments</Text>
                <Text style={{fontSize:12,color:C.muted}}>Visakhapatnam, AP · Tap to change</Text>
              </View>
              <Text style={{color:C.orange,fontWeight:'700'}}>Change ›</Text>
            </TouchableOpacity>
          </Card>
          <Text style={S.lbl}>Flat / House Number *</Text>
          <Card style={{marginBottom:14}}>
            <TextInput style={{fontSize:14,color:C.text,paddingVertical:2,minHeight:44}} placeholder="e.g. Flat 302, Door No. 47" placeholderTextColor={C.muted2} value={flat} onChangeText={setFlat}/>
          </Card>
          <Text style={S.lbl}>Building / Apartment Name</Text>
          <Card style={{marginBottom:14}}>
            <TextInput style={{fontSize:14,color:C.text,paddingVertical:2,minHeight:44}} placeholder="e.g. Sai Residency, Green Valley Apts" placeholderTextColor={C.muted2} value={buildingName} onChangeText={setBuildingName}/>
          </Card>
          <Text style={S.lbl}>Street / Block</Text>
          <Card style={{marginBottom:14}}>
            <TextInput style={{fontSize:14,color:C.text,paddingVertical:2,minHeight:44}} placeholder="e.g. Block B, Road No. 5" placeholderTextColor={C.muted2} value={streetName} onChangeText={setStreetName}/>
          </Card>
          <Text style={S.lbl}>Nearby Landmark</Text>
          <Card style={{marginBottom:14}}>
            <TextInput style={{fontSize:14,color:C.text,paddingVertical:2,minHeight:44}} placeholder="e.g. Near Madhurawada Bus Stop" placeholderTextColor={C.muted2} value={landmark} onChangeText={setLandmark}/>
          </Card>
          {cart.length>0&&(
            <Card style={{marginBottom:12}}>
              <Text style={{fontWeight:'700',color:C.text,fontSize:14,marginBottom:12}}>Order Summary</Text>
              {cart.map((item,i)=>(
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:10}}>
                  <View style={{width:38,height:38,borderRadius:12,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18}}>{item.icon}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={{fontSize:13,fontWeight:'600',color:C.text}} numberOfLines={1}>{item.name}</Text>
                    {item.extras?.length>0&&<Text style={{fontSize:11,color:C.green,marginTop:1}} numberOfLines={1}>+ {item.extras.join(', ')}</Text>}
                    <Text style={{fontSize:11,color:C.muted}}>× {item.workers} professional{item.workers>1?'s':''}</Text>
                  </View>
                  <DText style={{fontWeight:'700',color:C.orange,fontSize:15}}>₹{item.price}</DText>
                </View>
              ))}
            </Card>
          )}
          <Card style={{marginBottom:12}}>
            <Text style={{fontWeight:'700',color:C.text,marginBottom:10}}>🎟️ Promo Code</Text>
            <View style={{flexDirection:'row',gap:10}}>
              <TextInput style={[S.inp,{flex:1,marginBottom:0,paddingVertical:10,borderRadius:20}]} placeholder="VEGA50 · FIRST20 · FLAT100" placeholderTextColor={C.muted2} value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters"/>
              <TouchableOpacity style={{backgroundColor:C.orange,borderRadius:20,paddingHorizontal:16,alignItems:'center',justifyContent:'center',...SHADOW.glow}} onPress={applyPromo}>
                <Text style={{color:'#FFF',fontWeight:'700',fontSize:13}}>Apply</Text>
              </TouchableOpacity>
            </View>
            {appliedPromo&&(
              <View style={{backgroundColor:C.greenBg,borderRadius:10,padding:8,marginTop:8,flexDirection:'row',justifyContent:'space-between',borderWidth:0.5,borderColor:C.greenBd}}>
                <Text style={{color:C.green,fontWeight:'600',fontSize:12}}>✅ {appliedPromo.label}</Text>
                <TouchableOpacity onPress={()=>{setAppliedPromo(null);setPromoCode('');}}><Text style={{color:C.red,fontSize:12}}>Remove</Text></TouchableOpacity>
              </View>
            )}
            <Text style={{color:C.muted,fontSize:11,marginTop:8}}>Try: VEGA50 | FIRST20 | FLAT100 | VIZAG20</Text>
          </Card>
          <TouchableOpacity style={{backgroundColor:C.goldSolid,borderRadius:20,padding:14,marginBottom:12,flexDirection:'row',alignItems:'center',borderWidth:0.5,borderColor:C.goldBd}} onPress={()=>setUseWallet(w=>!w)}>
            <View style={{width:42,height:42,borderRadius:14,backgroundColor:C.goldBd,alignItems:'center',justifyContent:'center',marginRight:12}}><Text style={{fontSize:20}}>💰</Text></View>
            <View style={{flex:1}}>
              <Text style={{fontWeight:'700',color:C.text}}>VEGA Wallet — ₹{wallet}</Text>
              <Text style={{color:C.gold,fontSize:12,marginTop:1}}>{useWallet?'Wallet balance will be applied':'Tap to use'}</Text>
            </View>
            <View style={{width:28,height:28,borderRadius:9,backgroundColor:useWallet?C.green:C.border,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:useWallet?C.greenBd:C.border}}>
              {useWallet&&<Text style={{color:'#FFF',fontSize:14,fontWeight:'800'}}>✓</Text>}
            </View>
          </TouchableOpacity>
          {/* ✅ BOOKING MODE — 3 modes: Now / Schedule (multi-date) / Subscription (Bug 4 + 5) */}
          <Card style={{marginBottom:12}}>
            <Text style={{fontWeight:'700',color:C.text,fontSize:14,marginBottom:12}}>⏰ When do you need this?</Text>
            <View style={{flexDirection:'row',backgroundColor:C.bg,borderRadius:14,padding:3,marginBottom:12}}>
              {[
                {id:'instant',     label:'⚡ Book Now'},
                {id:'scheduled',   label:'📅 Schedule'},
                {id:'subscription',label:'🔁 Monthly'},
              ].map(m=>(
                <TouchableOpacity key={m.id}
                  style={{flex:1,paddingVertical:10,borderRadius:11,alignItems:'center',backgroundColor:bookMode===m.id?C.orange:'transparent',...(bookMode===m.id?SHADOW.glow:{})}}
                  onPress={()=>{setBookMode(m.id);setSelTime(null);setSelDatesMulti([]);}}>
                  <Text style={{fontSize:10,fontWeight:'700',color:bookMode===m.id?'#FFF':C.muted}}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── INSTANT ─────────────────────────────────────────── */}
            {bookMode==='instant'&&(
              <View style={{backgroundColor:C.greenBg,borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8,borderWidth:0.5,borderColor:C.greenBd}}>
                <Text style={{fontSize:16}}>⚡</Text>
                <Text style={{color:C.green,fontWeight:'600',fontSize:12}}>Professional arrives in 30–45 minutes</Text>
              </View>
            )}

            {/* ── SCHEDULED — Bug 4: Multi-date selection ─────────── */}
            {bookMode==='scheduled'&&(
              <>
                <View style={{backgroundColor:C.orangeBg,borderRadius:10,padding:8,marginBottom:10,borderWidth:0.5,borderColor:C.orangeBd}}>
                  <Text style={{color:C.orange,fontSize:11,fontWeight:'600'}}>📅 Tap multiple dates to schedule recurring visits — single payment for all.</Text>
                </View>
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:10}}>Select Date(s)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                  {DATES.map((d,i)=>{
                    // FIX: Use d.iso (added to getDates) — old fallback used today's
                    // month for ALL 7 dates, causing month-rollover bug.
                    const dateStr = d.iso;
                    const isSelected = selDatesMulti.includes(dateStr);
                    return (
                      <TouchableOpacity key={i}
                        style={{marginRight:8,width:62,paddingVertical:12,borderRadius:16,alignItems:'center',backgroundColor:isSelected?C.orange:C.card,borderWidth:isSelected?2:0.5,borderColor:isSelected?C.orange:C.border2,...(isSelected?SHADOW.glow:{})}}
                        onPress={()=>{
                          setSelDatesMulti(prev =>
                            prev.includes(dateStr)
                              ? prev.filter(x => x !== dateStr)
                              : [...prev, dateStr].sort()
                          );
                        }}>
                        <Text style={{fontSize:9,color:isSelected?'rgba(255,255,255,0.8)':C.muted,fontWeight:'600'}}>{d.label}</Text>
                        <DText style={{fontSize:20,fontWeight:'700',color:isSelected?'#FFF':C.text,marginTop:2}}>{d.num}</DText>
                        <Text style={{fontSize:9,color:isSelected?'rgba(255,255,255,0.7)':C.muted}}>{d.mon}</Text>
                        {isSelected && <Text style={{color:'#FFF',fontSize:10,marginTop:2}}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {selDatesMulti.length > 0 && (
                  <View style={{backgroundColor:C.greenBg,borderRadius:10,padding:10,marginBottom:10,borderWidth:0.5,borderColor:C.greenBd}}>
                    <Text style={{color:C.green,fontSize:12,fontWeight:'700'}}>✅ {selDatesMulti.length} visit{selDatesMulti.length>1?'s':''} selected</Text>
                    <Text style={{color:C.green,fontSize:10,marginTop:2}}>Total: ₹{cartTotal} × {selDatesMulti.length} = ₹{cartTotal * selDatesMulti.length}</Text>
                  </View>
                )}
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:10}}>Select Time</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                  {TIMES.map((t,i)=>(
                    <TouchableOpacity key={i} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:18,backgroundColor:selTime===t?C.orange:C.card,borderWidth:0.5,borderColor:selTime===t?C.orange:C.border2,...(selTime===t?SHADOW.glow:{})}} onPress={()=>setSelTime(t)}>
                      <Text style={{fontSize:12,fontWeight:'600',color:selTime===t?'#FFF':C.text2}}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!selTime&&<Text style={{color:C.red,fontSize:11,marginTop:8}}>⚠️ Please select a time</Text>}
                {selDatesMulti.length===0&&<Text style={{color:C.red,fontSize:11,marginTop:4}}>⚠️ Please select at least 1 date</Text>}
              </>
            )}

            {/* ── SUBSCRIPTION — Bug 5: Monthly with start/end + days/week ── */}
            {bookMode==='subscription'&&(
              <>
                <View style={{backgroundColor:C.tealBg,borderRadius:10,padding:8,marginBottom:12,borderWidth:0.5,borderColor:C.tealBd}}>
                  <Text style={{color:C.teal,fontSize:11,fontWeight:'600'}}>🔁 Pick start + end date, choose days of week. 10% discount on subscription. Single upfront payment.</Text>
                </View>
                {/* Warning if multiple services — subscription is per-service */}
                {cart.length > 1 && (
                  <View style={{backgroundColor:'rgba(232,82,10,0.10)',borderRadius:10,padding:10,marginBottom:12,borderWidth:0.5,borderColor:'rgba(232,82,10,0.30)',flexDirection:'row',gap:8,alignItems:'flex-start'}}>
                    <Text style={{fontSize:14}}>⚠️</Text>
                    <View style={{flex:1}}>
                      <Text style={{color:C.orange,fontSize:11,fontWeight:'700',marginBottom:3}}>Subscription is for ONE service</Text>
                      <Text style={{color:C.muted,fontSize:10,lineHeight:14}}>You have {cart.length} services in cart. When you confirm, you'll pick which one to subscribe to. Book the others separately.</Text>
                    </View>
                  </View>
                )}

                {/* Start Date — quick picker (next 30 days) */}
                <Text style={{fontSize:12,fontWeight:'700',color:C.text,marginBottom:6}}>Start Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                  {Array.from({length:30}).map((_,i)=>{
                    const d = new Date();
                    d.setDate(d.getDate() + i);
                    const isSelected = subStartDate && subStartDate.toDateString() === d.toDateString();
                    return (
                      <TouchableOpacity key={i}
                        style={{marginRight:6,width:54,paddingVertical:10,borderRadius:14,alignItems:'center',backgroundColor:isSelected?C.teal:C.card,borderWidth:isSelected?2:0.5,borderColor:isSelected?C.teal:C.border2}}
                        onPress={()=>setSubStartDate(d)}>
                        <Text style={{fontSize:9,color:isSelected?'rgba(255,255,255,0.85)':C.muted,fontWeight:'600'}}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}</Text>
                        <DText style={{fontSize:17,fontWeight:'700',color:isSelected?'#FFF':C.text,marginTop:1}}>{d.getDate()}</DText>
                        <Text style={{fontSize:8,color:isSelected?'rgba(255,255,255,0.7)':C.muted}}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* End Date — needs start date first */}
                {subStartDate && (
                  <>
                    <Text style={{fontSize:12,fontWeight:'700',color:C.text,marginBottom:6}}>End Date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                      {[7, 14, 30, 60, 90].map((days)=>{
                        const d = new Date(subStartDate);
                        d.setDate(d.getDate() + days);
                        const isSelected = subEndDate && subEndDate.toDateString() === d.toDateString();
                        return (
                          <TouchableOpacity key={days}
                            style={{marginRight:8,paddingHorizontal:14,paddingVertical:10,borderRadius:14,backgroundColor:isSelected?C.teal:C.card,borderWidth:isSelected?2:0.5,borderColor:isSelected?C.teal:C.border2}}
                            onPress={()=>setSubEndDate(d)}>
                            <Text style={{fontSize:11,color:isSelected?'#FFF':C.muted,fontWeight:'700'}}>{days===30?'1 Month':days===60?'2 Months':days===90?'3 Months':days===14?'2 Weeks':'1 Week'}</Text>
                            <Text style={{fontSize:9,color:isSelected?'rgba(255,255,255,0.7)':C.muted2,marginTop:2}}>Until {d.toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </>
                )}

                {/* Days of week */}
                <Text style={{fontSize:12,fontWeight:'700',color:C.text,marginBottom:8}}>Days of Week (tap to select)</Text>
                <View style={{flexDirection:'row',gap:6,marginBottom:14}}>
                  {[['S',0],['M',1],['T',2],['W',3],['T',4],['F',5],['S',6]].map(([lbl,idx])=>{
                    const isSelected = subDays.includes(idx);
                    return (
                      <TouchableOpacity key={idx}
                        style={{flex:1,paddingVertical:12,borderRadius:12,alignItems:'center',backgroundColor:isSelected?C.teal:C.card,borderWidth:isSelected?2:0.5,borderColor:isSelected?C.teal:C.border2}}
                        onPress={()=>setSubDays(prev => prev.includes(idx) ? prev.filter(x=>x!==idx) : [...prev, idx])}>
                        <Text style={{fontSize:13,fontWeight:'800',color:isSelected?'#FFF':C.muted}}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Time slot */}
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:10}}>Service Time</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:10}}>
                  {TIMES.map((t,i)=>(
                    <TouchableOpacity key={i} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:18,backgroundColor:selTime===t?C.teal:C.card,borderWidth:0.5,borderColor:selTime===t?C.teal:C.border2}} onPress={()=>setSelTime(t)}>
                      <Text style={{fontSize:12,fontWeight:'600',color:selTime===t?'#FFF':C.text2}}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Summary */}
                {subStartDate && subEndDate && subDays.length > 0 && (
                  <View style={{backgroundColor:C.tealBg,borderRadius:12,padding:12,borderWidth:0.5,borderColor:C.tealBd,marginTop:6}}>
                    <Text style={{color:C.teal,fontSize:12,fontWeight:'700',marginBottom:6}}>📋 Subscription Summary</Text>
                    <Text style={{color:C.text,fontSize:11,marginBottom:2}}>From: {subStartDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</Text>
                    <Text style={{color:C.text,fontSize:11,marginBottom:2}}>To: {subEndDate.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</Text>
                    <Text style={{color:C.text,fontSize:11,marginBottom:2}}>Days: {subDays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</Text>
                    <View style={{height:0.5,backgroundColor:C.tealBd,marginVertical:8}}/>
                    <Text style={{color:C.text,fontSize:13,fontWeight:'700'}}>{subVisits} visits × ₹{cartTotal} = ₹{baseBeforeDisc}</Text>
                    {subscriptionDiscount > 0 && (
                      <Text style={{color:C.green,fontSize:11,marginTop:2}}>Subscription discount (10%): –₹{subscriptionDiscount}</Text>
                    )}
                  </View>
                )}
                {(!subStartDate || !subEndDate) && <Text style={{color:C.red,fontSize:11,marginTop:6}}>⚠️ Please select start + end dates</Text>}
                {subDays.length === 0 && <Text style={{color:C.red,fontSize:11,marginTop:4}}>⚠️ Please select at least 1 day of week</Text>}
                {!selTime && <Text style={{color:C.red,fontSize:11,marginTop:4}}>⚠️ Please select a time</Text>}
              </>
            )}
          </Card>
          <Card style={{marginBottom:12}}>
            <Text style={{fontWeight:'700',color:C.text,fontSize:14,marginBottom:12}}>Bill Details</Text>
            {cart.map((i,idx)=><BR key={idx} l={i.name} r={`₹${i.price}`}/>)}
            {promoSave>0&&<BR l="Promo discount" r={`–₹${promoSave}`} rc={C.green}/>}
            {walletSave>0&&<BR l="Wallet used" r={`–₹${walletSave}`} rc={C.gold}/>}
            <BR l="Platform fee" r="₹29"/>
            <View style={{height:1,backgroundColor:C.border,marginVertical:10}}/>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{fontWeight:'800',fontSize:16,color:C.text}}>Total Payable</Text>
              <DText style={{fontWeight:'700',fontSize:24,color:C.orange}}>₹{finalTotal}</DText>
            </View>
          </Card>
          <Card style={{marginBottom:20}}>
            <Text style={{fontWeight:'700',color:C.text,marginBottom:12}}>Pay with</Text>
            {[['upi','📱','UPI','GPay, PhonePe, BHIM'],['card','💳','Card','Debit / Credit Card'],['netbanking','🏦','Net Banking','All major banks'],['cash','💵','Cash','Pay after service']].map(([id,ic,lb,sub])=>(
              <TouchableOpacity key={id} style={{flexDirection:'row',alignItems:'center',paddingVertical:13,borderBottomWidth:id!=='cash'?0.5:0,borderBottomColor:C.border2}} onPress={()=>setSelPayMethod(id)}>
                <View style={{width:40,height:40,borderRadius:12,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',marginRight:12,borderWidth:0.5,borderColor:C.border}}><Text style={{fontSize:20}}>{ic}</Text></View>
                <View style={{flex:1}}><Text style={{fontWeight:'600',color:C.text,fontSize:14}}>{lb}</Text><Text style={{color:C.muted,fontSize:12}}>{sub}</Text></View>
                <View style={{width:22,height:22,borderRadius:11,borderWidth:1.5,borderColor:selPayMethod===id?C.orange:C.border,backgroundColor:selPayMethod===id?C.orange:'transparent',alignItems:'center',justifyContent:'center'}}>
                  {selPayMethod===id&&<View style={{width:8,height:8,borderRadius:4,backgroundColor:'#FFF'}}/>}
                </View>
              </TouchableOpacity>
            ))}
          </Card>
          <TouchableOpacity style={[S.btn,{paddingVertical:18,borderRadius:30,...SHADOW.glow},placing&&{opacity:0.4}]} disabled={placing} onPress={handleConfirmBooking}>
            {placing?<ActivityIndicator color="#FFF"/>:<Text style={[S.btnT,{fontSize:17}]}>🔒 Confirm Booking — ₹{finalTotal}</Text>}
          </TouchableOpacity>
          <View style={{height:40}}/>
        </ScrollView>
        <MockPayModal
          visible={showPayModal}
          amount={finalTotal}
          method={selPayMethod}
          onSuccess={()=>{ setShowPayModal(false); placeOrder(); }}
        />
      </SafeAreaView>
    );
  }

  // ── TASK DETAIL (Pronto-style with Includes/Excludes)
  if(screen==='taskDetail' && activeTask){
    const qty = taskCart[activeTask.id] || 0;
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('home')} style={S.backBtn}>
            <Text style={{fontSize:20,color:C.text}}>‹</Text>
          </TouchableOpacity>
          <DText style={{fontSize:17,fontWeight:'700',color:C.text}}>Service details</DText>
          <View style={{width:36}}/>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:140}}>
          {/* Hero image area */}
          <View style={{marginHorizontal:16,marginTop:12,height:180,borderRadius:20,backgroundColor:`${activeTask.color}15`,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.border2}}>
            <Text style={{fontSize:100}}>{activeTask.icon}</Text>
            <View style={{position:'absolute',top:12,left:12,backgroundColor:'rgba(255,255,255,0.95)',paddingHorizontal:10,paddingVertical:4,borderRadius:12,flexDirection:'row',alignItems:'center',gap:4}}>
              <Text style={{fontSize:11,color:C.star}}>★</Text>
              <Text style={{fontSize:11,fontWeight:'700',color:C.text}}>4.9 (2.5k)</Text>
            </View>
          </View>

          {/* Name + price */}
          <View style={{marginHorizontal:16,marginTop:16}}>
            <DText style={{fontSize:24,fontWeight:'800',color:C.text}}>{activeTask.name}</DText>
            <Text style={{fontSize:13,color:C.muted,marginTop:4}}>{activeTask.desc}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:10,marginTop:10}}>
              <DText style={{fontSize:22,fontWeight:'800',color:C.orange}}>₹{activeTask.price}</DText>
              <Text style={{fontSize:14,color:C.muted2,textDecorationLine:'line-through'}}>₹{activeTask.mrp}</Text>
              <View style={{backgroundColor:C.greenBg,paddingHorizontal:8,paddingVertical:3,borderRadius:8}}>
                <Text style={{fontSize:11,color:C.green,fontWeight:'800'}}>{Math.round(((activeTask.mrp-activeTask.price)/activeTask.mrp)*100)}% OFF</Text>
              </View>
            </View>
            <Text style={{fontSize:12,color:C.muted,marginTop:4}}>Per {activeTask.unit}</Text>
          </View>

          {/* Includes */}
          <View style={{marginHorizontal:16,marginTop:22,backgroundColor:C.card,borderRadius:18,padding:16,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
            <DText style={{fontSize:17,fontWeight:'700',color:C.text,marginBottom:12}}>✅ Includes</DText>
            {(activeTask.includes||[]).map((item,i)=>(
              <View key={i} style={{flexDirection:'row',alignItems:'flex-start',marginBottom:9,gap:10}}>
                <View style={{width:20,height:20,borderRadius:10,backgroundColor:C.greenBg,alignItems:'center',justifyContent:'center',marginTop:1}}>
                  <Text style={{fontSize:12,color:C.green,fontWeight:'800'}}>✓</Text>
                </View>
                <Text style={{flex:1,fontSize:13,color:C.text,lineHeight:19}}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Does not include */}
          <View style={{marginHorizontal:16,marginTop:14,backgroundColor:C.card,borderRadius:18,padding:16,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
            <DText style={{fontSize:17,fontWeight:'700',color:C.text,marginBottom:12}}>❌ Does not include</DText>
            {(activeTask.excludes||[]).map((item,i)=>(
              <View key={i} style={{flexDirection:'row',alignItems:'flex-start',marginBottom:9,gap:10}}>
                <View style={{width:20,height:20,borderRadius:10,backgroundColor:'#FAEAE8',alignItems:'center',justifyContent:'center',marginTop:1}}>
                  <Text style={{fontSize:11,color:'#B02818',fontWeight:'800'}}>✕</Text>
                </View>
                <Text style={{flex:1,fontSize:13,color:C.muted,lineHeight:19}}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Note */}
          <View style={{marginHorizontal:16,marginTop:14,backgroundColor:C.orangeBg,borderRadius:14,padding:12,flexDirection:'row',gap:10,borderWidth:0.5,borderColor:C.orangeBd}}>
            <Text style={{fontSize:18}}>💡</Text>
            <Text style={{flex:1,fontSize:12,color:C.muted,lineHeight:17}}>Please provide all necessary equipment and supplies to our VEGA professional for best results.</Text>
          </View>
        </ScrollView>

        {/* Bottom fixed bar */}
        <View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:C.card,borderTopWidth:1,borderTopColor:C.border2,paddingHorizontal:16,paddingTop:12,paddingBottom:18,flexDirection:'row',alignItems:'center',gap:12,...SHADOW.floating}}>
          {qty===0?(
            <TouchableOpacity onPress={()=>{addTask(activeTask.id);}} style={{flex:1,backgroundColor:C.orange,borderRadius:14,paddingVertical:14,alignItems:'center',...SHADOW.glow,shadowColor:C.orange}}>
              <Text style={{color:'#FFF',fontSize:15,fontWeight:'700'}}>Add to cart · ₹{activeTask.price}</Text>
            </TouchableOpacity>
          ):(
            <>
              <View style={{flexDirection:'row',alignItems:'center',backgroundColor:C.orangeBg,borderRadius:14,paddingHorizontal:10,paddingVertical:6,gap:14,borderWidth:1,borderColor:C.orangeBd}}>
                <TouchableOpacity onPress={()=>removeTask(activeTask.id)} style={{width:30,height:30,borderRadius:15,backgroundColor:C.orange,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#FFF',fontSize:18,fontWeight:'900',lineHeight:22}}>−</Text>
                </TouchableOpacity>
                <Text style={{fontSize:16,fontWeight:'800',color:C.text,minWidth:20,textAlign:'center'}}>{qty}</Text>
                <TouchableOpacity onPress={()=>addTask(activeTask.id)} style={{width:30,height:30,borderRadius:15,backgroundColor:C.orange,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#FFF',fontSize:18,fontWeight:'900',lineHeight:22}}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={()=>setScreen('home')} style={{flex:1,backgroundColor:C.orange,borderRadius:14,paddingVertical:14,alignItems:'center',...SHADOW.glow,shadowColor:C.orange}}>
                <Text style={{color:'#FFF',fontSize:14,fontWeight:'700'}}>Added · ₹{activeTask.price*qty} ›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── TRACK ──────────────────────────────────────────────────────────
  // Area → approximate GPS coordinates for Visakhapatnam
  const AREA_COORDS = {
    'Madhurawada':    [17.7763, 83.3653],
    'Rushikonda':     [17.7619, 83.3895],
    'MVP Colony':     [17.7256, 83.3191],
    'Gajuwaka':       [17.6866, 83.2091],
    'Seethammadhara': [17.7301, 83.3234],
    'Dwaraka Nagar':  [17.7201, 83.3012],
    'BHPV':           [17.6821, 83.2184],
    'Kommadi':        [17.7932, 83.3742],
  };

  const buildTrackMapHtml = (workerLat, workerLng, destArea) => {
    const destCoords = AREA_COORDS[destArea] || [17.7231, 83.3012];
    const centerLat  = workerLat || destCoords[0];
    const centerLng  = workerLng || destCoords[1];
    const hasWorker  = !!(workerLat && workerLng);
    return `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        *{margin:0;padding:0;box-sizing:border-box;}
        html,body,#map{width:100%;height:100%;background:#0F0A06;}
        .worker-pin{background:#E8520A;width:38px;height:38px;border-radius:50%;border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;font-size:18px;
          box-shadow:0 0 12px rgba(232,82,10,0.7);}
        .dest-pin{background:#EF4444;width:32px;height:32px;border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 0 8px rgba(239,68,68,0.6);}
        .dest-inner{transform:rotate(45deg);font-size:14px;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}
        .pulse{position:absolute;width:52px;height:52px;border-radius:50%;border:2px solid #E8520A;
          animation:pulse 2s ease-out infinite;top:-7px;left:-7px;}
        @keyframes pulse{0%{transform:scale(1);opacity:0.8;}100%{transform:scale(2);opacity:0;}}
        .leaflet-control-attribution{display:none;}
      </style>
    </head><body>
    <div id="map"></div>
    <script>
      var map = L.map('map',{zoomControl:false,attributionControl:false})
        .setView([${centerLat},${centerLng}], ${hasWorker ? 14 : 15});
      window.liveMap = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {maxZoom:19}).addTo(map);

      // Destination marker (customer address)
      var destIcon = L.divIcon({
        className:'',
        html:'<div class="dest-pin"><div class="dest-inner">📍</div></div>',
        iconSize:[32,32], iconAnchor:[16,32]
      });
      L.marker([${destCoords[0]},${destCoords[1]}],{icon:destIcon})
        .bindTooltip('Your address',{permanent:false,direction:'top'}).addTo(map);

      ${hasWorker ? `
      // Worker marker — moves in real-time via injectJavaScript
      var workerIcon = L.divIcon({
        className:'',
        html:'<div style="position:relative"><div class="pulse"></div><div class="worker-pin">🏍️</div></div>',
        iconSize:[38,38], iconAnchor:[19,19]
      });
      window.workerMarker = L.marker([${workerLat},${workerLng}],{icon:workerIcon})
        .bindTooltip('Professional on the way',{permanent:false,direction:'top'}).addTo(map);

      // Route line between worker and destination
      window.routeLine = L.polyline(
        [[${workerLat},${workerLng}],[${destCoords[0]},${destCoords[1]}]],
        {color:'#E8520A',weight:3,opacity:0.7,dashArray:'8,6'}
      ).addTo(map);

      // Fit both markers
      map.fitBounds([[${workerLat},${workerLng}],[${destCoords[0]},${destCoords[1]}]],
        {padding:[30,30]});
      ` : `
      // No GPS yet — show area center with destination only
      L.circle([${destCoords[0]},${destCoords[1]}],
        {color:'#E8520A',fillColor:'#E8520A',fillOpacity:0.08,radius:400}).addTo(map);
      `}
    </script></body></html>`;
  };

  // ════════════════════════════════════════════════════════════════
  // Bug 7: SAVED ADDRESSES MANAGEMENT SCREEN
  // ════════════════════════════════════════════════════════════════
  if(screen==='addresses'){
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('main')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Saved Addresses</DText>
          <View style={{width:36}}/>
        </View>
        <View style={{height:3,backgroundColor:C.orange}}/>
        <ScrollView style={{flex:1,padding:16}}>
          {savedAddrs.length === 0 && (
            <Card style={{padding:30,alignItems:'center',marginTop:40}}>
              <Text style={{fontSize:48,marginBottom:14}}>📍</Text>
              <DText style={{fontSize:17,fontWeight:'700',color:C.text,marginBottom:6,textAlign:'center'}}>No saved addresses yet</DText>
              <Text style={{fontSize:13,color:C.muted,textAlign:'center',lineHeight:18}}>
                Book your first service. You'll get a chance to save the address — then it auto-fills next time.
              </Text>
            </Card>
          )}
          {savedAddrs.map((addr) => (
            <Card key={addr.id} style={{marginBottom:12,padding:14}}>
              <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
                <Text style={{fontSize:22,marginRight:10}}>
                  {addr.label === 'Home' ? '🏠' : addr.label === 'Office' ? '🏢' : '📍'}
                </Text>
                <View style={{flex:1}}>
                  <Text style={{fontWeight:'700',color:C.text,fontSize:15}}>
                    {addr.label || 'Saved'}
                    {addr.isDefault && (
                      <Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}> ★ Default</Text>
                    )}
                  </Text>
                  <Text style={{fontSize:12,color:C.muted,marginTop:2}}>
                    {[addr.flat, addr.buildingName, addr.streetName, addr.landmark, addr.area].filter(Boolean).join(', ')}
                  </Text>
                </View>
              </View>
              <View style={{flexDirection:'row',gap:8,marginTop:6}}>
                {!addr.isDefault && (
                  <TouchableOpacity
                    style={{flex:1,padding:10,borderRadius:14,borderWidth:0.5,borderColor:C.goldBd,backgroundColor:C.goldSolid,alignItems:'center'}}
                    onPress={async()=>{
                      const ok = await setDefaultAddress(phone, addr.id);
                      if(ok) Alert.alert('✅ Default set', `${addr.label || 'This address'} is now your default.`);
                    }}>
                    <Text style={{color:C.gold,fontSize:12,fontWeight:'700'}}>★ Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{flex:1,padding:10,borderRadius:14,borderWidth:0.5,borderColor:C.redBd,backgroundColor:C.redSolid,alignItems:'center'}}
                  onPress={()=>{
                    Alert.alert(
                      'Delete address?',
                      `Remove ${addr.label || 'this address'}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: async()=>{
                          const ok = await deleteAddress(phone, addr.id);
                          if(!ok) Alert.alert('Failed', 'Could not delete. Try again.');
                        }},
                      ]
                    );
                  }}>
                  <Text style={{color:C.red,fontSize:12,fontWeight:'700'}}>🗑 Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
          <View style={{height:30}}/>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if(screen==='track'&&trackOrd){
    const pro=trackOrd.professional;
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>{setScreen('main');setTab('bookings');}} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Track Booking</DText>
          <View style={{width:36}}/>
        </View>
        <ScrollView style={{padding:16}}>
          {/* OTP Card — dark premium */}
          <View style={{backgroundColor:C.dark,borderRadius:24,padding:24,marginBottom:14,alignItems:'center',...SHADOW.glow,shadowColor:C.orangeSoft,borderWidth:0.5,borderColor:C.orange+'40'}}>
            <Text style={{color:'rgba(255,255,255,0.55)',fontSize:11,letterSpacing:2,marginBottom:10}}>SHOW THIS OTP TO PROFESSIONAL</Text>
            <DText style={{fontSize:48,fontWeight:'700',color:C.orangeSoft,letterSpacing:12}}>{trackOrd.otp}</DText>
            <Text style={{color:'rgba(255,255,255,0.35)',fontSize:12,marginTop:10}}>Required to start service</Text>
          </View>
          {pro&&(
            <Card style={{marginBottom:12}}>
              <Text style={{fontSize:11,fontWeight:'700',color:C.orange,letterSpacing:1,marginBottom:12}}>YOUR PROFESSIONAL</Text>
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <View style={{width:64,height:64,borderRadius:32,backgroundColor:pro.color+'22',alignItems:'center',justifyContent:'center',marginRight:14,borderWidth:2,borderColor:pro.color+'50',...SHADOW.soft,shadowColor:pro.color}}>
                  <DText style={{fontSize:26,fontWeight:'700',color:pro.color}}>{pro.initial}</DText>
                </View>
                <View style={{flex:1}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:3}}>
                    <DText style={{fontSize:16,fontWeight:'700',color:C.text}}>{pro.name}</DText>
                    <Badge label={pro.badge} color={C.green}/>
                  </View>
                  <View style={{flexDirection:'row',alignItems:'center',gap:4,marginBottom:3}}>
                    <Text style={{color:C.star,fontSize:14}}>★</Text>
                    <Text style={{fontWeight:'700',color:C.text}}>{pro.rating}</Text>
                    <Text style={{color:C.muted,fontSize:12}}>· {pro.jobs} jobs · {pro.exp}</Text>
                  </View>
                  <Text style={{fontSize:12,color:C.muted}}>Verified · VEGA trained</Text>
                </View>
                <TouchableOpacity style={{width:44,height:44,borderRadius:22,backgroundColor:C.greenBg,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.greenBd,...SHADOW.card}}>
                  <Text style={{fontSize:20}}>📞</Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}
          {/* ── LIVE GPS MAP ─────────────────────────────── */}
          <Card style={{marginBottom:12,overflow:'hidden',padding:0}}>
            <View style={{height:200,overflow:'hidden',position:'relative'}}>
              <WebView
                ref={trackMapRef}
                source={{ html: buildTrackMapHtml(
                  workerLoc?.lat, workerLoc?.lng,
                  trackOrd?.area || selArea || 'Madhurawada'
                )}}
                style={{flex:1,backgroundColor:'#0F0A06'}}
                scrollEnabled={false}
                javaScriptEnabled={true}
                originWhitelist={['*']}
              />
              {/* Live badge overlay */}
              <View style={{position:'absolute',top:10,right:10,backgroundColor:'rgba(232,82,10,0.92)',paddingHorizontal:10,paddingVertical:5,borderRadius:20,flexDirection:'row',alignItems:'center',gap:5}}>
                <View style={{width:7,height:7,borderRadius:4,backgroundColor:'#FFF'}}/>
                <Text style={{color:'#FFF',fontSize:11,fontWeight:'800'}}>
                  {workerLoc ? 'LIVE' : 'LOCATING...'}
                </Text>
              </View>
              {!workerLoc&&(
                <View style={{position:'absolute',bottom:10,left:10,backgroundColor:'rgba(0,0,0,0.75)',paddingHorizontal:10,paddingVertical:5,borderRadius:12}}>
                  <Text style={{color:'#aaa',fontSize:11}}>Waiting for worker GPS...</Text>
                </View>
              )}
            </View>
            <View style={{padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <View>
                <Text style={{fontWeight:'700',color:C.text}}>📍 {trackOrd?.area||selArea||'Visakhapatnam'}</Text>
                <Text style={{color:C.muted,fontSize:12,marginTop:2}}>
                  {workerLoc ? '🏍️ Worker location updating live' : 'Professional assigned — locating...'}
                </Text>
              </View>
              <Badge label={workerLoc ? 'Live ●' : 'Assigned'} color={workerLoc ? C.green : C.orange}/>
            </View>
          </Card>
          <Card style={{marginBottom:12}}>
            <DText style={{fontWeight:'700',color:C.text,fontSize:15,marginBottom:10}}>Order #{trackOrd.orderId}</DText>
            {trackOrd.items?.map((item,i)=>(
              <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
                <View style={{width:36,height:36,borderRadius:12,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18}}>{item.icon}</Text></View>
                <Text style={{flex:1,fontSize:13,fontWeight:'600',color:C.text}} numberOfLines={1}>{item.name}</Text>
                <DText style={{fontWeight:'700',color:C.orange,fontSize:15}}>₹{item.price}</DText>
              </View>
            ))}
            <View style={{height:1,backgroundColor:C.border,marginVertical:10}}/>
            <Text style={{color:C.muted,fontSize:13}}>📅 {trackOrd.slot}</Text>
            <Text style={{color:C.muted,fontSize:13,marginTop:4}}>📍 {trackOrd.addr}</Text>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:10}}>
              <Text style={{fontWeight:'700',color:C.text,fontSize:15}}>Total Paid</Text>
              <DText style={{fontWeight:'700',color:C.orange,fontSize:18}}>₹{trackOrd.total}</DText>
            </View>
          </Card>
          <Card style={{marginBottom:12}}>
            <DText style={{fontWeight:'700',color:C.text,fontSize:15,marginBottom:16}}>Live Status</DText>
            {(()=>{
              const st = trackOrd.status||'confirmed';
              const isWay  = ['on_the_way','in_progress','completed'].includes(st);
              const isProg = ['in_progress','completed'].includes(st);
              const isDone = st==='completed';
              return [{l:'Booking Confirmed',done:true,t:trackOrd.time||''},
                {l:'Professional Assigned',done:!!trackOrd.assignedWorkerId,t:trackOrd.assignedWorkerName||''},
                {l:'On the Way',done:isWay,t:isWay?'Professional is on the way':''},
                {l:'Service Started',done:isProg,t:isProg?'Service in progress':''},
                {l:'Completed',done:isDone,t:isDone?'Service completed ✅':''}];
            })().map((step,i)=>(
              <View key={i} style={{flexDirection:'row',alignItems:'flex-start',marginBottom:i<4?14:0}}>
                <View style={{alignItems:'center',marginRight:14}}>
                  <View style={{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',backgroundColor:step.done?C.orange:C.light,...(step.done?SHADOW.glow:{})}}>
                    {step.done?<Text style={{color:'#FFF',fontSize:13,fontWeight:'800'}}>✓</Text>:<Text style={{color:C.muted2,fontSize:11}}>{i+1}</Text>}
                  </View>
                  {i<4&&<View style={{width:2,height:16,backgroundColor:step.done?C.orange:C.border,marginTop:2}}/>}
                </View>
                <View style={{flex:1,paddingTop:4}}>
                  <Text style={{fontSize:14,color:step.done?C.text:C.muted,fontWeight:step.done?'600':'400'}}>{step.l}</Text>
                  {step.t!==''&&<Text style={{fontSize:11,color:C.muted,marginTop:1}}>{step.t}</Text>}
                </View>
              </View>
            ))}
          </Card>
          {!trackOrd.rated&&<TouchableOpacity style={[S.btn,{marginTop:8,paddingVertical:16,borderRadius:30,...SHADOW.glow}]} onPress={()=>{setRatingOrd(trackOrd);setUserRating(0);setRatingNote('');setScreen('rate');}}><Text style={S.btnT}>⭐ Rate this Service</Text></TouchableOpacity>}
          {trackOrd.rated&&<Card style={{marginTop:8,backgroundColor:C.greenSolid,borderColor:C.greenBd,alignItems:'center'}}><Text style={{color:C.green,fontWeight:'700',fontSize:14}}>✅ Rated {trackOrd.rating}★ — Thank you!</Text></Card>}

          {/* ── BOOK AGAIN button (completed orders) ── */}
          {trackOrd.status==='completed'&&(
            <TouchableOpacity
              style={{marginTop:10,borderWidth:1.5,borderColor:C.orange,borderRadius:30,paddingVertical:14,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:8,backgroundColor:C.orangeSolid}}
              onPress={()=>{
                Alert.alert(
                  '🔄 Book Again?',
                  `Re-book "${trackOrd.items?.[0]?.name||'same service'}" to the same address?`,
                  [
                    {text:'Cancel',style:'cancel'},
                    {text:'Book Again',onPress:()=>{
                      setScreen('main');
                      setTab('services');
                      Alert.alert('✅ Ready!','Select your service and we\'ll pre-fill your address. Same great VEGA quality!');
                    }},
                  ]
                );
              }}>
              <Text style={{fontSize:18}}>🔄</Text>
              <Text style={{color:C.orange,fontWeight:'800',fontSize:15}}>Book Again</Text>
            </TouchableOpacity>
          )}
          <View style={{height:32}}/>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── RATING
  if(screen==='rate'&&ratingOrd){
    const pro=ratingOrd.professional;
    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={S.topBar}>
          <TouchableOpacity onPress={()=>setScreen('track')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Rate Experience</DText>
          <View style={{width:36}}/>
        </View>
        <ScrollView style={{flex:1,padding:16}}>
          {pro&&(
            <Card style={{alignItems:'center',padding:28,marginBottom:16}}>
              <View style={{width:84,height:84,borderRadius:42,backgroundColor:pro.color+'22',alignItems:'center',justifyContent:'center',marginBottom:14,borderWidth:2.5,borderColor:pro.color+'50',...SHADOW.soft,shadowColor:pro.color}}>
                <DText style={{fontSize:34,fontWeight:'700',color:pro.color}}>{pro.initial}</DText>
              </View>
              <DText style={{fontSize:19,fontWeight:'700',color:C.text,marginBottom:4}}>{pro.name}</DText>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text style={{color:C.star,fontSize:15}}>★</Text><Text style={{color:C.muted,fontSize:13}}>{pro.rating} · {pro.jobs} jobs</Text></View>
            </Card>
          )}
          <Card style={{alignItems:'center',marginBottom:16,padding:28}}>
            <DText style={{fontSize:18,fontWeight:'700',color:C.text,marginBottom:6}}>How was your experience?</DText>
            <Text style={{fontSize:14,color:userRating===0?C.muted:userRating<3?C.red:userRating<5?C.gold:C.green,marginBottom:20,fontWeight:'600'}}>
              {userRating===0?'Tap a star to rate':userRating===1?'Poor 😞':userRating===2?'Fair 😐':userRating===3?'Good 👍':userRating===4?'Very Good 😊':'Excellent! 🎉'}
            </Text>
            <StarRating rating={userRating} onRate={setUserRating} size={44}/>
          </Card>
          <Text style={{fontWeight:'700',color:C.text,fontSize:14,marginBottom:12}}>What went well?</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:16}}>
            {['On time','Professional','Clean work','Friendly','Good products','Thorough','Book again'].map((tag,i)=>{
              const sel=ratingNote.includes(tag);
              return(<TouchableOpacity key={i} style={{paddingHorizontal:14,paddingVertical:9,borderRadius:20,backgroundColor:sel?C.orange:C.card,borderWidth:0.5,borderColor:sel?C.orange:C.border2,...(sel?SHADOW.glow:SHADOW.card)}} onPress={()=>setRatingNote(n=>sel?n.replace(tag+', ','').replace(tag,'').trim():n?n+', '+tag:tag)}>
                <Text style={{fontSize:13,color:sel?'#FFF':C.text,fontWeight:sel?'700':'400'}}>{tag}</Text>
              </TouchableOpacity>);
            })}
          </View>
          <Card style={{marginBottom:20}}>
            <TextInput style={{fontSize:14,color:C.text,minHeight:80,textAlignVertical:'top'}} placeholder="Write a review (optional)..." placeholderTextColor={C.muted2} value={ratingNote} onChangeText={setRatingNote} multiline/>
          </Card>
          <TouchableOpacity style={[S.btn,{paddingVertical:18,borderRadius:30,...SHADOW.glow},userRating===0&&{opacity:0.4}]} disabled={userRating===0} onPress={submitRating}><Text style={[S.btnT,{fontSize:17}]}>Submit Rating ⭐</Text></TouchableOpacity>
          <View style={{backgroundColor:C.goldSolid,borderRadius:16,padding:12,marginTop:12,flexDirection:'row',alignItems:'center',gap:10,borderWidth:0.5,borderColor:C.goldBd}}>
            <Text style={{fontSize:20}}>🎁</Text>
            <Text style={{color:C.gold,fontWeight:'600',fontSize:13}}>Earn ₹50 wallet bonus for rating!</Text>
          </View>
          <View style={{height:40}}/>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // MAIN TABS
  // ════════════════════════════════════════════════════════════════
  const HomeTab=()=>(
  <View style={{flex:1,position:'relative'}}>
    <ScrollView style={{flex:1,backgroundColor:C.bg}} showsVerticalScrollIndicator={false}>
      {/* ✅ UPGRADE 8: Background corner glows */}
      <View style={{position:'absolute',top:0,left:-60,width:250,height:250,borderRadius:125,backgroundColor:'rgba(200,84,26,0.05)',zIndex:0}}/>
      <View style={{position:'absolute',top:300,right:-40,width:180,height:180,borderRadius:90,backgroundColor:'rgba(200,140,10,0.04)',zIndex:0}}/>
      {/* Header */}
      <View style={{backgroundColor:C.white,paddingTop:52,paddingBottom:16,paddingHorizontal:20,borderBottomWidth:0.5,borderBottomColor:C.border2,...SHADOW.card,zIndex:1}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <View>
            <Text style={{fontSize:12,color:C.muted,marginBottom:2}}>📍 {selArea}, Vizag</Text>
            <DText style={{fontSize:22,fontWeight:'700',color:C.text}}>{user?`Hello, ${user.name.split(' ')[0]} 🪷`:'Hello, Guest 🪷'}</DText>
          </View>
          <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
            {user&&(
              <TouchableOpacity onPress={()=>setTab('profile')} style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:C.goldBg,paddingHorizontal:12,paddingVertical:7,borderRadius:20,borderWidth:0.5,borderColor:C.goldBd,...SHADOW.card}}>
                <Text style={{fontSize:14}}>💰</Text>
                <DText style={{fontSize:13,fontWeight:'700',color:C.gold}}>₹{wallet}</DText>
              </TouchableOpacity>
            )}
            {/* Notification bell */}
            <TouchableOpacity style={{position:'relative',width:44,height:44,borderRadius:22,backgroundColor:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.border,...SHADOW.card}}
              onPress={()=>{setNotifCount(0);Alert.alert('Notifications 🔔','VEGA50 promo expires today!\nYour last cleaning was 7 days ago.');}}>
              <Text style={{fontSize:20}}>🔔</Text>
              {notifCount>0&&<View style={{position:'absolute',top:6,right:6,backgroundColor:C.red,width:12,height:12,borderRadius:6,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:'#FFF',fontSize:7,fontWeight:'900'}}>{notifCount}</Text>
              </View>}
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>user?setTab('profile'):setScreen('login')} style={{width:44,height:44,borderRadius:22,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:C.orangeBd,...SHADOW.soft,shadowColor:C.orange}}>
              <DText style={{fontWeight:'700',color:C.orange,fontSize:17}}>{user?user.name[0]:'G'}</DText>
            </TouchableOpacity>
          </View>
        </View>
        {/* ✅ Search — pill shape */}
        <TouchableOpacity style={{backgroundColor:C.bg,borderRadius:30,flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:13,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}} onPress={()=>setShowSearch(true)}>
          <Text style={{fontSize:16,marginRight:10,color:C.muted}}>🔍</Text>
          <Text style={{flex:1,fontSize:14,color:C.muted2}}>Search VEGA services...</Text>
          <View style={{backgroundColor:C.orangeBg,paddingHorizontal:10,paddingVertical:4,borderRadius:20,borderWidth:0.5,borderColor:C.orangeBd}}>
            <Text style={{fontSize:11,color:C.orange,fontWeight:'700'}}>Search</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ✅ UPGRADE 6+7: Hero with texture + frosted glass badge */}
      <View style={{margin:16,borderRadius:24,overflow:'hidden',...SHADOW.glow,shadowColor:C.orange}}>
        <View style={{backgroundColor:C.orange,padding:22}}>
          {/* Texture overlay */}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i=>(
            <View key={i} style={{position:'absolute',top:i*18-30,left:-20,right:-20,height:1,backgroundColor:'rgba(255,255,255,0.04)',transform:[{rotate:'135deg'}]}}/>
          ))}
          <View style={{position:'absolute',top:-20,right:-20,width:120,height:120,borderRadius:60,backgroundColor:'rgba(255,255,255,0.08)'}}/>
          <View style={{position:'absolute',bottom:-30,right:40,width:80,height:80,borderRadius:40,backgroundColor:'rgba(255,255,255,0.06)'}}/>
          {/* ✅ Frosted glass badge */}
          <View style={{alignSelf:'flex-start',backgroundColor:'rgba(255,255,255,0.15)',paddingHorizontal:12,paddingVertical:5,borderRadius:20,borderWidth:0.5,borderColor:'rgba(255,255,255,0.30)',marginBottom:12}}>
            <Text style={{color:'rgba(255,255,255,0.95)',fontSize:10,fontWeight:'700',letterSpacing:1.5}}>🏆 VIZAG'S #1 HOME SERVICES</Text>
          </View>
          <DText style={{fontSize:28,fontWeight:'700',color:'#FFF',lineHeight:34,marginBottom:8}}>Pure Homes.{'\n'}Peaceful Living.</DText>
          <Text style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginBottom:20,lineHeight:19}}>Professional, trained & verified experts at your doorstep in 30 minutes.</Text>
          <View style={{flexDirection:'row',gap:10}}>
            <TouchableOpacity style={{backgroundColor:'#FFF',paddingHorizontal:20,paddingVertical:12,borderRadius:30,...SHADOW.soft}} onPress={()=>setTab('services')}>
              <Text style={{color:C.orange,fontWeight:'800',fontSize:13}}>Book Now →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{borderWidth:1,borderColor:'rgba(255,255,255,0.5)',paddingHorizontal:18,paddingVertical:12,borderRadius:30}} onPress={()=>setTab('offers')}>
              <Text style={{color:'#FFF',fontWeight:'700',fontSize:13}}>🎁 Offers</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={{marginHorizontal:16,backgroundColor:C.card,borderRadius:20,padding:14,flexDirection:'row',justifyContent:'space-around',marginBottom:16,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
        {[['50K+','Customers'],['30 Min','Arrival'],['4.9 ⭐','Rating'],['100%','Verified']].map(([n,l])=>(
          <View key={l} style={{alignItems:'center'}}>
            <DText style={{fontSize:14,fontWeight:'700',color:C.orange}}>{n}</DText>
            <Text style={{fontSize:10,color:C.muted,marginTop:1}}>{l}</Text>
          </View>
        ))}
      </View>

      {/* ✅ 4 MAIN SERVICES — Full packages (Home/Bathroom/Kitchen/Car) */}
      <View style={{marginHorizontal:16,marginBottom:18}}>
        <DText style={{fontSize:18,fontWeight:'700',color:C.text,marginBottom:14}}>Our full service packages 🏠</DText>
        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:10}}>
          {SERVICES.filter(s=>['home','bathroom','kitchen','car'].includes(s.id)).map(svc=>(
            <TouchableOpacity key={svc.id} onPress={()=>openService(svc)} activeOpacity={0.85}
              style={{width:(W-42)/2,backgroundColor:C.white,borderRadius:16,padding:16,borderWidth:0.5,borderColor:C.border2,...SHADOW.soft,marginBottom:4}}>
              {/* Bug 3: 64x64 icon centered with 3D shadow underneath */}
              <View style={{width:'100%',alignItems:'center',marginBottom:12}}>
                <View style={{
                  width:80, height:80, borderRadius:20,
                  backgroundColor:`${svc.iconBg}22`,
                  alignItems:'center', justifyContent:'center',
                  borderWidth:0.5, borderColor:`${svc.iconBg}44`,
                  ...SHADOW.soft, shadowColor: svc.shadow || svc.iconBg,
                }}>
                  {svcImgSource(svc.id)
                    ? <Image source={svcImgSource(svc.id)} style={{width:64,height:64}} resizeMode="contain"/>
                    : <Text style={{fontSize:48}}>{svc.icon}</Text>}
                </View>
              </View>
              <Text style={{fontSize:15,fontWeight:'700',color:C.text,marginBottom:3,textAlign:'center'}} numberOfLines={1}>{svc.shortName || svc.name?.replace('\n',' ')}</Text>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4}}>
                <DText style={{fontSize:14,fontWeight:'700',color:C.orange}}>From ₹{svc.durations?.[0]?.price||99}</DText>
                <Text style={{fontSize:18,color:C.orange,fontWeight:'700'}}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ✅ Pronto-style individual task cards */}
      <View style={{marginHorizontal:16,marginBottom:8}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <DText style={{fontSize:18,fontWeight:'700',color:C.text}}>Individual tasks ⚡</DText>
          <Text style={{fontSize:11,color:C.muted}}>Tap + to add</Text>
        </View>
        <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',gap:10}}>
          {TASKS.map(task=>{
            const qty = taskCart[task.id]||0;
            return(
              <TouchableOpacity key={task.id} activeOpacity={0.85} onPress={()=>{setActiveTask(task);setScreen('taskDetail');}}
                style={{width:(W-48)/2,backgroundColor:C.card,borderRadius:18,padding:12,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
                {/* Image / icon area */}
                <View style={{width:'100%',height:90,borderRadius:12,backgroundColor:`${task.color}15`,alignItems:'center',justifyContent:'center',marginBottom:10,position:'relative'}}>
                  <Text style={{fontSize:40}}>{task.icon}</Text>
                  {/* Rating badge */}
                  <View style={{position:'absolute',top:6,left:6,backgroundColor:'rgba(255,255,255,0.95)',paddingHorizontal:6,paddingVertical:2,borderRadius:8,flexDirection:'row',alignItems:'center',gap:3}}>
                    <Text style={{fontSize:10,color:C.star}}>★</Text>
                    <Text style={{fontSize:10,fontWeight:'700',color:C.text}}>4.9</Text>
                  </View>
                  {/* Quantity control when added */}
                  {qty>0&&(
                    <View style={{position:'absolute',bottom:6,right:6,flexDirection:'row',alignItems:'center',backgroundColor:C.white,borderRadius:20,paddingHorizontal:6,paddingVertical:3,gap:8,...SHADOW.card}}>
                      <TouchableOpacity onPress={()=>removeTask(task.id)} style={{width:22,height:22,borderRadius:11,backgroundColor:C.orange,alignItems:'center',justifyContent:'center'}}>
                        <Text style={{color:'#FFF',fontSize:14,fontWeight:'900',lineHeight:18}}>−</Text>
                      </TouchableOpacity>
                      <Text style={{fontSize:13,fontWeight:'800',color:C.text,minWidth:14,textAlign:'center'}}>{qty}</Text>
                      <TouchableOpacity onPress={()=>addTask(task.id)} style={{width:22,height:22,borderRadius:11,backgroundColor:C.orange,alignItems:'center',justifyContent:'center'}}>
                        <Text style={{color:'#FFF',fontSize:14,fontWeight:'900',lineHeight:18}}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {/* Name + price */}
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:2}} numberOfLines={1}>{task.name}</Text>
                <Text style={{fontSize:11,color:C.muted,marginBottom:8}} numberOfLines={1}>{task.desc}</Text>
                <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                  <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                    <DText style={{fontSize:15,fontWeight:'700',color:C.orange}}>₹{task.price}</DText>
                    <Text style={{fontSize:11,color:C.muted2,textDecorationLine:'line-through'}}>₹{task.mrp}</Text>
                  </View>
                  {qty===0?(
                    <TouchableOpacity onPress={()=>addTask(task.id)} style={{width:30,height:30,borderRadius:15,backgroundColor:C.orange,alignItems:'center',justifyContent:'center',...SHADOW.glow,shadowColor:C.orange}}>
                      <Text style={{color:'#FFF',fontSize:20,fontWeight:'900',lineHeight:24}}>+</Text>
                    </TouchableOpacity>
                  ):(
                    <View style={{backgroundColor:C.greenBg,paddingHorizontal:8,paddingVertical:3,borderRadius:10,borderWidth:0.5,borderColor:C.greenBd}}>
                      <Text style={{fontSize:10,color:C.green,fontWeight:'700'}}>₹{task.price*qty}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Full packages link */}
      <TouchableOpacity style={{marginHorizontal:16,marginBottom:16,backgroundColor:C.orangeBg,borderRadius:16,padding:14,flexDirection:'row',alignItems:'center',gap:10,borderWidth:0.5,borderColor:C.orangeBd}} onPress={()=>setTab('services')}>
        <Text style={{fontSize:20}}>📦</Text>
        <View style={{flex:1}}>
          <Text style={{fontWeight:'700',color:C.orange,fontSize:14}}>Need a full home package?</Text>
          <Text style={{fontSize:12,color:C.muted,marginTop:1}}>2 BHK full clean, deep cleaning, car detailing & more</Text>
        </View>
        <Text style={{color:C.orange,fontSize:18}}>›</Text>
      </TouchableOpacity>

      {/* ── Change 7: COMING SOON — Chimney, Mattress, Sofa Deep + Notify Me ── */}
      <View style={{marginHorizontal:16,marginBottom:22}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <DText style={{fontSize:17,fontWeight:'700',color:C.text}}>🔜 Launching Soon in Vizag</DText>
          <Badge label="Notify Me" color={C.teal}/>
        </View>
        <Text style={{fontSize:12,color:C.muted,marginBottom:14}}>Be first to know — tap Notify Me</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingRight:4}}>
          {[
            ...COMING_SOON_TASKS.map(t=>({emoji:t.emoji,name:t.name,color:t.color,desc:t.desc,id:t.id})),
            {emoji:'🍳',name:'Cooking Service',color:'#E87030',desc:'Home chef at your door',id:'cs_cook'},
            {emoji:'🔧',name:'Appliance Repair',color:'#183880',desc:'AC, fridge, washing machine',id:'cs_repair'},
            {emoji:'🌿',name:'Garden Care',color:'#1E6B3A',desc:'Plant care & gardening',id:'cs_garden'},
          ].map((item)=>{
            const [notified,setNotified]=React.useState(false);
            return(
              <View key={item.id} style={{width:148,backgroundColor:C.card,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
                <View style={{width:52,height:52,borderRadius:16,backgroundColor:`${item.color}18`,alignItems:'center',justifyContent:'center',marginBottom:10,borderWidth:0.5,borderColor:`${item.color}30`}}>
                  <Text style={{fontSize:28}}>{item.emoji}</Text>
                </View>
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,lineHeight:17,marginBottom:4}}>{item.name}</Text>
                <Text style={{fontSize:10,color:C.muted,lineHeight:14,marginBottom:10}}>{item.desc}</Text>
                <TouchableOpacity
                  style={{paddingVertical:7,borderRadius:20,alignItems:'center',
                    backgroundColor:notified?C.greenBg:`${item.color}15`,
                    borderWidth:0.5,borderColor:notified?C.greenBd:`${item.color}30`}}
                  onPress={()=>{
                    if(notified) return;
                    setNotified(true);
                    // Save interest to Firestore
                    if(!DEMO_MODE && user){
                      firestore().collection('service_interests').add({
                        serviceId:item.id, serviceName:item.name,
                        userId:phone, userPhone:phone,
                        createdAt:firestore.FieldValue.serverTimestamp(),
                      }).catch(e=>console.log('service_interest:',e));
                    }
                  }}>
                  <Text style={{fontSize:10,fontWeight:'700',color:notified?C.green:item.color}}>
                    {notified?'✅ Notified!':'🔔 Notify Me'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Subscription — dark premium card */}
      <View style={{marginHorizontal:16,marginBottom:16,borderRadius:24,overflow:'hidden',...SHADOW.glow,shadowColor:C.gold}}>
        <View style={{backgroundColor:C.darkCard,padding:20,flexDirection:'row',alignItems:'center',borderWidth:0.5,borderColor:C.darkBd}}>
          <View style={{flex:1}}>
            <Badge label="PREMIUM" color={C.gold2} style={{marginBottom:8}}/>
            <DText style={{fontSize:18,fontWeight:'700',color:'#FFF',marginBottom:4}}>Subscribe & Save 40%</DText>
            <Text style={{fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:18}}>Daily, weekly or monthly home care plans</Text>
          </View>
          <TouchableOpacity style={{backgroundColor:C.gold2,paddingHorizontal:14,paddingVertical:10,borderRadius:20,...SHADOW.glow,shadowColor:C.gold}} onPress={()=>Alert.alert('Coming Soon! 🌟','VEGA subscription plans launching next month!')}>
            <Text style={{color:'#FFF',fontWeight:'800',fontSize:13}}>Join ›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Festival offers */}
      <DText style={{fontSize:17,fontWeight:'700',color:C.text,marginHorizontal:16,marginBottom:12}}>🎊 Festival Offers</DText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,paddingBottom:4}} style={{marginBottom:22}}>
        {[
          {emoji:'🪔',title:'Diwali Deep Clean',  sub:'Pre-festival special', discount:'30% OFF', color:C.orange},
          {emoji:'🌺',title:'Ugadi Package',       sub:'Full home refresh',    discount:'₹200 OFF',color:C.teal},
          {emoji:'💍',title:'Wedding Cleaning',    sub:'2-day service',        discount:'Book Now',color:C.purple},
          {emoji:'🎂',title:'After Party Clean',   sub:'Express 2hr service',  discount:'₹199',    color:C.red},
        ].map((offer,i)=>(
          <TouchableOpacity key={i} style={{width:158,marginRight:12,borderRadius:22,backgroundColor:offer.color,padding:16,overflow:'hidden',...SHADOW.soft,shadowColor:offer.color}} onPress={()=>Alert.alert(offer.title,`${offer.sub}\n${offer.discount}`)}>
            <View style={{position:'absolute',top:-16,right:-16,width:70,height:70,borderRadius:35,backgroundColor:'rgba(255,255,255,0.1)'}}/>
            <Text style={{fontSize:32,marginBottom:10}}>{offer.emoji}</Text>
            <DText style={{color:'#FFF',fontWeight:'700',fontSize:15,marginBottom:3}}>{offer.title}</DText>
            <Text style={{color:'rgba(255,255,255,0.75)',fontSize:11,marginBottom:10}}>{offer.sub}</Text>
            {/* ✅ Frosted glass discount badge */}
            <View style={{backgroundColor:'rgba(255,255,255,0.20)',paddingHorizontal:10,paddingVertical:4,borderRadius:20,alignSelf:'flex-start',borderWidth:0.5,borderColor:'rgba(255,255,255,0.30)'}}>
              <Text style={{color:'#FFF',fontSize:11,fontWeight:'700'}}>{offer.discount}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recent bookings */}
      {orders.length>0&&(
        <View style={{marginHorizontal:16,marginBottom:22}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <DText style={{fontSize:17,fontWeight:'700',color:C.text}}>Recent Bookings ⚡</DText>
            <TouchableOpacity onPress={()=>setTab('bookings')}><Text style={{color:C.orange,fontSize:13,fontWeight:'700'}}>See all</Text></TouchableOpacity>
          </View>
          {orders.slice(0,2).map(o=>(
            <TouchableOpacity key={o.orderId} style={{backgroundColor:C.card,borderRadius:20,padding:14,marginBottom:8,flexDirection:'row',alignItems:'center',borderWidth:0.5,borderColor:C.border2,...SHADOW.card}} onPress={()=>{setTrackOrd(o);setScreen('track');}}>
              <View style={{width:44,height:44,borderRadius:14,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center',marginRight:12}}><Text style={{fontSize:22}}>{o.items?.[0]?.icon||'🏠'}</Text></View>
              <View style={{flex:1}}>
                <Text style={{fontWeight:'700',color:C.text,fontSize:13}} numberOfLines={1}>{o.items?.[0]?.name}</Text>
                <Text style={{color:C.muted,fontSize:11,marginTop:2}}>#{o.orderId} · {o.slot?.split(',')[0]}</Text>
              </View>
              <View style={{alignItems:'flex-end',gap:4}}>
                <DText style={{color:C.orange,fontWeight:'700',fontSize:14}}>₹{o.total}</DText>
                <Badge label="Track" color={C.green}/>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* VEGA promise — dark */}
      <View style={{marginHorizontal:16,marginBottom:24,backgroundColor:C.dark,borderRadius:24,padding:20,overflow:'hidden',borderWidth:0.5,borderColor:C.darkBd,...SHADOW.soft}}>
        <View style={{position:'absolute',top:-20,right:-20,width:100,height:100,borderRadius:50,backgroundColor:'rgba(200,84,26,0.15)'}}/>
        <Text style={{color:C.orangeSoft,fontSize:11,fontWeight:'700',letterSpacing:1.5,marginBottom:8}}>THE VEGA PROMISE</Text>
        <DText style={{color:'#FFF',fontSize:19,fontWeight:'700',marginBottom:8,lineHeight:26}}>🪷 Your Home Is Our Temple</DText>
        <Text style={{color:'rgba(255,255,255,0.65)',fontSize:13,lineHeight:20,marginBottom:12}}>Trained to 5-star hotel standard. Background verified. OTP protected. Every service done with devotion.</Text>
        <Text style={{color:C.goldLight,fontWeight:'600',fontSize:13}}>మీ ఇంటికి మేము పరిగెత్తి వస్తాం 🌊</Text>
      </View>
      <View style={{height:120}}/>
    </ScrollView>

    {/* ✅ Floating task cart bar — like Pronto */}
    {taskCartCount>0&&(
      <View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:C.white,borderTopWidth:0.5,borderTopColor:C.border2,padding:14,paddingBottom:20,...SHADOW.soft}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:10}}>
          <Text style={{fontSize:13,color:C.muted,flex:1}}>{taskCartCount} service{taskCartCount>1?'s':''} selected</Text>
          <TouchableOpacity onPress={()=>setTaskCart({})}>
            <Text style={{color:C.red,fontSize:13,fontWeight:'600'}}>Clear</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={{backgroundColor:C.orange,borderRadius:16,paddingVertical:16,paddingHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center',...SHADOW.glow}} onPress={checkoutTaskCart}>
          <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
            <View style={{backgroundColor:'rgba(255,255,255,0.25)',width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'}}>
              <Text style={{color:'#FFF',fontWeight:'900',fontSize:12}}>{taskCartCount}</Text>
            </View>
            <Text style={{color:'#FFF',fontWeight:'700',fontSize:15}}>{taskCartCount} service{taskCartCount>1?'s':''}</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <DText style={{color:'#FFF',fontWeight:'700',fontSize:17}}>₹{taskCartTotal}</DText>
            <Text style={{color:'rgba(255,255,255,0.9)',fontSize:15}}>Go to cart →</Text>
          </View>
        </TouchableOpacity>
      </View>
    )}
  </View>
  );

  const ServicesTab=()=>(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={[S.topBar,{paddingTop:52}]}>
        <View style={{width:36}}/><DText style={[S.topTitle,{fontSize:20}]}>All Services</DText><View style={{width:36}}/>
      </View>
      <ScrollView style={{flex:1}}>
        {/* Active services */}
        <Text style={{fontSize:13,fontWeight:'700',color:C.muted,marginHorizontal:16,marginTop:16,marginBottom:10,letterSpacing:0.8}}>AVAILABLE NOW</Text>
        {SERVICES.filter(s=>!['sofa','beauty','deep','elder'].includes(s.id)).map((svc,i)=>(
          <TouchableOpacity key={svc.id} style={{flexDirection:'row',alignItems:'center',backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,overflow:'hidden',...SHADOW.card}} onPress={()=>openService(svc)}>
            <View style={{position:'absolute',left:0,top:0,bottom:0,width:5,backgroundColor:svc.gradient[0]}}/>
            <View style={{width:56,height:56,borderRadius:18,backgroundColor:svc.iconBg,alignItems:'center',justifyContent:'center',marginRight:14,marginLeft:10,borderBottomWidth:4,borderBottomColor:svc.gradient[1],...SHADOW.card,shadowColor:svc.gradient[1]}}>
              {svcImgSource(svc.id)
                ? <Image source={svcImgSource(svc.id)} style={{width:38,height:38}} resizeMode="contain"/>
                : <Text style={{fontSize:28}}>{svc.icon}</Text>}
            </View>
            <View style={{flex:1}}>
              <DText style={{fontSize:15,fontWeight:'700',color:C.text}}>{svc.shortName}</DText>
              <Text style={{fontSize:12,color:C.muted,marginTop:2}} numberOfLines={1}>{svc.tagline}</Text>
              <Text style={{fontSize:13,fontWeight:'800',color:svc.gradient[0],marginTop:5}}>from ₹{svc.durations[0].price} · {svc.durations.length} options</Text>
            </View>
            {svc.badge&&<Badge label={svc.badge} color={svc.gradient[0]} style={{marginRight:8}}/>}
            <Text style={{color:C.muted2,fontSize:22}}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Coming Soon — VEGA task services (Change 7) */}
        <Text style={{fontSize:13,fontWeight:'700',color:C.muted,marginHorizontal:16,marginTop:8,marginBottom:10,letterSpacing:0.8}}>COMING SOON IN VIZAG</Text>
        {/* Task-based coming soon (Chimney, Mattress, Sofa Deep) */}
        {COMING_SOON_TASKS.map((task)=>{
          const [notified,setNotified]=React.useState(false);
          return(
            <View key={task.id} style={{flexDirection:'row',alignItems:'center',backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,overflow:'hidden'}}>
              <View style={{position:'absolute',left:0,top:0,bottom:0,width:5,backgroundColor:task.color}}/>
              <View style={{width:52,height:52,borderRadius:16,backgroundColor:`${task.color}15`,alignItems:'center',justifyContent:'center',marginRight:14,marginLeft:10,borderWidth:0.5,borderColor:`${task.color}30`}}>
                <Text style={{fontSize:26}}>{task.emoji}</Text>
              </View>
              <View style={{flex:1}}>
                <DText style={{fontSize:14,fontWeight:'700',color:C.text}}>{task.name}</DText>
                <Text style={{fontSize:12,color:C.muted,marginTop:2}} numberOfLines={1}>{task.desc}</Text>
              </View>
              <TouchableOpacity
                style={{paddingHorizontal:12,paddingVertical:6,borderRadius:16,
                  backgroundColor:notified?C.greenBg:`${task.color}15`,
                  borderWidth:0.5,borderColor:notified?C.greenBd:`${task.color}30`}}
                onPress={()=>{
                  if(notified) return;
                  setNotified(true);
                  if(!DEMO_MODE&&user){
                    firestore().collection('service_interests').add({
                      serviceId:task.id, serviceName:task.name,
                      userId:phone, userPhone:phone,
                      createdAt:firestore.FieldValue.serverTimestamp(),
                    }).catch(e=>console.log('service_interest:',e));
                  }
                }}>
                <Text style={{fontSize:11,fontWeight:'700',color:notified?C.green:task.color}}>
                  {notified?'✅ Notified':'🔔 Notify Me'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {/* Full services coming soon (Sofa, Beauty, Deep, Elder) */}
        {SERVICES.filter(s=>['sofa','beauty','deep','elder'].includes(s.id)).map((svc)=>(
          <View key={svc.id} style={{flexDirection:'row',alignItems:'center',backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,overflow:'hidden',opacity:0.65}}>
            <View style={{position:'absolute',left:0,top:0,bottom:0,width:5,backgroundColor:C.muted2}}/>
            <View style={{width:52,height:52,borderRadius:16,backgroundColor:C.light,alignItems:'center',justifyContent:'center',marginRight:14,marginLeft:10}}>
              {svcImgSource(svc.id)
                ? <Image source={svcImgSource(svc.id)} style={{width:34,height:34,opacity:0.65}} resizeMode="contain"/>
                : <Text style={{fontSize:26}}>{svc.icon}</Text>}
            </View>
            <View style={{flex:1}}>
              <DText style={{fontSize:14,fontWeight:'700',color:C.muted}}>{svc.shortName}</DText>
              <Text style={{fontSize:12,color:C.muted2,marginTop:2}} numberOfLines={1}>{svc.tagline}</Text>
            </View>
            <Badge label="Coming Soon" color={C.muted} style={{marginRight:4}}/>
          </View>
        ))}

        <View style={{marginHorizontal:16,marginTop:10,marginBottom:32,backgroundColor:C.orange,borderRadius:24,padding:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',...SHADOW.glow}}>
          <View>
            <Text style={{color:'rgba(255,255,255,0.75)',fontSize:10,letterSpacing:1.5}}>LAUNCH OFFER</Text>
            <DText style={{color:'#FFF',fontSize:24,fontWeight:'700',marginTop:2}}>50% OFF</DText>
            <Text style={{color:'rgba(255,255,255,0.8)',fontSize:12,marginTop:2}}>Use code VEGA50</Text>
          </View>
          <Text style={{fontSize:52}}>🎁</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Change 5: BookingsTab — TODAY / UPCOMING / PAST sections ──────────────
  const BookingsTab=()=>{
    const todayStr = new Date().toISOString().split('T')[0];
    // Bug 4+5: Filter out child visit docs from main view (they appear inside parent)
    const parentOrders = orders.filter(o => !o.isChildVisit && !o.isRecurringChild);
    // Categorise
    const todayOrders    = parentOrders.filter(o=>{
      if(o.bookingMode==='instant') return true;
      if(!o.scheduledDate) return true;
      return o.scheduledDate === todayStr;
    });
    const upcomingOrders = parentOrders.filter(o=>{
      if(o.bookingMode==='instant') return false;
      return o.scheduledDate && o.scheduledDate > todayStr && o.status!=='completed' && o.status!=='cancelled';
    });
    const pastOrders     = parentOrders.filter(o=>
      o.status==='completed'||o.status==='cancelled'||(o.scheduledDate&&o.scheduledDate<todayStr&&o.status!=='confirmed')
    );

    const OrderCard = ({o, showVisits=false})=>{
      // Bug 4+5: child visits use new parentSubscriptionId+isChildVisit (legacy: parentOrderId+isRecurringChild)
      const childVisits = orders.filter(c =>
        (c.parentSubscriptionId === o.orderId && c.isChildVisit) ||
        (c.parentOrderId === o.orderId && c.isRecurringChild)
      );
      const [expanded,setExpanded]=React.useState(false);
      const isSubscription = o.bookingMode === 'subscription';
      const isMultiSchedule = o.bookingMode === 'scheduled' && (o.totalVisits || 1) > 1;
      const hasMultipleVisits = isSubscription || isMultiSchedule;
      return(
        <TouchableOpacity style={{backgroundColor:C.card,borderRadius:22,marginBottom:10,overflow:'hidden',...SHADOW.soft}}
          onPress={()=>{setTrackOrd(o);setScreen('track');}}>
          <View style={{height:4,backgroundColor:isSubscription?C.teal:isMultiSchedule?C.gold:o.status==='completed'?C.green:C.orange}}/>
          <View style={{padding:14}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:8}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                <Text style={{color:C.orange,fontWeight:'700',fontSize:12}}>#{o.orderId}</Text>
                {isSubscription && <View style={{backgroundColor:C.tealBg,paddingHorizontal:7,paddingVertical:2,borderRadius:8,borderWidth:0.5,borderColor:C.tealBd}}><Text style={{color:C.teal,fontSize:9,fontWeight:'700'}}>🔁 Subscription</Text></View>}
                {isMultiSchedule && <View style={{backgroundColor:C.goldBg,paddingHorizontal:7,paddingVertical:2,borderRadius:8,borderWidth:0.5,borderColor:C.goldBd}}><Text style={{color:C.gold,fontSize:9,fontWeight:'700'}}>📅 {o.totalVisits} visits</Text></View>}
              </View>
              <View style={{flexDirection:'row',gap:6,alignItems:'center'}}>
                {o.rated&&<Text style={{fontSize:10}}>{'⭐'.repeat(Math.min(o.rating||0,5))}</Text>}
                <Badge label={o.status||'confirmed'} color={o.status==='completed'?C.green:o.status==='cancelled'?C.red:C.orange}/>
              </View>
            </View>
            {o.items?.slice(0,2).map((item,i)=>(
              <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:6}}>
                <View style={{width:38,height:38,borderRadius:12,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18}}>{item.icon}</Text></View>
                <View style={{flex:1}}><Text style={{fontWeight:'600',color:C.text,fontSize:13}} numberOfLines={1}>{item.name}</Text></View>
                <DText style={{color:C.orange,fontWeight:'700',fontSize:13}}>₹{item.price}</DText>
              </View>
            ))}
            <View style={{height:0.5,backgroundColor:C.border,marginVertical:8}}/>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <Text style={{color:C.muted,fontSize:11,flex:1}} numberOfLines={1}>📅 {o.slot?.split('·')[0]||o.slot}</Text>
              <View style={{flexDirection:'row',gap:6,alignItems:'center'}}>
                <DText style={{color:C.orange,fontWeight:'700',fontSize:14}}>₹{o.total}</DText>
                {!o.rated&&o.status==='completed'&&(
                  <TouchableOpacity style={{backgroundColor:C.orangeBg,paddingHorizontal:10,paddingVertical:4,borderRadius:16,borderWidth:0.5,borderColor:C.orangeBd}}
                    onPress={(e)=>{e.stopPropagation?.();setRatingOrd(o);setUserRating(0);setRatingNote('');setScreen('rate');}}>
                    <Text style={{color:C.orange,fontSize:11,fontWeight:'700'}}>Rate ⭐</Text>
                  </TouchableOpacity>
                )}
                {o.status==='completed'&&(
                  <TouchableOpacity style={{backgroundColor:C.orangeSolid,paddingHorizontal:10,paddingVertical:4,borderRadius:16,borderWidth:0.5,borderColor:C.orangeBd}}
                    onPress={(e)=>{e.stopPropagation?.();setTab('services');}}>
                    <Text style={{color:C.orange,fontSize:11,fontWeight:'700'}}>🔄 Again</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {/* Bug 4+5: Expandable upcoming visits (subscription or multi-date scheduled) */}
            {hasMultipleVisits && childVisits.length > 0 && (
              <TouchableOpacity style={{marginTop:8,backgroundColor:isSubscription?C.tealBg:C.goldSolid,borderRadius:10,padding:10,borderWidth:0.5,borderColor:isSubscription?C.tealBd:C.goldBd,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}
                onPress={(e)=>{e.stopPropagation?.();setExpanded(ex=>!ex);}}>
                <Text style={{color:isSubscription?C.teal:C.gold,fontWeight:'700',fontSize:11}}>📆 {childVisits.length} upcoming visits</Text>
                <Text style={{color:isSubscription?C.teal:C.gold,fontSize:14}}>{expanded?'▲':'▼'}</Text>
              </TouchableOpacity>
            )}
            {expanded && childVisits.map((cv,ci)=>(
              <View key={ci} style={{backgroundColor:isSubscription?C.tealBg:C.goldSolid,marginTop:4,borderRadius:10,padding:10,flexDirection:'row',alignItems:'center',gap:8,borderWidth:0.5,borderColor:isSubscription?C.tealBd:C.goldBd}}>
                <View style={{width:22,height:22,borderRadius:11,backgroundColor:isSubscription?C.teal:C.gold,alignItems:'center',justifyContent:'center'}}>
                  <Text style={{color:'#FFF',fontSize:10,fontWeight:'800'}}>{cv.visitNumber || (ci+2)}</Text>
                </View>
                <Text style={{fontSize:11,color:C.text,flex:1}} numberOfLines={1}>{cv.scheduledDate} {cv.scheduledTime?`at ${cv.scheduledTime}`:''}</Text>
                <Badge label={cv.status||'scheduled'} color={isSubscription?C.teal:C.gold}/>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      );
    };

    const SectionHeader = ({title,count,color=C.orange})=>(
      <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10,marginTop:4}}>
        <View style={{width:4,height:18,borderRadius:2,backgroundColor:color}}/>
        <Text style={{fontWeight:'800',fontSize:13,color:C.text,letterSpacing:0.5}}>{title}</Text>
        {count>0&&<View style={{backgroundColor:`${color}18`,paddingHorizontal:8,paddingVertical:2,borderRadius:10,borderWidth:0.5,borderColor:`${color}30`}}>
          <Text style={{color,fontSize:11,fontWeight:'700'}}>{count}</Text>
        </View>}
      </View>
    );

    return(
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={[S.topBar,{paddingTop:52}]}>
          <View style={{width:36}}/><DText style={[S.topTitle,{fontSize:20}]}>My Bookings</DText><View style={{width:36}}/>
        </View>
        <ScrollView style={{flex:1,padding:16}}>
          {parentOrders.length===0?(
            <View style={{alignItems:'center',paddingTop:80}}>
              <Text style={{fontSize:60,marginBottom:16}}>📋</Text>
              <DText style={{color:C.text,fontSize:18,fontWeight:'700',marginBottom:8}}>No bookings yet</DText>
              <Text style={{color:C.muted,fontSize:14,marginBottom:28,textAlign:'center'}}>{user?'Book your first VEGA service!':'Login to see your bookings'}</Text>
              <TouchableOpacity style={S.btn} onPress={()=>user?setTab('services'):setScreen('login')}><Text style={S.btnT}>{user?'Book Now':'Login'}</Text></TouchableOpacity>
            </View>
          ):(
            <>
              {todayOrders.length>0&&(
                <>
                  <SectionHeader title="TODAY" count={todayOrders.length} color={C.green}/>
                  {todayOrders.map(o=><OrderCard key={o.orderId} o={o}/>)}
                </>
              )}
              {upcomingOrders.length>0&&(
                <>
                  <SectionHeader title="UPCOMING" count={upcomingOrders.length} color={C.orange}/>
                  {upcomingOrders.map(o=><OrderCard key={o.orderId} o={o} showVisits/>)}
                </>
              )}
              {pastOrders.length>0&&(
                <>
                  <SectionHeader title="PAST" count={pastOrders.length} color={C.muted}/>
                  {pastOrders.map(o=><OrderCard key={o.orderId} o={o}/>)}
                </>
              )}
              {/* If none categorized, show all */}
              {todayOrders.length===0&&upcomingOrders.length===0&&pastOrders.length===0&&(
                parentOrders.map(o=><OrderCard key={o.orderId} o={o}/>)
              )}
              <View style={{height:40}}/>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  };

  const OffersTab=()=>(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={[S.topBar,{paddingTop:52}]}>
        <View style={{width:36}}/><DText style={[S.topTitle,{fontSize:20}]}>Offers & Promos</DText><View style={{width:36}}/>
      </View>
      <ScrollView style={{flex:1,padding:16}}>
        {[
          {code:'VEGA50',  title:'50% OFF — First Booking',  desc:'Valid on your very first VEGA booking.',  color:C.orange, emoji:'🎉'},
          {code:'FIRST20', title:'New User 20% OFF',          desc:'20% off for new users, valid once.',       color:C.teal,   emoji:'👋'},
          {code:'FLAT100', title:'Flat ₹100 OFF',             desc:'₹100 flat discount on orders above ₹399.',color:C.blue,   emoji:'💰'},
          {code:'VIZAG20', title:'Vizag Special 20% OFF',     desc:'Exclusive for Visakhapatnam customers.',   color:C.purple, emoji:'🌊'},
          {code:'VEGA2025',title:'Welcome Offer 20% OFF',     desc:'Launch offer. Use before it expires!',     color:C.rose,   emoji:'🪷'},
        ].map((offer,i)=>(
          <View key={i} style={{backgroundColor:C.card,borderRadius:22,marginBottom:12,overflow:'hidden',borderWidth:0.5,borderColor:C.border2,...SHADOW.soft,shadowColor:offer.color+'60'}}>
            <View style={{height:4,backgroundColor:offer.color}}/>
            <View style={{padding:18}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <Text style={{fontSize:28}}>{offer.emoji}</Text>
                  {/* ✅ Soft translucent promo badge */}
                  <View style={{backgroundColor:`${offer.color}18`,paddingHorizontal:12,paddingVertical:6,borderRadius:12,borderWidth:0.5,borderColor:`${offer.color}35`}}>
                    <Text style={{color:offer.color,fontWeight:'800',fontSize:14,letterSpacing:1}}>{offer.code}</Text>
                  </View>
                </View>
                <TouchableOpacity style={{paddingHorizontal:16,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:offer.color,...SHADOW.card,shadowColor:offer.color}} onPress={()=>{setPromoCode(offer.code);setAppliedPromo(PROMOS[offer.code]);Alert.alert('Applied! 🎉',PROMOS[offer.code]?.label||offer.title);}}>
                  <Text style={{color:offer.color,fontWeight:'800',fontSize:13}}>Apply</Text>
                </TouchableOpacity>
              </View>
              <DText style={{fontWeight:'700',color:C.text,fontSize:16,marginBottom:4}}>{offer.title}</DText>
              <Text style={{color:C.muted,fontSize:13}}>{offer.desc}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  const ProfileTab=()=>(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <ScrollView>
        <View style={{backgroundColor:C.dark,padding:24,paddingTop:60,paddingBottom:32,overflow:'hidden',borderBottomWidth:0.5,borderBottomColor:C.darkBd}}>
          <View style={{position:'absolute',top:-30,right:-30,width:140,height:140,borderRadius:70,backgroundColor:'rgba(200,84,26,0.15)'}}/>
          {user?(
            <>
              <View style={{width:72,height:72,borderRadius:36,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center',marginBottom:14,borderWidth:2.5,borderColor:C.orangeBd,...SHADOW.glow}}>
                <DText style={{color:C.orange,fontSize:28,fontWeight:'700'}}>{user.name[0]}</DText>
              </View>
              <DText style={{color:'#FFF',fontSize:22,fontWeight:'700'}}>{user.name}</DText>
              <Text style={{color:'rgba(255,255,255,0.55)',fontSize:14,marginTop:3}}>{user.phone}</Text>
            </>
          ):(
            <TouchableOpacity onPress={()=>setScreen('login')} style={{backgroundColor:C.orange,paddingHorizontal:24,paddingVertical:14,borderRadius:30,alignSelf:'flex-start',marginTop:16,...SHADOW.glow}}>
              <Text style={{color:'#FFF',fontWeight:'800',fontSize:15}}>Login / Register</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{padding:16}}>
          {user&&(
            <>
              <View style={{flexDirection:'row',gap:12,marginBottom:12}}>
                <View style={{flex:1,backgroundColor:C.goldSolid,borderRadius:20,padding:16,borderWidth:0.5,borderColor:C.goldBd,...SHADOW.card}}>
                  <Text style={{fontSize:22}}>💰</Text>
                  <DText style={{color:C.gold,fontWeight:'700',fontSize:24,marginTop:6}}>₹{wallet}</DText>
                  <Text style={{color:C.muted,fontSize:11,marginTop:2}}>VEGA Wallet</Text>
                </View>
                <View style={{flex:1,backgroundColor:C.greenSolid,borderRadius:20,padding:16,borderWidth:0.5,borderColor:C.greenBd,...SHADOW.card}}>
                  <Text style={{fontSize:22}}>📋</Text>
                  <DText style={{color:C.green,fontWeight:'700',fontSize:24,marginTop:6}}>{orders.length}</DText>
                  <Text style={{color:C.muted,fontSize:11,marginTop:2}}>Bookings</Text>
                </View>
              </View>
              <Card style={{marginBottom:12}}>
                <DText style={{fontWeight:'700',color:C.text,fontSize:16,marginBottom:8}}>🎁 Refer & Earn ₹200</DText>
                <Text style={{color:C.muted,fontSize:13,marginBottom:12,lineHeight:19}}>Share your code. Both you and friend each get ₹200!</Text>
                <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:C.orangeBg,borderRadius:14,padding:14,borderWidth:0.5,borderColor:C.orangeBd}}>
                  <DText style={{color:C.orange,fontSize:20,fontWeight:'700',letterSpacing:4}}>{user.code}</DText>
                  <TouchableOpacity style={{backgroundColor:C.orange,paddingHorizontal:16,paddingVertical:10,borderRadius:20,...SHADOW.glow}} onPress={()=>Alert.alert('Share VEGA! 🪷',`Your code: ${user.code}`)}>
                    <Text style={{color:'#FFF',fontWeight:'700',fontSize:13}}>Share</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            </>
          )}
          {[
            ['📋','My Bookings',()=>setTab('bookings')],
            ['🛒','Cart',()=>setTab('cart')],
            ['🎁','Offers',()=>setTab('offers')],
            ['📍','Saved Addresses',()=>setScreen('addresses')],
            ['💳','Payment Methods',()=>Alert.alert('Coming Soon')],
            ['🔔','Notifications',()=>Alert.alert('Notifications 🔔','VEGA50 expires today!')],
            ['⭐','Rate VEGA App',()=>Alert.alert('Thank You! 🙏')],
            ['🆘','Help & Support',()=>Alert.alert('VEGA Support','📞 +91-891-VEGA-999\n📧 hello@vegavizag.in\n⏰ 8AM–10PM')],
          ].map(([ic,lb,ac],i)=>(
            <TouchableOpacity key={i} style={{flexDirection:'row',alignItems:'center',backgroundColor:C.card,borderRadius:18,padding:14,marginBottom:8,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}} onPress={ac}>
              <View style={{width:42,height:42,borderRadius:13,backgroundColor:C.orangeBg,alignItems:'center',justifyContent:'center',marginRight:14,borderWidth:0.5,borderColor:C.orangeBd}}><Text style={{fontSize:20}}>{ic}</Text></View>
              <Text style={{flex:1,color:C.text,fontSize:15,fontWeight:'500'}}>{lb}</Text>
              <Text style={{color:C.muted2,fontSize:22}}>›</Text>
            </TouchableOpacity>
          ))}
          {user&&<TouchableOpacity style={{borderWidth:0.5,borderColor:C.redBd,borderRadius:20,padding:14,marginTop:8,marginBottom:40,alignItems:'center',backgroundColor:C.redSolid}} onPress={()=>{
            if(ordersUnsub) ordersUnsub();
            setOrdersUnsub(null);
            if(addrsUnsub) addrsUnsub();    // Bug 7: unsub addresses listener
            setAddrsUnsub(null);
            setSavedAddrs([]);
            setOrders([]);
            setUser(null);
            setPhone('');
            setOtpVal('');
            setConfirm(null);
            auth().signOut().catch(e=>console.error('signOut:',e));
            setScreen('login');
            Alert.alert('👋 Logged out','See you soon!');
          }}>
            <Text style={{color:C.red,fontWeight:'600',fontSize:15}}>Logout</Text>
          </TouchableOpacity>}
          {!user&&<View style={{height:40}}/>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  const CartTab=()=>(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={[S.topBar,{paddingTop:52}]}>
        <View style={{width:36}}/><DText style={[S.topTitle,{fontSize:20}]}>My Cart</DText>
        {cartCount>0&&<Badge label={`${cartCount} item${cartCount>1?'s':''}`} color={C.orange}/>}
      </View>
      <ScrollView style={{flex:1,padding:16}}>
        {cart.length===0?(
          <View style={{alignItems:'center',paddingTop:80}}>
            <Text style={{fontSize:60,marginBottom:16}}>🛒</Text>
            <DText style={{color:C.text,fontSize:18,fontWeight:'700',marginBottom:8}}>Cart is empty</DText>
            <Text style={{color:C.muted,fontSize:14,marginBottom:28}}>Add services to get started</Text>
            <TouchableOpacity style={S.btn} onPress={()=>setTab('services')}><Text style={S.btnT}>Browse Services</Text></TouchableOpacity>
          </View>
        ):(
          <>
            {cart.map(item=>(
              <Card key={item.id} style={{flexDirection:'row',alignItems:'center',marginBottom:10}}>
                <View style={{width:48,height:48,borderRadius:15,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center',marginRight:12}}><Text style={{fontSize:24}}>{item.icon}</Text></View>
                <View style={{flex:1}}>
                  <Text style={{fontWeight:'700',color:C.text,fontSize:14}} numberOfLines={1}>{item.name}</Text>
                  {item.extras?.length>0&&<Text style={{fontSize:11,color:C.green,marginTop:1}} numberOfLines={1}>+ {item.extras.join(', ')}</Text>}
                  <View style={{flexDirection:'row',gap:8,marginTop:4,alignItems:'center'}}>
                    <DText style={{color:C.orange,fontWeight:'700',fontSize:16}}>₹{item.price}</DText>
                    <Text style={{color:C.muted2,fontSize:12,textDecorationLine:'line-through'}}>₹{item.mrp}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={()=>setCart(c=>c.filter(i=>i.id!==item.id))} style={{width:30,height:30,borderRadius:15,backgroundColor:C.redSolid,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.redBd}}>
                  <Text style={{color:C.red,fontSize:14,fontWeight:'700'}}>✕</Text>
                </TouchableOpacity>
              </Card>
            ))}
            <Card style={{marginBottom:16}}>
              <BR l="Services total" r={`₹${cartTotal}`}/>
              <BR l="Platform fee" r="₹29"/>
              <View style={{height:1,backgroundColor:C.border,marginVertical:8}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                <Text style={{fontWeight:'800',fontSize:16,color:C.text}}>Total</Text>
                <DText style={{fontWeight:'700',fontSize:22,color:C.orange}}>₹{cartTotal+29}</DText>
              </View>
            </Card>
            <TouchableOpacity style={[S.btn,{paddingVertical:18,borderRadius:30,...SHADOW.glow}]} onPress={()=>{if(!user){Alert.alert('Login Required','',[ {text:'Login',onPress:()=>setScreen('login')} ]);return;}setScreen('step4');}}>
              <Text style={[S.btnT,{fontSize:17}]}>Proceed to Checkout →</Text>
            </TouchableOpacity>
            <View style={{height:40}}/>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  const SearchModal=()=>(
    <Modal visible={showSearch} animationType="slide">
      <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
        <View style={{flexDirection:'row',alignItems:'center',padding:16,paddingTop:16,gap:12,backgroundColor:C.white,borderBottomWidth:0.5,borderBottomColor:C.border2,...SHADOW.card}}>
          <TouchableOpacity onPress={()=>{setShowSearch(false);setSearch('');}} style={{width:38,height:38,borderRadius:19,backgroundColor:C.light,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:18,color:C.text}}>←</Text></TouchableOpacity>
          <TextInput style={{flex:1,backgroundColor:C.bg,borderRadius:30,paddingHorizontal:16,paddingVertical:11,fontSize:14,color:C.text,borderWidth:0.5,borderColor:C.border2}} placeholder="Search VEGA services..." placeholderTextColor={C.muted} value={search} onChangeText={setSearch} autoFocus/>
          {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')} style={{width:30,height:30,borderRadius:15,backgroundColor:C.light,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.muted,fontSize:14}}>✕</Text></TouchableOpacity>}
        </View>
        <ScrollView style={{flex:1,padding:16}}>
          {search.length<2?(
            <>
              <Text style={{color:C.muted,fontWeight:'700',fontSize:12,letterSpacing:1,marginBottom:16}}>POPULAR SEARCHES</Text>
              {['Home Cleaning','Bathroom Cleaning','Kitchen Cleaning','Car Cleaning','Beauty Care','Deep Cleaning','Elder Care','Sofa Cleaning'].map((q,i)=>(
                <TouchableOpacity key={i} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:13,borderBottomWidth:0.5,borderBottomColor:C.border2}} onPress={()=>setSearch(q)}>
                  <View style={{width:38,height:38,borderRadius:12,backgroundColor:C.light,alignItems:'center',justifyContent:'center',borderWidth:0.5,borderColor:C.border}}><Text style={{fontSize:16}}>🔍</Text></View>
                  <Text style={{fontSize:14,color:C.text}}>{q}</Text>
                </TouchableOpacity>
              ))}
            </>
          ):(
            SERVICES.filter(s=>s.shortName.toLowerCase().includes(search.toLowerCase())).length===0?(
              <View style={{alignItems:'center',paddingTop:60}}><Text style={{fontSize:40,marginBottom:12}}>🔍</Text><Text style={{color:C.muted,fontSize:15}}>No results for "{search}"</Text></View>
            ):(
              SERVICES.filter(s=>s.shortName.toLowerCase().includes(search.toLowerCase())).map((svc,i)=>(
                <TouchableOpacity key={i} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:13,borderBottomWidth:0.5,borderBottomColor:C.border2}} onPress={()=>{openService(svc);setShowSearch(false);setSearch('');}}>
                  <View style={{width:52,height:52,borderRadius:16,backgroundColor:svc.iconBg,alignItems:'center',justifyContent:'center',borderBottomWidth:3,borderBottomColor:svc.gradient[1],...SHADOW.card,shadowColor:svc.gradient[1]}}>
                    {svcImgSource(svc.id)
                      ? <Image source={svcImgSource(svc.id)} style={{width:34,height:34}} resizeMode="contain"/>
                      : <Text style={{fontSize:24}}>{svc.icon}</Text>}
                  </View>
                  <View style={{flex:1}}>
                    <DText style={{fontWeight:'700',color:C.text,fontSize:15}}>{svc.shortName}</DText>
                    <Text style={{color:C.muted,fontSize:12}} numberOfLines={1}>{svc.tagline}</Text>
                  </View>
                  <DText style={{fontWeight:'700',color:svc.gradient[0],fontSize:15}}>₹{svc.durations[0].price}</DText>
                </TouchableOpacity>
              ))
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  // ════════════════════════════════════════════════════════════════
  // ✅ UPGRADE 2: FLOATING PILL TAB BAR — web app style
  // 4 tabs only, gradient active state, floating with shadow
  // ════════════════════════════════════════════════════════════════
  const TABS=[
    {id:'home',    icon:'home',     iconOut:'home-outline',     label:'Home'},
    {id:'services',icon:'grid',     iconOut:'grid-outline',     label:'Booking'},
    {id:'offers',  icon:'pricetag', iconOut:'pricetag-outline', label:'Offers'},
    {id:'profile', icon:'person',   iconOut:'person-outline',   label:'Profile'},
  ];

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white}/>
      <SearchModal/>
      <View style={{flex:1}}>
        {tab==='home'     &&<HomeTab/>}
        {tab==='services' &&<ServicesTab/>}
        {tab==='cart'     &&<CartTab/>}
        {tab==='bookings' &&<BookingsTab/>}
        {tab==='offers'   &&<OffersTab/>}
        {tab==='profile'  &&<ProfileTab/>}
      </View>

      {/* Floating cart bar — dark premium */}
      {cartCount>0&&(tab==='home'||tab==='services')&&(
        <TouchableOpacity style={{
          position:'absolute',bottom:88,left:16,right:16,
          backgroundColor:C.dark,borderRadius:22,padding:16,
          flexDirection:'row',justifyContent:'space-between',alignItems:'center',
          borderWidth:0.5,borderColor:C.orange+'40',
          ...SHADOW.glow,shadowColor:C.orange,
        }} onPress={()=>setTab('cart')}>
          <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
            <View style={{backgroundColor:C.orange,width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'}}>
              <Text style={{color:'#FFF',fontWeight:'900',fontSize:12}}>{cartCount}</Text>
            </View>
            <Text style={{color:'#FFF',fontWeight:'700',fontSize:15}}>{cartCount} service{cartCount>1?'s':''} in cart</Text>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <DText style={{color:C.orangeSoft,fontWeight:'700',fontSize:17}}>₹{cartTotal}</DText>
            <Text style={{color:C.orangeSoft,fontSize:20}}>→</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ✅ UPGRADE 2: Floating pill tab bar */}
      <View style={{paddingHorizontal:12,paddingBottom:Platform.OS==='ios'?28:14,paddingTop:8,backgroundColor:'transparent'}}>
        <View style={{
          flexDirection:'row',
          backgroundColor:'rgba(255,255,255,0.94)',
          borderRadius:28,
          padding:5,
          borderWidth:0.5,
          borderColor:'rgba(200,160,100,0.20)',
          ...SHADOW.soft,
        }}>
          {TABS.map(t=>{
            const active=tab===t.id;
            return(
              <TouchableOpacity key={t.id} style={{
                flex:1,alignItems:'center',paddingVertical:10,borderRadius:22,
                backgroundColor:active?C.orange:'transparent',
                ...(active?{...SHADOW.glow,shadowColor:C.orange}:{}),
              }} onPress={()=>setTab(t.id)}>
                <Ionicons name={active?t.icon:t.iconOut} size={22} color={active?'#FFF':C.muted} style={{marginBottom:1}}/>
                <Text style={{fontSize:10,fontWeight:active?'700':'500',color:active?'#FFF':C.muted}}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
          {/* Cart tab */}
          <TouchableOpacity style={{
            flex:1,alignItems:'center',paddingVertical:10,borderRadius:22,
            backgroundColor:tab==='cart'?C.orange:'transparent',
            ...(tab==='cart'?{...SHADOW.glow,shadowColor:C.orange}:{}),
          }} onPress={()=>setTab('cart')}>
            <View style={{position:'relative'}}>
              <Ionicons name={tab==='cart'?'cart':'cart-outline'} size={22} color={tab==='cart'?'#FFF':C.muted} style={{marginBottom:1}}/>
              {cartCount>0&&<View style={{position:'absolute',top:-5,right:-8,backgroundColor:C.red,width:16,height:16,borderRadius:8,alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:'#FFF',fontSize:9,fontWeight:'900'}}>{cartCount}</Text>
              </View>}
            </View>
            <Text style={{fontSize:10,fontWeight:tab==='cart'?'700':'500',color:tab==='cart'?'#FFF':C.muted}}>Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// STYLES — upgraded for premium
// ════════════════════════════════════════════════════════════════
const S = StyleSheet.create({
  lbl:        { color:'#3A1A0A', fontSize:13, fontWeight:'600', marginBottom:8, marginTop:4 },
  inp:        { backgroundColor:'#FEFCF8', borderWidth:0.5, borderColor:'#E8DDD4', borderRadius:20, padding:14, fontSize:15, color:'#18080A' },
  phoneRow:   { flexDirection:'row', backgroundColor:'#FEFCF8', borderWidth:0.5, borderColor:'#E8DDD4', borderRadius:20, overflow:'hidden', marginBottom:4 },
  flag:       { padding:14, fontSize:13, fontWeight:'700', color:'#18080A', backgroundColor:'#F0E8DE', borderRightWidth:0.5, borderRightColor:'#E8DDD4' },
  phoneInp:   { flex:1, padding:14, fontSize:15, color:'#18080A', letterSpacing:2 },
  // ✅ Main button — full pill, glow shadow
  btn:        { backgroundColor:'#C8541A', borderRadius:30, padding:16, alignItems:'center', marginTop:16,
                elevation:6, shadowColor:'#C8541A', shadowOffset:{width:0,height:6}, shadowOpacity:0.38, shadowRadius:16 },
  btnT:       { color:'#FFF', fontSize:15, fontWeight:'800', letterSpacing:0.3 },
  ctaBtn:     { paddingHorizontal:26, paddingVertical:14, borderRadius:30 },
  ctaBtnT:    { color:'#FFF', fontWeight:'800', fontSize:15 },
  // Top bar — 0.5px border (web app style)
  topBar:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                paddingHorizontal:20, paddingVertical:14,
                backgroundColor:'#FEFCF8', borderBottomWidth:0.5, borderBottomColor:'rgba(200,160,100,0.15)',
                elevation:2, shadowColor:'rgba(100,40,10,0.12)', shadowOffset:{width:0,height:1}, shadowOpacity:0.1, shadowRadius:4 },
  topTitle:   { fontSize:17, fontWeight:'700', color:'#18080A', letterSpacing:-0.3 },
  backCircle: { width:38, height:38, borderRadius:19, backgroundColor:'#F0E8DE', alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:'#E8DDD4' },
  backArrow:  { fontSize:20, color:'#18080A' },
  stepper:    { width:42, height:42, borderRadius:14, backgroundColor:'rgba(200,84,26,0.10)', alignItems:'center', justifyContent:'center', borderWidth:0.5, borderColor:'rgba(200,84,26,0.22)' },
  // Section title - display font
  sectionTitle: { fontSize:16, fontWeight:'700', color:'#18080A', letterSpacing:-0.3 },
});
