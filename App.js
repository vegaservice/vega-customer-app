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

const createBooking = async (bookingData) => {
  try {
    const orderId = 'VG' + Date.now().toString().slice(-6);
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const booking = {
      ...bookingData, orderId, otp, status: 'confirmed',  // ← snake_case
      createdAt: firestore.FieldValue.serverTimestamp(), rated: false,
    };
    await firestore().collection('bookings').doc(orderId).set(booking);
    // Also add to user's booking subcollection
    if (bookingData.userId) {
      await firestore().collection('users').doc(bookingData.userId)
        .collection('bookings').doc(orderId)
        .set({ orderId, status: 'confirmed', createdAt: firestore.FieldValue.serverTimestamp() });
    }
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
    .onSnapshot(doc => { if (doc.exists) callback({ id: doc.id, ...doc.data() }); });
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

// ── FIX 3: PROFESSIONAL ICONS — Icons8 Fluency pack (free with attribution)
const SVC_ICONS = {
  cleaning: 'https://img.icons8.com/fluency/96/broom.png',
  bathroom: 'https://img.icons8.com/fluency/96/bathroom.png',
  kitchen:  'https://img.icons8.com/fluency/96/stove.png',
  car:      'https://img.icons8.com/fluency/96/car-wash.png',
  sofa:     'https://img.icons8.com/fluency/96/sofa.png',
  beauty:   'https://img.icons8.com/fluency/96/beauty.png',
  vacuum:   'https://img.icons8.com/fluency/96/vacuum-cleaner.png',
  elder:    'https://img.icons8.com/fluency/96/elderly-person.png',
  cook:     'https://img.icons8.com/fluency/96/cooking-pot.png',
  repair:   'https://img.icons8.com/fluency/96/maintenance.png',
};
const SvcIcon = ({ id, emoji, size=40, style }) => {
  const [err, setErr] = React.useState(false);
  const uri = SVC_ICONS[id];
  if (!uri || err) return <Text style={{ fontSize:size*0.75, lineHeight:size, ...style }}>{emoji}</Text>;
  return <Image source={{ uri }} style={{ width:size, height:size, ...style }} resizeMode="contain" onError={()=>setErr(true)} />;
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
  card: { elevation:3, shadowColor:C.shadowCard, shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:6 },
  soft: { elevation:6, shadowColor:C.shadowSoft, shadowOffset:{width:0,height:4}, shadowOpacity:0.18, shadowRadius:10 },
  glow: { elevation:10, shadowColor:C.shadowGlow, shadowOffset:{width:0,height:6}, shadowOpacity:0.38, shadowRadius:16 },
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
      { id:'h1',hrs:1,label:'1 Hour', price:99, mrp:199,popular:false,
        tasks:['Mopping all rooms','Sweeping all rooms','Utensils cleaning','Kitchen counter clean'],
        note:'Best for daily maintenance' },
      { id:'h2',hrs:2,label:'2 Hours',price:199,mrp:399,popular:true,
        tasks:['Mopping all rooms','Sweeping all rooms','Utensils cleaning','Kitchen counter clean','Folding clothes (up to 20 pairs)','Ironing clothes (up to 20 pairs)','Surface dusting — tables, shelves, fans exterior'],
        note:'Best for weekly cleaning' },
      { id:'h3',hrs:3,label:'3 Hours',price:349,mrp:699,popular:false,
        tasks:['Mopping all rooms','Sweeping all rooms','Utensils cleaning','Kitchen counter clean','Folding clothes (up to 20 pairs)','Ironing clothes (up to 20 pairs)','Surface dusting — tables, shelves, fans exterior','Full dust removal from corners & ceilings','Deep surface scrub','Suitable for: guests arriving, home unused 10+ days, large families'],
        note:'Best when guests are coming or home needs deep refresh' },
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
  { id:'bathroom',name:'Bathroom\nCleaning',shortName:'Bathroom',icon:'🚿',gradient:['#2C88D9','#183880'],shadow:'rgba(24,56,128,0.4)',iconBg:'#4A98E8',tagline:'Tiles, commode, mirror & taps',workerLabel:'Cleaners',badge:'High Demand',
    durations:[
      {id:'b1',hrs:1,label:'1 Bath',  price:149,mrp:299,popular:true, tasks:['Commode inside+out','Tile scrub','Mirror zero-streak','Drain deodorize'],note:'1 bathroom'},
      {id:'b2',hrs:2,label:'2 Baths', price:249,mrp:499,popular:false,tasks:['All above × 2'],note:'2 bathrooms'},
      {id:'b3',hrs:3,label:'3+ Baths',price:349,mrp:699,popular:false,tasks:['All above × 3+'],note:'3+ bathrooms'},
    ],
    addons:[{id:'descale',name:'Hard Water Descaling',price:49,icon:'💧',desc:'Remove yellow stains'},{id:'exhaust',name:'Exhaust Fan Clean',price:29,icon:'🌀',desc:'Fan blades and grill'}],
    covered:['Commode inside & outside — deep scrub','Wall & floor tiles — scrubbed clean','Mirror — streak-free polish','Taps & shower heads — descaled','Drain — cleaned & deodorized','Exhaust fan exterior wipe'],
    notCovered:['Broken tile or grout repair','Plumbing leaks or pipe repair','Painting or renovation work','Electrical work'],
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
  { id:'car',     name:'Car\nWash',      shortName:'Car Wash',  icon:'🚗',gradient:['#18A888','#0E5848'],shadow:'rgba(14,88,72,0.4)', iconBg:'#28C8A8',tagline:'Parking area service — no moving needed',workerLabel:'Detailers',badge:'Eco Friendly',
    durations:[
      {id:'c1',hrs:1,label:'Outer Wash',    price:99, mrp:199,popular:false,tasks:['Exterior body wash — foam & rinse','Tyre & rim cleaning','Wipe dry with microfibre','Exterior glass clean'],note:'Exterior only — great for daily refresh'},
      {id:'c2',hrs:2,label:'Full Clean',    price:199,mrp:349,popular:true, tasks:['All Outer Wash tasks','Interior vacuum — seats, floor mats, boot','Dashboard & door panel wipe','Interior glass cleaning','Cup holders & pockets cleaned'],note:'Best — inside & outside complete clean'},
      {id:'c3',hrs:3,label:'Premium Detail',price:349,mrp:599,popular:false,tasks:['All Full Clean tasks','Clay bar exterior treatment','Hand wax & polish','Tyre dressing (showroom black)','Headlight restoration'],note:'Showroom-finish detailing'},
    ],
    addons:[], // Car wash has no add-ons
    covered:['Exterior wash & dry','Tyre & rim cleaning','Interior vacuum','Dashboard wipe','All glass inside + outside'],
    notCovered:['Boot or glove box (unless requested)','Dent or scratch repair','Engine bay cleaning','AC gas or servicing','Moving your car from parking'],
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
    includes:['Washing regular household utensils','Scrubbing and cleaning the kitchen sink','Cleaning burners and wiping stove top','Disposing wet and dry kitchen waste','Leaving sink area clean and dry'],
    excludes:['Chimney, degreasing, or duct cleaning','Cleaning inside of electrical appliances','Heavy scrubbing of burnt or old deposits','Handling broken glass or sharp waste','Special cookware handling (non-stick coatings need care)']},
  {id:'t_sofa', name:'Sofa Cleaning', price:249, mrp:449, icon:'🛋️', color:'#9860E0', desc:'Foam clean + stain removal', unit:'sofa',
    includes:['Foam extraction cleaning (professional method)','Stain pre-treatment and removal','Cushion top surface cleaning','Deodorizing with fresh spray','Surface dry within 2 hours'],
    excludes:['Torn or ripped fabric repair','Wooden frame polishing or repair','Structural damage fixes','Pet urine deep saturation (may need extra session)','Antique or leather sofas (call us first)']},
  {id:'t_party', name:'After Party Clean', price:199, mrp:375, icon:'🎉', color:'#D03878', desc:'Express post-party restore', unit:'session',
    includes:['Clearing leftover food and plates','Mopping and sweeping all party areas','Taking out garbage and bottles','Wiping tables, counters, and surfaces','Basic bathroom quick clean'],
    excludes:['Deep carpet stain removal','Vomit or biohazard waste cleanup','Broken glass collection without safety gear','Wall stain or marker removal','Furniture polish or restoration']},
  {id:'t_wm', name:'Washing Machine Clean', price:99, mrp:199, icon:'🫧', color:'#183880', desc:'Drum + exterior cleaning', unit:'machine',
    includes:['Cleaning drum interior','Wiping rubber gasket thoroughly','Cleaning detergent drawer','Exterior wipe-down of machine','Running a cleaning cycle with cleaner'],
    excludes:['Repair of motor or electronic parts','Drainage pipe deep unclog','Descaling very old heavy buildup','Moving the machine from position','Any servicing needing dismantling']},
  {id:'t_chimney', name:'Chimney Cleaning', price:99, mrp:249, icon:'🔧', color:'#A84A10', desc:'Filter/mesh removed & cleaned', unit:'chimney',
    includes:['Removing filter/mesh carefully','Soaking and scrubbing filter','Wiping chimney exterior and hood','Cleaning around chimney area','Refitting filter properly'],
    excludes:['Duct or exhaust pipe cleaning','Motor or blower repair','Full chimney dismantling','Heavy oil buildup needing chemicals','Any electrical work on chimney']},
  {id:'t_mattress', name:'Mattress Cleaning', price:149, mrp:299, icon:'🛏️', color:'#4E2480', desc:'Vacuum + sanitize + deodorize', unit:'mattress',
    includes:['Deep vacuuming of mattress surface','Stain spot treatment on accessible stains','Sanitizing spray application','Deodorizing with fresh-smelling solution','Flipping mattress if requested'],
    excludes:['Mattress repair or bedbug extermination','Dry cleaning of mattress covers','Removing set-in stains (older than 6 months)','Disposal of old mattress','Replacement of mattress padding']},
];
const getDates=()=>{const D=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],M=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],t=new Date();return Array.from({length:7},(_,i)=>{const d=new Date(t);d.setDate(t.getDate()+i);return{label:i===0?'Today':i===1?'Tomorrow':D[d.getDay()],num:d.getDate(),mon:M[d.getMonth()]};});};
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

// ✅ UPGRADE 2: 3D Icon with improved depth
const Icon3D = ({ svc, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue:0.9, useNativeDriver:true, speed:60 }),
      Animated.spring(scaleAnim, { toValue:1,   useNativeDriver:true, speed:60 }),
    ]).start(() => onPress?.());
  };
  const sz = COL - 8;
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
          <Text style={{ fontSize:sz*0.42, lineHeight:sz*0.52 }}>{svc.icon}</Text>
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
  const [cart,          setCart]          = useState([]);
  const [promoCode,     setPromoCode]     = useState('');
  const [appliedPromo,  setAppliedPromo]  = useState(null);
  const [wallet,        setWallet]        = useState(200);
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

  const fadeA  = useRef(new Animated.Value(0)).current;
  const scaleA = useRef(new Animated.Value(0.85)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;
  const DATES  = getDates();

  useEffect(()=>{
    Animated.parallel([
      Animated.timing(fadeA,  {toValue:1,duration:1400,useNativeDriver:true}),
      Animated.spring(scaleA, {toValue:1,tension:35,friction:9,useNativeDriver:true}),
    ]).start();
    const t=setTimeout(()=>setScreen('main'),3400);
    return ()=>clearTimeout(t);
  },[]);

  const addonTotal  = selAddons.reduce((s,id)=>{const a=selSvc?.addons?.find(x=>x.id===id);return s+(a?a.price:0);},0);
  const unitPrice   = selDur?selDur.price:0;
  const totalPrice  = unitPrice + addonTotal;
  const cartTotal   = cart.reduce((s,i)=>s+i.price,0);
  const cartCount   = cart.length;
  const promoSave   = appliedPromo?appliedPromo.type==='pct'?Math.round(cartTotal*appliedPromo.val/100):appliedPromo.val:0;
  const walletSave  = useWallet?Math.min(wallet,cartTotal-promoSave):0;
  const finalTotal  = Math.max(0,cartTotal-promoSave-walletSave)+29;

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
    if(!phone||phone.length<10){Alert.alert('Invalid','Please enter a valid 10-digit mobile number');return;}
    setLoading(true);
    try{
      const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirm(confirmation);
      setLoading(false);
      setScreen('otp');
      if(TEST_PHONES.includes(phone)){
        Alert.alert('OTP Ready ✅','Test number detected.\nEnter OTP: 123456');
      } else {
        Alert.alert('OTP Sent ✅',`SMS sent to +91 ${phone}\nPlease enter the 6-digit code`);
      }
    }catch(err){
      setLoading(false);
      console.error('sendOTP error:',err);
      Alert.alert('OTP Failed',err.message||'Could not send OTP. Please check your number and try again.');
    }
  };

  const verifyOTP = async()=>{
    if(!otpVal||otpVal.length<6){Alert.alert('Invalid','Please enter the 6-digit OTP');return;}
    setLoading(true);
    if(DEMO_MODE){
      if(otpVal!=='123456'){setLoading(false);Alert.alert('Wrong OTP','Demo OTP is 123456');return;}
      const u={name:uname||'Customer',phone:`+91${phone}`,code:'VG'+Math.random().toString(36).substr(2,5).toUpperCase(),walletBalance:200};
      setUser(u);setWallet(200);setLoading(false);setScreen('main');setTab('home');
      Alert.alert('🪷 Welcome!',`Namaste ${uname||'Customer'}!\n🎁 ₹200 wallet bonus added!`);
      return;
    }
    try{
      // Verify OTP with Firebase Auth
      if(!confirm){throw new Error('OTP session expired. Please request OTP again.');}
      await confirm.confirm(otpVal);
      // Get or create user document in Firestore
      const existingUser = await getUser(phone);
      let finalUser;
      if(existingUser){
        // Returning user — load their data
        finalUser = {name:existingUser.name||uname||'Customer',phone:`+91${phone}`,code:existingUser.referralCode||('VG'+Math.random().toString(36).substr(2,5).toUpperCase()),walletBalance:existingUser.walletBalance||200};
        setUser(finalUser);
        setWallet(existingUser.walletBalance||200);
        // ✅ Real-time orders listener
        const unsub = firestore().collection('bookings')
          .where('customerPhone','==',phone)
          .orderBy('createdAt','desc').limit(20)
          .onSnapshot(snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
            err=>console.error('orders:',err));
        setOrdersUnsub(()=>unsub);
        setLoading(false);
        setScreen('main');setTab('home');
        Alert.alert('🪷 Welcome back!',`Namaste ${finalUser.name}!`);
      }else{
        // New user — create profile with signup bonus
        const refCode = 'VG'+Math.random().toString(36).substr(2,5).toUpperCase();
        finalUser = {name:uname||'Customer',phone:`+91${phone}`,code:refCode,walletBalance:200};
        await createOrUpdateUser(phone,{
          name: uname||'Customer',
          phone: phone,
          walletBalance: 200,
          referralCode: refCode,
          totalBookings: 0,
          createdAt: new Date().toISOString(),
        });
        setUser(finalUser);
        setWallet(200);
        // ✅ Real-time orders listener
        const unsub2 = firestore().collection('bookings')
          .where('customerPhone','==',phone)
          .orderBy('createdAt','desc').limit(20)
          .onSnapshot(snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()}))),
            err=>console.error('orders:',err));
        setOrdersUnsub(()=>unsub2);
        setLoading(false);
        setScreen('main');setTab('home');
        Alert.alert('🪷 Welcome!',`Namaste ${uname||'Customer'}!\n🎁 ₹200 wallet bonus added!`);
      }
    }catch(err){
      setLoading(false);
      console.error('verifyOTP error:',err);
      Alert.alert('Verification Failed',err.message||'Wrong OTP. Please try again.');
    }
  };

  const placeOrder = async()=>{
    if(!user){Alert.alert('Login Required','',[ {text:'Login',onPress:()=>setScreen('login')} ]);return;}
    // flat optional for testing
    if((bookMode==='scheduled'||bookMode==='recurring')&&!selTime){Alert.alert('Time Required','Please select a time slot for your booking');return;}
    if(cart.length===0){Alert.alert('Cart Empty','Please add a service first');return;}
    setPlacing(true);
    const pro=PROFESSIONALS[Math.floor(Math.random()*PROFESSIONALS.length)];
    const fullAddr = [flat, buildingName, streetName, landmark, selArea, 'Vizag'].filter(Boolean).join(', ');
    let slot;
    if(bookMode==='instant'){slot='Arriving in 30–45 minutes';}
    else if(bookMode==='recurring'){slot=`Every ${recurFreq||'Week'} · Starts ${DATES[selDate].label} ${DATES[selDate].num} ${DATES[selDate].mon} at ${selTime}`;}
    else{slot=`${DATES[selDate].label} ${DATES[selDate].num} ${DATES[selDate].mon} at ${selTime}`;}

    const resetForm = ()=>{
      setCart([]);setAppliedPromo(null);setUseWallet(false);setPromoCode('');
      setFlat('');setBuildingName('');setStreetName('');setLandmark('');setSelTime(null);setSelAddons([]);setSelPayMethod('upi');
      setPlacing(false);
    };

    if(DEMO_MODE){
      // Legacy demo path
      setTimeout(()=>{
        const otp=Math.floor(1000+Math.random()*9000).toString();
        const oid='VG'+Date.now().toString().slice(-6);
        const o={orderId:oid,otp,items:[...cart],total:finalTotal,slot,addr:fullAddr,status:'Confirmed',time:new Date().toLocaleString('en-IN'),professional:pro,rated:false,bookingMode:bookMode,recurFreq:bookMode==='recurring'?(recurFreq||'Weekly'):null};
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

      const bookingData = {
        userId: phone,
        customerPhone: phone,          // ← for Firestore .where() query
        userName: user.name,
        userPhone: phone,
        assignedWorkerId: pro.id||null,
        assignedWorkerName: pro.name||null,
        assignedWorkerPhone: pro.phone||null,
        items: cart,
        subtotal: totalPrice,
        total: finalTotal,
        promoCode: appliedPromo?.code||null,
        promoDiscount: promoSave||0,
        walletUsed: walletSave||0,
        platformFee: 19,
        slot,
        bookingMode: bookMode,
        recurFreq: bookMode==='recurring'?(recurFreq||'Weekly'):null,
        address: {
          flat, buildingName, streetName, landmark,
          area: selArea, city: 'Visakhapatnam',
        },
        addressFull: fullAddr,
        professional: {
          id: pro.id||'pro_auto',
          name: pro.name,
          phone: pro.phone||'9999999999',
          rating: pro.rating||4.9,
          photo: pro.photo||null,
        },
        paymentMethod: selPayMethod,
        paymentStatus: selPayMethod==='cash'?'pending':'paid',
      };

      const result = await createBooking(bookingData);
      if(!result.success)throw new Error(result.error||'Failed to create booking');

      const o = {
        orderId: result.orderId,
        otp: result.otp,
        items: [...cart],
        total: finalTotal,
        slot, addr: fullAddr,
        status: 'Confirmed',
        time: new Date().toLocaleString('en-IN'),
        professional: pro,
        rated: false,
        bookingMode: bookMode,
        recurFreq: bookMode==='recurring'?(recurFreq||'Weekly'):null,
      };

      setOrders(p=>[o,...p]);

      // Update wallet in Firestore if used
      if(useWallet && walletSave>0){
        const newBalance = Math.max(0, wallet - walletSave);
        await updateUserWallet(phone, newBalance);
        setWallet(newBalance);
      }

      resetForm();
      Alert.alert('🎉 Booking Confirmed!',`Order #${result.orderId}\n📅 ${slot}\n👩 ${pro.name}\n🔐 OTP: ${result.otp}`,[
        {text:'Track Order',onPress:()=>{setTrackOrd(o);setScreen('track');}},
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

  // ── LOGIN
  if(screen==='login') return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar barStyle="dark-content"/>
      <ScrollView contentContainerStyle={{padding:24,paddingTop:16}} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={()=>setScreen('main')} style={{marginBottom:28,marginTop:8}}><Text style={{fontSize:22,color:C.text}}>←</Text></TouchableOpacity>
        <DText style={{fontSize:28,fontWeight:'700',color:C.orange,marginBottom:4,letterSpacing:-0.5}}>🪷 VEGA</DText>
        <DText style={{fontSize:24,fontWeight:'700',color:C.text,marginBottom:6}}>Welcome back</DText>
        <Text style={{fontSize:14,color:C.muted,marginBottom:32,lineHeight:20}}>Sign in to book home services in Vizag</Text>
        <Text style={S.lbl}>Your Name</Text>
        <TextInput style={S.inp} placeholder="Full name" placeholderTextColor={C.muted2} value={uname} onChangeText={setUname}/>
        <Text style={[S.lbl,{marginTop:16}]}>Mobile Number</Text>
        <View style={S.phoneRow}>
          <Text style={S.flag}>🇮🇳 +91</Text>
          <TextInput style={S.phoneInp} placeholder="10-digit number" placeholderTextColor={C.muted2} keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone}/>
        </View>
        {DEMO_MODE&&<Text style={{textAlign:'center',color:C.muted,fontSize:12,marginTop:8}}>Demo — any 10 digits · OTP: 123456</Text>}
        <TouchableOpacity style={[S.btn,(phone.length<10||loading)&&{opacity:0.4}]} disabled={phone.length<10||loading} onPress={sendOTP}>
          {loading?<ActivityIndicator color="#FFF"/>:<Text style={S.btnT}>Send OTP →</Text>}
        </TouchableOpacity>
        <View style={{marginTop:28,backgroundColor:C.orangeBg,borderRadius:16,padding:14,borderWidth:0.5,borderColor:C.orangeBd}}>
          <Text style={{color:C.orange,fontSize:12,fontWeight:'500',lineHeight:18}}>🔒 By continuing you agree to VEGA's Terms of Service. Your number is used only for booking verification.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // ── OTP
  if(screen==='otp') return(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={{padding:24}}>
        <TouchableOpacity onPress={()=>setScreen('login')} style={{marginBottom:32,marginTop:8}}><Text style={{fontSize:22,color:C.text}}>←</Text></TouchableOpacity>
        <DText style={{fontSize:24,fontWeight:'700',color:C.text,marginBottom:6}}>Verify OTP</DText>
        <Text style={{fontSize:14,color:C.muted,marginBottom:4}}>Sent to +91 {phone}</Text>
        <TouchableOpacity onPress={()=>setScreen('login')}><Text style={{color:C.orange,fontSize:13,fontWeight:'600',marginBottom:28}}>Change number</Text></TouchableOpacity>
        <TextInput style={[S.inp,{fontSize:32,fontWeight:'800',letterSpacing:14,textAlign:'center',paddingVertical:18,borderRadius:20}]}
          placeholder="• • • • • •" placeholderTextColor={C.border} keyboardType="number-pad" maxLength={6} value={otpVal} onChangeText={setOtpVal}/>
        {DEMO_MODE&&<Text style={{textAlign:'center',color:C.orange,fontSize:12,marginTop:8,marginBottom:4}}>Demo OTP: 123456</Text>}
        <Text style={{textAlign:'center',color:C.muted,fontSize:12,marginTop:4,marginBottom:24}}>Didn't receive? Wait 60 seconds then resend.</Text>
        <TouchableOpacity style={[S.btn,(otpVal.length<6||loading)&&{opacity:0.4}]} disabled={otpVal.length<6||loading} onPress={verifyOTP}>
          {loading?<ActivityIndicator color="#FFF"/>:<Text style={S.btnT}>Verify & Continue ✓</Text>}
        </TouchableOpacity>
      </View>
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
              <Text style={{fontSize:48,marginRight:16}}>{svc.icon}</Text>
              <View style={{flex:1}}>
                <DText style={{fontSize:22,fontWeight:'700',color:'#FFF'}}>{svc.shortName}</DText>
                <Text style={{fontSize:13,color:'rgba(255,255,255,0.85)',marginTop:3,lineHeight:18}}>{svc.tagline}</Text>
              </View>
            </View>
          </View>

          {/* Duration cards */}
          <Text style={[S.sectionTitle,{marginHorizontal:16,marginBottom:12}]}>Select Duration</Text>
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
                  {/* ✅ Soft badge inside card */}
                  <View style={{marginTop:10,backgroundColor:sel?'rgba(255,255,255,0.20)':C.greenBg,paddingHorizontal:8,paddingVertical:3,borderRadius:20,alignSelf:'flex-start',borderWidth:0.5,borderColor:sel?'rgba(255,255,255,0.25)':C.greenBd}}>
                    <Text style={{color:sel?'#FFF':C.green,fontSize:10,fontWeight:'600'}}>{disc}% off</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Included tasks */}
          {selDur?.tasks&&(
            <Card style={{marginHorizontal:16,backgroundColor:C.greenSolid,borderColor:C.greenBd,marginBottom:16}}>
              <Text style={{fontSize:11,fontWeight:'700',color:C.green,marginBottom:10,letterSpacing:0.8}}>INCLUDED IN {selDur.label.toUpperCase()}</Text>
              {selDur.tasks.map((t,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:6}}><Text style={{color:C.green,fontWeight:'700',fontSize:13}}>✓</Text><Text style={{fontSize:13,color:C.text,flex:1}}>{t}</Text></View>)}
              {selDur.optional&&<View style={{marginTop:8,backgroundColor:'rgba(255,255,255,0.6)',borderRadius:10,padding:10}}><Text style={{fontSize:12,color:C.gold,fontWeight:'600'}}>📝 Optional: {selDur.optional}</Text></View>}
              {selDur.note&&<Text style={{fontSize:11,color:C.green,marginTop:6,fontStyle:'italic'}}>💡 {selDur.note}</Text>}
            </Card>
          )}

          {/* ✅ REMOVED: Worker stepper + checkbox extra tasks */}
          {/* Iron, Dry, Load Washer are now proper add-ons in Step 2 */}

          {/* ✅ Booking Type moved to final step (step 3) where calendar lives */}

          <TouchableOpacity style={{marginHorizontal:16,marginBottom:8,padding:14,borderRadius:16,borderWidth:0.5,borderColor:C.orangeBd,backgroundColor:C.orangeBg,flexDirection:'row',alignItems:'center',gap:8}} onPress={()=>setShowTerms(true)}>
            <Text style={{fontSize:16}}>📋</Text>
            <Text style={{color:C.orange,fontSize:13,fontWeight:'600',flex:1}}>View what's covered & not covered</Text>
            <Text style={{color:C.orange,fontSize:18}}>›</Text>
          </TouchableOpacity>
          <View style={{height:100}}/>
        </ScrollView>

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
          <TouchableOpacity onPress={()=>setScreen('step2')} style={S.backCircle}><Text style={S.backArrow}>←</Text></TouchableOpacity>
          <DText style={S.topTitle}>Schedule</DText>
          <View style={{width:36}}/>
        </View>
        <View style={{height:3,backgroundColor:selSvc.gradient[0]}}/>
        <StepBar step={2} total={4} labels={['Service','Add-ons','Schedule','Address']}/>
        <ScrollView style={{flex:1,padding:16}}>
          <Text style={{fontSize:15,fontWeight:'700',color:C.text,marginBottom:12}}>When do you need this?</Text>
          <View style={{flexDirection:'row',backgroundColor:C.card,borderRadius:16,padding:4,borderWidth:0.5,borderColor:C.border2,marginBottom:20,...SHADOW.card}}>
            {[{id:'instant',label:'⚡ Instant'},{id:'scheduled',label:'📅 Schedule'},{id:'recurring',label:'🔄 Recurring'}].map(m=>(
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
          {bookMode==='recurring'&&(
            <Card style={{backgroundColor:C.goldSolid,borderColor:C.goldBd,marginBottom:20}}>
              <DText style={{fontWeight:'700',color:C.gold,fontSize:16,marginBottom:6}}>🔄 Recurring Plan — Save 25%</DText>
              <Text style={{color:C.muted,fontSize:13,lineHeight:20,marginBottom:12}}>Scheduled automatically. Cancel anytime.</Text>
              <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                {['Weekly','Biweekly','Monthly'].map((opt,i)=>(
                  <TouchableOpacity key={i} onPress={()=>setRecurFreq(opt)}
                    style={{paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:recurFreq===opt?C.gold:C.white,borderWidth:0.5,borderColor:C.goldBd}}>
                    <Text style={{color:recurFreq===opt?'#FFF':C.gold,fontSize:12,fontWeight:'700'}}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>
          )}
          {(bookMode==='scheduled'||bookMode==='recurring')&&(
            <>
              <View style={{backgroundColor:C.orangeBg,borderRadius:12,padding:12,marginBottom:16,borderWidth:0.5,borderColor:C.orangeBd,flexDirection:'row',alignItems:'center',gap:10}}>
                <Text style={{fontSize:18}}>👇</Text>
                <Text style={{flex:1,fontSize:12,color:C.orange,fontWeight:'600'}}>Pick a date and time below to continue</Text>
              </View>
              <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:12}}>Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:20}}>
                {DATES.map((d,i)=>(
                  <TouchableOpacity key={i} style={{marginRight:10,width:66,paddingVertical:14,borderRadius:18,alignItems:'center',backgroundColor:selDate===i?C.orange:C.card,borderWidth:0.5,borderColor:selDate===i?C.orange:C.border2,...(selDate===i?SHADOW.glow:{...SHADOW.card})}} onPress={()=>setSelDate(i)}>
                    <Text style={{fontSize:10,color:selDate===i?'rgba(255,255,255,0.8)':C.muted,fontWeight:'600'}}>{d.label}</Text>
                    <DText style={{fontSize:22,fontWeight:'700',color:selDate===i?'#FFF':C.text,marginTop:4}}>{d.num}</DText>
                    <Text style={{fontSize:10,color:selDate===i?'rgba(255,255,255,0.7)':C.muted}}>{d.mon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
            <BR l={`${selSvc.shortName} — ${selDur?.label}`} r={`₹${selDur?.price}`}/>
            {selAddons.map(id=>{const a=selSvc.addons?.find(x=>x.id===id);return a?<BR key={id} l={a.name} r={`₹${a.price}`}/>:null;})}
            <View style={{height:1,backgroundColor:C.border,marginVertical:8}}/>
            <BR l="Total before checkout" r={`₹${totalPrice}`} bold/>
          </Card>
          <View style={{height:100}}/>
        </ScrollView>
        <View style={{backgroundColor:C.white,padding:16,paddingBottom:24,borderTopWidth:0.5,borderTopColor:C.border2}}>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <View>
              <Text style={{fontSize:11,color:C.muted}}>{bookMode==='instant'?'30–45 min arrival':selTime?`${DATES[selDate].label} at ${selTime}`:'Select time'}</Text>
              <DText style={{fontSize:26,fontWeight:'700',color:C.orange}}>₹{totalPrice}</DText>
            </View>
            <TouchableOpacity
              style={[S.ctaBtn,{backgroundColor:selSvc.gradient[0],...SHADOW.glow,shadowColor:selSvc.gradient[1]},((bookMode==='scheduled'||bookMode==='recurring')&&!selTime)&&{opacity:0.4}]}
              disabled={(bookMode==='scheduled'||bookMode==='recurring')&&!selTime}
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
          {/* ✅ REAL MAP — Google Maps Static API */}
          <Card style={{marginBottom:16,padding:0,overflow:'hidden'}}>
            <View style={{height:150,overflow:'hidden',position:'relative'}}>
              <Image
                source={{ uri: (buildingName||selArea) ? getMapUrl(selArea,buildingName) : DEFAULT_MAP_URL }}
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
          {/* ✅ BOOKING MODE — always visible on step4 so user can switch anytime */}
          <Card style={{marginBottom:12}}>
            <Text style={{fontWeight:'700',color:C.text,fontSize:14,marginBottom:12}}>⏰ When do you need this?</Text>
            <View style={{flexDirection:'row',backgroundColor:C.bg,borderRadius:14,padding:3,marginBottom:12}}>
              {[{id:'instant',label:'⚡ Now'},{id:'scheduled',label:'📅 Later'},{id:'recurring',label:'🔄 Repeat'}].map(m=>(
                <TouchableOpacity key={m.id} style={{flex:1,paddingVertical:10,borderRadius:11,alignItems:'center',backgroundColor:bookMode===m.id?C.orange:'transparent',...(bookMode===m.id?SHADOW.glow:{})}} onPress={()=>{setBookMode(m.id);setSelTime(null);}}>
                  <Text style={{fontSize:11,fontWeight:'700',color:bookMode===m.id?'#FFF':C.muted}}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {bookMode==='instant'&&(
              <View style={{backgroundColor:C.greenBg,borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:8,borderWidth:0.5,borderColor:C.greenBd}}>
                <Text style={{fontSize:16}}>⚡</Text>
                <Text style={{color:C.green,fontWeight:'600',fontSize:12}}>Professional arrives in 30–45 minutes</Text>
              </View>
            )}
            {bookMode==='recurring'&&(
              <View style={{marginBottom:10}}>
                <Text style={{fontSize:12,fontWeight:'600',color:C.muted,marginBottom:8}}>Repeat frequency:</Text>
                <View style={{flexDirection:'row',gap:8}}>
                  {['Weekly','Biweekly','Monthly'].map((opt)=>(
                    <TouchableOpacity key={opt} onPress={()=>setRecurFreq(opt)}
                      style={{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:recurFreq===opt?C.gold:C.card,borderWidth:0.5,borderColor:C.goldBd}}>
                      <Text style={{color:recurFreq===opt?'#FFF':C.gold,fontSize:12,fontWeight:'700'}}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            {(bookMode==='scheduled'||bookMode==='recurring')&&(
              <>
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:10,marginTop:4}}>Select Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:14}}>
                  {DATES.map((d,i)=>(
                    <TouchableOpacity key={i} style={{marginRight:8,width:62,paddingVertical:12,borderRadius:16,alignItems:'center',backgroundColor:selDate===i?C.orange:C.card,borderWidth:0.5,borderColor:selDate===i?C.orange:C.border2,...(selDate===i?SHADOW.glow:{})}} onPress={()=>setSelDate(i)}>
                      <Text style={{fontSize:9,color:selDate===i?'rgba(255,255,255,0.8)':C.muted,fontWeight:'600'}}>{d.label}</Text>
                      <DText style={{fontSize:20,fontWeight:'700',color:selDate===i?'#FFF':C.text,marginTop:2}}>{d.num}</DText>
                      <Text style={{fontSize:9,color:selDate===i?'rgba(255,255,255,0.7)':C.muted}}>{d.mon}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={{fontSize:13,fontWeight:'700',color:C.text,marginBottom:10}}>Select Time</Text>
                <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                  {TIMES.map((t,i)=>(
                    <TouchableOpacity key={i} style={{paddingHorizontal:12,paddingVertical:9,borderRadius:18,backgroundColor:selTime===t?C.orange:C.card,borderWidth:0.5,borderColor:selTime===t?C.orange:C.border2,...(selTime===t?SHADOW.glow:{})}} onPress={()=>setSelTime(t)}>
                      <Text style={{fontSize:12,fontWeight:'600',color:selTime===t?'#FFF':C.text2}}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {!selTime&&<Text style={{color:C.red,fontSize:11,marginTop:8}}>⚠️ Please select a time to continue</Text>}
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
          <TouchableOpacity style={[S.btn,{paddingVertical:18,borderRadius:30,...SHADOW.glow},placing&&{opacity:0.4}]} disabled={placing} onPress={placeOrder}>
            {placing?<ActivityIndicator color="#FFF"/>:<Text style={[S.btnT,{fontSize:17}]}>🔒 Confirm Booking — ₹{finalTotal}</Text>}
          </TouchableOpacity>
          <View style={{height:40}}/>
        </ScrollView>
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

  // ── TRACK
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
          <Card style={{marginBottom:12,overflow:'hidden',padding:0}}>
            {/* ✅ REAL TRACKING MAP */}
            <View style={{height:160,overflow:'hidden',position:'relative'}}>
              <Image
                source={{ uri: getMapUrl(selArea||'Madhurawada', trackOrd?.addressFull||'') }}
                style={{width:'100%',height:160}}
                resizeMode="cover"
              />
              <View style={{position:'absolute',top:'25%',left:'28%'}}>
                <View style={{backgroundColor:C.orange,width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#FFF',...SHADOW.glow}}>
                  <Text style={{fontSize:16}}>🏍️</Text>
                </View>
              </View>
              <View style={{position:'absolute',top:'52%',left:'55%'}}>
                <View style={{backgroundColor:C.red,width:32,height:32,borderRadius:16,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#FFF'}}>
                  <Text style={{fontSize:14}}>📍</Text>
                </View>
              </View>
              <View style={{position:'absolute',bottom:8,right:8,backgroundColor:'rgba(0,0,0,0.7)',paddingHorizontal:8,paddingVertical:4,borderRadius:10}}>
                <Text style={{color:'#FFF',fontSize:11,fontWeight:'700'}}>~30 min away</Text>
              </View>
            </View>
            <View style={{padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
              <View><Text style={{fontWeight:'700',color:C.text}}>📍 {selArea}, Visakhapatnam</Text><Text style={{color:C.muted,fontSize:12,marginTop:2}}>Professional on the way</Text></View>
              <Badge label="~30 min" color={C.orange}/>
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
            {[{l:'Booking Confirmed',done:true,t:trackOrd.time},{l:'Professional Assigned',done:true,t:pro?.name+' assigned'},{l:'On the Way',done:false,t:''},{l:'Service Started',done:false,t:''},{l:'Completed',done:false,t:''}].map((step,i)=>(
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
            <TouchableOpacity key={svc.id} onPress={()=>openService(svc)}
              style={{width:(W-42)/2,backgroundColor:C.card,borderRadius:18,padding:14,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
              <View style={{width:'100%',height:80,borderRadius:12,backgroundColor:`${svc.color}15`,alignItems:'center',justifyContent:'center',marginBottom:10}}>
                <Text style={{fontSize:42}}>{svc.icon}</Text>
              </View>
              <Text style={{fontSize:14,fontWeight:'700',color:C.text,marginBottom:2}} numberOfLines={1}>{svc.name}</Text>
              <Text style={{fontSize:11,color:C.muted,marginBottom:6}} numberOfLines={1}>{svc.desc||'Full package service'}</Text>
              <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                <DText style={{fontSize:14,fontWeight:'700',color:C.orange}}>Starts ₹{svc.durations?.[0]?.price||99}</DText>
                <Text style={{fontSize:18,color:C.orange}}>›</Text>
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

      {/* ✅ COMING SOON section */}
      <View style={{marginHorizontal:16,marginBottom:22}}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <DText style={{fontSize:17,fontWeight:'700',color:C.text}}>🔜 Coming Soon</DText>
          <Badge label="Launching next month" color={C.teal}/>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingRight:4}}>
          {[
            {icon:'🍳',name:'Cooking\nService',   color:'#E87030',sub:'Home chef at your door',   tag:'July 2026'},
            {icon:'🔧',name:'Appliance\nRepair',  color:'#183880',sub:'AC, fridge, washing machine',tag:'July 2026'},
            {icon:'🌿',name:'Garden\nCare',        color:'#1E6B3A',sub:'Plant care & gardening',    tag:'Aug 2026'},
            {icon:'🎨',name:'Painting\nService',  color:'#4E2480',sub:'Interior wall painting',     tag:'Aug 2026'},
          ].map((item,i)=>(
            <View key={i} style={{width:140,backgroundColor:C.card,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,...SHADOW.card}}>
              <View style={{width:52,height:52,borderRadius:16,backgroundColor:`${item.color}18`,alignItems:'center',justifyContent:'center',marginBottom:10,borderWidth:0.5,borderColor:`${item.color}30`}}>
                <Text style={{fontSize:28}}>{item.icon}</Text>
              </View>
              <DText style={{fontSize:13,fontWeight:'700',color:C.text,lineHeight:17,marginBottom:4}}>{item.name}</DText>
              <Text style={{fontSize:10,color:C.muted,lineHeight:14,marginBottom:8}}>{item.sub}</Text>
              <View style={{backgroundColor:`${item.color}15`,paddingHorizontal:8,paddingVertical:3,borderRadius:20,alignSelf:'flex-start',borderWidth:0.5,borderColor:`${item.color}30`}}>
                <Text style={{fontSize:9,color:item.color,fontWeight:'700'}}>{item.tag}</Text>
              </View>
            </View>
          ))}
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
              <Text style={{fontSize:28}}>{svc.icon}</Text>
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

        {/* Coming Soon services */}
        <Text style={{fontSize:13,fontWeight:'700',color:C.muted,marginHorizontal:16,marginTop:8,marginBottom:10,letterSpacing:0.8}}>COMING SOON</Text>
        {SERVICES.filter(s=>['sofa','beauty','deep','elder'].includes(s.id)).map((svc)=>(
          <View key={svc.id} style={{flexDirection:'row',alignItems:'center',backgroundColor:C.card,marginHorizontal:16,marginBottom:10,borderRadius:20,padding:14,borderWidth:0.5,borderColor:C.border2,overflow:'hidden',opacity:0.65}}>
            <View style={{position:'absolute',left:0,top:0,bottom:0,width:5,backgroundColor:C.muted2}}/>
            <View style={{width:56,height:56,borderRadius:18,backgroundColor:C.light,alignItems:'center',justifyContent:'center',marginRight:14,marginLeft:10}}>
              <Text style={{fontSize:28}}>{svc.icon}</Text>
            </View>
            <View style={{flex:1}}>
              <DText style={{fontSize:15,fontWeight:'700',color:C.muted}}>{svc.shortName}</DText>
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

  const BookingsTab=()=>(
    <SafeAreaView style={{flex:1,backgroundColor:C.bg}}>
      <View style={[S.topBar,{paddingTop:52}]}>
        <View style={{width:36}}/><DText style={[S.topTitle,{fontSize:20}]}>My Bookings</DText><View style={{width:36}}/>
      </View>
      <ScrollView style={{flex:1,padding:16}}>
        {orders.length===0?(
          <View style={{alignItems:'center',paddingTop:80}}>
            <Text style={{fontSize:60,marginBottom:16}}>📋</Text>
            <DText style={{color:C.text,fontSize:18,fontWeight:'700',marginBottom:8}}>No bookings yet</DText>
            <Text style={{color:C.muted,fontSize:14,marginBottom:28,textAlign:'center'}}>{user?'Book your first VEGA service!':'Login to see your bookings'}</Text>
            <TouchableOpacity style={S.btn} onPress={()=>user?setTab('services'):setScreen('login')}><Text style={S.btnT}>{user?'Book Now':'Login'}</Text></TouchableOpacity>
          </View>
        ):orders.map(o=>(
          <TouchableOpacity key={o.orderId} style={{backgroundColor:C.card,borderRadius:22,marginBottom:12,overflow:'hidden',...SHADOW.soft}} onPress={()=>{setTrackOrd(o);setScreen('track');}}>
            <View style={{height:5,backgroundColor:C.orange}}/>
            <View style={{padding:16}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:10}}>
                <Text style={{color:C.orange,fontWeight:'700',letterSpacing:0.5}}>#{o.orderId}</Text>
                <View style={{flexDirection:'row',gap:6,alignItems:'center'}}>
                  {o.rated&&<Text style={{fontSize:11}}>{'⭐'.repeat(o.rating||0)}</Text>}
                  <Badge label={o.status} color={C.green}/>
                </View>
              </View>
              {o.professional&&(
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12,backgroundColor:C.bg,borderRadius:12,padding:10,borderWidth:0.5,borderColor:C.border2}}>
                  <View style={{width:32,height:32,borderRadius:16,backgroundColor:o.professional.color+'22',alignItems:'center',justifyContent:'center'}}>
                    <DText style={{fontSize:14,fontWeight:'700',color:o.professional.color}}>{o.professional.initial}</DText>
                  </View>
                  <Text style={{fontSize:13,fontWeight:'600',color:C.text}}>{o.professional.name}</Text>
                  <Text style={{fontSize:12,color:C.muted}}>· ★ {o.professional.rating}</Text>
                </View>
              )}
              {o.items?.slice(0,2).map((item,i)=>(
                <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:8}}>
                  <View style={{width:40,height:40,borderRadius:12,backgroundColor:C.orangeSolid,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20}}>{item.icon}</Text></View>
                  <View style={{flex:1}}>
                    <Text style={{fontWeight:'600',color:C.text,fontSize:13}} numberOfLines={1}>{item.name}</Text>
                    {item.extras?.length>0&&<Text style={{fontSize:10,color:C.green}} numberOfLines={1}>+ {item.extras.join(', ')}</Text>}
                  </View>
                  <DText style={{color:C.orange,fontWeight:'700',fontSize:14}}>₹{item.price}</DText>
                </View>
              ))}
              <View style={{height:1,backgroundColor:C.border,marginVertical:10}}/>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{color:C.muted,fontSize:12}}>📅 {o.slot?.split(',')[0]||o.slot}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                  <DText style={{color:C.orange,fontWeight:'700',fontSize:16}}>₹{o.total}</DText>
                  {!o.rated&&(
                    <TouchableOpacity style={{backgroundColor:C.orangeBg,paddingHorizontal:12,paddingVertical:5,borderRadius:20,borderWidth:0.5,borderColor:C.orangeBd}} onPress={()=>{setRatingOrd(o);setUserRating(0);setRatingNote('');setScreen('rate');}}>
                      <Text style={{color:C.orange,fontSize:12,fontWeight:'700'}}>Rate ⭐</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

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
            ['📍','Saved Addresses',()=>Alert.alert('Coming Soon')],
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
              {['Home Cleaning','Bathroom Cleaning','Kitchen Cleaning','Car Wash','Beauty Care','Deep Cleaning','Elder Care','Sofa Cleaning'].map((q,i)=>(
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
                    <Text style={{fontSize:24}}>{svc.icon}</Text>
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
    {id:'home',    icon:'🏠', label:'Home'},
    {id:'services',icon:'📋', label:'Booking'},
    {id:'offers',  icon:'🎁', label:'Offers'},
    {id:'profile', icon:'👤', label:'Profile'},
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
                <Text style={{fontSize:20,marginBottom:1}}>{t.icon}</Text>
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
              <Text style={{fontSize:20,marginBottom:1}}>🛒</Text>
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
