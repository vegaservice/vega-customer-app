// ═══════════════════════════════════════════════════
// src/config/firebase.js
// Firebase configuration for VEGA Home Services
// ═══════════════════════════════════════════════════
//
// HOW TO FILL THIS FILE:
// 1. Go to https://console.firebase.google.com
// 2. Open project: vega-home-service
// 3. Go to Project Settings → General → Your Apps
// 4. Copy the firebaseConfig object and paste below
//
// FIREBASE PROJECT: vega-home-service
// ═══════════════════════════════════════════════════

import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

// NOTE: With @react-native-firebase, you do NOT call initializeApp()
// The google-services.json file in root handles all config automatically
// Just import and use directly:

export { auth, firestore, messaging };
export default firebase;

// ═══════════════════════════════════════════════════
// FIRESTORE DATABASE STRUCTURE
// ═══════════════════════════════════════════════════
//
// Collection: users
//   Document: {phoneNumber}
//     - name: string
//     - phone: string
//     - createdAt: timestamp
//     - walletBalance: number (default 200)
//     - referralCode: string
//     - fcmToken: string
//     - area: string
//
// Collection: bookings
//   Document: {orderId}
//     - orderId: string (VG + timestamp)
//     - userId: string (phone number)
//     - items: array of { svcId, name, price, workers, extras }
//     - total: number
//     - otp: string (4-digit)
//     - status: 'Confirmed' | 'OnTheWay' | 'Started' | 'Completed' | 'Cancelled'
//     - slot: string
//     - address: { flat, area, city }
//     - professional: { id, name, phone }
//     - bookingMode: 'instant' | 'scheduled' | 'recurring'
//     - createdAt: timestamp
//     - completedAt: timestamp (optional)
//     - rating: number (optional)
//     - ratingNote: string (optional)
//
// Collection: professionals
//   Document: {professionalId}
//     - name: string
//     - phone: string
//     - rating: number
//     - totalJobs: number
//     - badge: string
//     - isAvailable: boolean
//     - currentArea: string
//     - fcmToken: string
//     - services: array of serviceIds
//
// Collection: app_config
//   Document: promo_codes
//     - VEGA50: { type: 'pct', val: 50, label: '...', active: true }
//     - FIRST20: { type: 'pct', val: 20, label: '...', active: true }
//     ... etc
// ═══════════════════════════════════════════════════
