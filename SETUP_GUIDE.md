# VEGA HOME SERVICES — COMPLETE SETUP GUIDE
# End-to-End Android Testing & Production Deployment
# ================================================================
# Mahesh Pappala | VEGA Vizag | April 2026
# ================================================================

## PROJECT STRUCTURE
```
vega-app/
├── App.js                          ← Main app (all screens)
├── app.json                        ← Expo config
├── eas.json                        ← Build profiles
├── package.json                    ← Dependencies
├── babel.config.js                 ← Babel config
├── google-services.json            ← Firebase (you add this)
├── assets/
│   ├── icon.png                    ← App icon (1024×1024)
│   ├── splash.png                  ← Splash image (1284×2778)
│   └── adaptive-icon.png           ← Android adaptive icon
└── src/
    ├── config/firebase.js          ← Firebase setup
    └── services/
        ├── firestoreService.js     ← All DB operations
        ├── notificationService.js  ← Push notifications
        └── paymentService.js       ← Razorpay
```

## ================================================================
## STEP 1 — INITIAL SETUP (One time only)
## ================================================================

### 1.1 Install Node.js
Download from: https://nodejs.org
Install LTS version (v20+)
Verify: node --version

### 1.2 Install EAS CLI
```bash
npm install -g eas-cli
npm install -g expo-cli
```

### 1.3 Login to Expo
```bash
eas login
# Username: mahesh1331
# Enter your Expo password
```

### 1.4 Navigate to project
```bash
cd "C:\Users\MaheshPappala\Desktop\My Business\vega-app"
```

### 1.5 Install dependencies
```bash
npm install
```

## ================================================================
## STEP 2 — FIREBASE SETUP
## ================================================================

### 2.1 Open Firebase Console
Go to: https://console.firebase.google.com
Open project: vega-home-service

### 2.2 Add Android App (if not done)
- Click "Add app" → Android
- Package name: com.vegavizag.app
- App nickname: VEGA Android
- Click "Register app"
- Download google-services.json
- Place it in: vega-app/ (root folder)

### 2.3 Enable Phone Authentication
- Firebase Console → Authentication → Sign-in method
- Enable "Phone" provider
- Save

### 2.4 Enable Firestore
- Firebase Console → Firestore Database
- Create database → Start in test mode (for now)
- Choose region: asia-south1 (Mumbai — closest to Vizag)

### 2.5 Firestore Security Rules (paste this)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
    match /app_config/{doc} {
      allow read: if request.auth != null;
    }
  }
}
```

### 2.6 Enable FCM (Cloud Messaging)
- Firebase Console → Project Settings → Cloud Messaging
- Note down Server Key (for backend notifications later)

### 2.7 Initial Promo Codes in Firestore
- Go to Firestore → Create collection: app_config
- Create document: promo_codes
- Add fields:
  - VEGA50: map { type: "pct", val: 50, label: "50% off - First order", active: true }
  - FIRST20: map { type: "pct", val: 20, label: "20% off - New user", active: true }
  - FLAT100: map { type: "flat", val: 100, label: "₹100 flat off", active: true }
  - VIZAG20: map { type: "pct", val: 20, label: "20% off - Vizag special", active: true }

## ================================================================
## STEP 3 — RAZORPAY SETUP
## ================================================================

### 3.1 Create Razorpay Account
Go to: https://razorpay.com
Click "Sign Up" → Business details (VEGA HOME SERVICES PVT LTD)

### 3.2 Get API Keys
- Dashboard → Settings → API Keys
- Generate Test Key
- Copy Key ID (starts with rzp_test_)

### 3.3 Add key to app
Open: src/services/paymentService.js
Replace: const RAZORPAY_KEY_TEST = 'rzp_test_REPLACE_WITH_YOUR_KEY';
With your actual key

### 3.4 When going live
- Complete KYC on Razorpay dashboard
- Get LIVE key (starts with rzp_live_)
- Set IS_PRODUCTION = true in paymentService.js

## ================================================================
## STEP 4 — QUICK DEMO TEST (No Firebase needed)
## ================================================================

### Test in Expo Go (fastest — 5 minutes):
```bash
cd vega-app
npm install
npx expo start --clear
```
- Download "Expo Go" from Play Store on your Android phone
- Scan QR code shown in terminal
- App opens immediately
- DEMO_MODE = true — use OTP 123456

### Test in Snack (browser, instant):
- Go to: https://snack.expo.dev
- Delete default code
- Paste entire App.js content
- Click "Android" preview on right

## ================================================================
## STEP 5 — REAL ANDROID BUILD (APK)
## ================================================================

### 5.1 Enable Firebase in App.js
Open App.js, find: const DEMO_MODE = true;
Change to: const DEMO_MODE = false;
Uncomment Firebase imports at top of App.js

### 5.2 Build APK for testing
```bash
cd vega-app
eas build --platform android --profile preview
```
- First build: ~15-20 minutes
- EAS sends you APK download link
- Install APK on any Android phone
- Real Firebase OTP works on physical device

### 5.3 Build for Play Store (AAB)
```bash
eas build --platform android --profile production
```
- Creates .aab file for Play Store upload

## ================================================================
## STEP 6 — SWITCHING FROM DEMO TO PRODUCTION
## ================================================================

### Changes needed in App.js:

1. Line: const DEMO_MODE = true;
   → Change to: const DEMO_MODE = false;

2. Uncomment at top of file:
   import auth from '@react-native-firebase/auth';
   import { createBooking, ... } from './src/services/firestoreService';
   import { getFCMToken, ... } from './src/services/notificationService';
   import { initiateRazorpayPayment } from './src/services/paymentService';

3. In sendOTP() function, uncomment:
   const confirmation = await auth().signInWithPhoneNumber(`+91${phone}`);
   setConfirm(confirmation);

4. In verifyOTP() function, uncomment:
   await confirm.confirm(otpVal);
   // and all user creation code

5. In confirmBooking() function, uncomment:
   const result = await createBooking(bookingData);

## ================================================================
## STEP 7 — MISSING FEATURES TO BUILD NEXT
## ================================================================

### A. Backend (Node.js server — Priority 1)
Why: Real-time professional assignment, order status updates, payment verification
Folder: vega-backend (you already have seva-backend)
Changes needed:
  - Rename "Seva" → "VEGA" throughout
  - Add endpoint: POST /api/bookings/assign-professional
  - Add endpoint: POST /api/payments/verify-razorpay
  - Add endpoint: POST /api/notifications/send

### B. Professional App (Separate App)
File: App-Professional.js (separate React Native app)
Features:
  - Login with professional credentials
  - See assigned bookings on map
  - Accept/Reject booking
  - OTP entry to start service
  - Complete service → trigger customer notification
  - Earnings dashboard

### C. Real-time Tracking (Priority 2)
- Add react-native-maps package
- Professional app shares GPS location every 30 seconds
- Customer app shows live pin movement
- Firestore: professionals/{id}/location → lat, lng, timestamp

### D. Google Maps Integration
In app.json, add:
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_GOOGLE_MAPS_API_KEY"
    }
  }
}
```
Get key from: console.cloud.google.com → APIs → Maps SDK for Android

### E. WhatsApp Notifications
When customer books → Send WhatsApp message via Twilio
- Sign up: twilio.com
- Enable WhatsApp Business API
- Message template: "VEGA: Your booking #{orderId} confirmed. OTP: {otp}. {proName} arrives at {slot}."

### F. Admin Dashboard (Web)
Simple React web app for Pratyusha to monitor:
- All bookings today
- Revenue dashboard
- Professional locations
- Customer support messages

## ================================================================
## STEP 8 — PLAY STORE SUBMISSION
## ================================================================

### 8.1 Create Play Store Account
- Go to: play.google.com/console
- Pay one-time $25 registration fee (~₹2,100)
- Fill developer profile

### 8.2 Create App Listing
- App name: VEGA Home Services
- Short description: Vizag's fastest home cleaning, car wash & beauty at your door
- Full description: Use VEGA master business plan content
- Category: Lifestyle
- Content rating: Everyone

### 8.3 Screenshots needed
- Phone screenshots: 2-8 (1080×1920 or 1080×2340)
- Feature graphic: 1024×500
- App icon: 512×512

### 8.4 Submit AAB
- Build AAB: eas build --platform android --profile production
- Upload AAB to Play Console
- Fill out all required forms
- Submit for review (takes 3-7 days for new apps)

## ================================================================
## QUICK REFERENCE — COMMANDS
## ================================================================

```bash
# Start dev server
npx expo start --clear

# Build APK (testing)  
eas build --platform android --profile preview

# Build AAB (Play Store)
eas build --platform android --profile production

# Check build status
eas build:list

# Update JS only (no rebuild needed)
eas update --branch preview

# View logs
eas build:view
```

## ================================================================
## TECH STACK SUMMARY
## ================================================================

| Layer          | Technology        | Status     |
|----------------|-------------------|------------|
| Mobile App     | React Native/Expo | ✅ Done    |
| UI             | Custom Premium    | ✅ Done    |
| Auth           | Firebase Phone    | ✅ Ready   |
| Database       | Firestore         | ✅ Ready   |
| Push Notif     | FCM               | ✅ Ready   |
| Payment        | Razorpay          | ✅ Ready   |
| Backend API    | Node.js (seva-backend) | ⏳ Rename & connect |
| Professional App | React Native    | ⏳ To build |
| Live GPS Track | react-native-maps | ⏳ To build |
| Admin Web      | React             | ⏳ To build |
| Play Store     | Google Play       | ⏳ After APK test |

## ================================================================
## JAI VEGA 🪷 JAI VIZAG 🌊
## ================================================================
