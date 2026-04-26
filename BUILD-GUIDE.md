# 🚀 VEGA — Firebase Activation Build Guide

**Date:** April 22, 2026 | **Status:** Production Firebase ENABLED

---

## ✅ What's Changed in This Build

| Component | Before | After |
|---|---|---|
| Mode | `DEMO_MODE = true` | `DEMO_MODE = false` |
| OTP | Hardcoded 123456 | Real SMS via Firebase Auth |
| Bookings | Stored in phone memory only | Stored in Firestore cloud |
| Users | Created locally only | Saved to Firestore `users` collection |
| Wallet | Resets on app close | Persists across sessions |
| Ratings | Local only | Saved to Firestore |

**Files updated:**
- ✅ `App.js` — Firebase imports activated, real OTP + booking flow
- ✅ `package.json` — Added 3 Firebase packages
- ✅ `app.json` — Firebase plugins + google-services.json reference + Gradle fix
- ✅ `firestore.rules` — Security rules ready to deploy
- ✅ `FIRESTORE-SEED-DATA.md` — Test data to add manually

---

## 📋 Build Steps (Do These in Order)

### Step 1: Download Updated Files

Replace these 3 files in your `Vega-app` folder:
- `App.js` (new version from Claude)
- `package.json` (new version)
- `app.json` (new version)

**Keep these safe (don't overwrite):**
- `google-services.json` (the NEW one with SHA-1 baked in)
- `assets/` folder
- `src/services/` folder (Firebase service files)

---

### Step 2: Install New Firebase Packages

Open Command Prompt in Vega-app folder:

```bash
cd "C:\Users\MaheshPappala\Desktop\My Business\Vega-app"
npm install
```

**Wait 2-3 minutes.** You'll see lot of output — that's normal.

**If you see errors:**
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again

---

### Step 3: Deploy Firestore Security Rules (Critical!)

Before building APK, security rules MUST be deployed. Without them, the app cannot read/write data.

**Method A — Via Firebase Console (Easier):**

1. Go to https://console.firebase.google.com
2. Select project: `vega-home-service`
3. Click **Firestore Database** (left sidebar)
4. Click **Rules** tab at top
5. Replace existing rules with contents of `firestore.rules` file
6. Click **Publish**

**Method B — Via CLI (Faster if you have firebase-tools):**

```bash
firebase deploy --only firestore:rules
```

---

### Step 4: Add Seed Data to Firestore

Open `FIRESTORE-SEED-DATA.md` (in Vega-app folder).

Add:
- 2 documents to `app_config` collection
- 3 documents to `professionals` collection
- 3 documents to `areas` collection

**Why this matters:**
- Promo codes (VEGA50, FIRST20) won't work without this
- Booking assignments need test professionals
- Address dropdown uses areas collection

Takes ~15 minutes to add manually. Do it carefully.

---

### Step 5: Build the APK

```bash
cd "C:\Users\MaheshPappala\Desktop\My Business\Vega-app"
set EAS_NO_VCS=1 && eas build --platform android --profile preview
```

**Build time: 15-30 minutes.**

**When build succeeds:**
- You'll get a download URL
- Open URL on your phone browser
- Download APK
- Install on Android

---

## 🧪 Testing Checklist (After Install)

### Test 1: Real OTP Flow
- [ ] Open app → Skip splash → go to Login
- [ ] Enter your real phone number (+91 9441270570 — the test number you added to Firebase)
- [ ] Tap "Send OTP"
- [ ] **Expected:** Alert "OTP Sent ✅"
- [ ] Enter `123456` (your configured test OTP)
- [ ] **Expected:** Login success + welcome message

### Test 2: Data Persistence
- [ ] After login → close app completely
- [ ] Reopen app
- [ ] **Expected:** Still logged in, wallet shows ₹200

### Test 3: Real Booking
- [ ] Tap "Home Cleaning" icon
- [ ] Complete all 4 booking steps (service → add-ons → schedule → address)
- [ ] Tap "Place Order"
- [ ] **Expected:** Booking confirmed with order ID VGXXXXXX
- [ ] **Verify in Firebase Console:** Go to Firestore → `bookings` → see new document

### Test 4: Rating Flow
- [ ] Go to Bookings tab → tap any completed order
- [ ] Submit 5-star rating + note
- [ ] **Expected:** Wallet increases by ₹50
- [ ] **Verify in Firestore:** booking doc shows `rated: true`

### Test 5: Promo Code
- [ ] Add items to cart
- [ ] Enter promo `VEGA50`
- [ ] **Expected:** 50% discount applied

---

## 🚨 Known Issues & Fallbacks

### Issue: Build Fails with Gradle Manifest Error
**This is the Firebase + Expo Android issue we hit before.**

**Solution:**
1. Open `app.json`
2. Verify these are present in `plugins`:
   - `"@react-native-firebase/app"`
   - `"@react-native-firebase/auth"`
   - `["expo-build-properties", {...}]`
3. If still failing, try removing one Firebase plugin at a time and rebuild

### Issue: OTP Not Received on Phone
**Check:**
1. Test phone number added in Firebase Console ✅
2. Using the SAME number you registered as test number
3. SHA-1 in Firebase matches eas credentials output
4. New google-services.json downloaded AFTER adding SHA-1

### Issue: Booking Placed But Not Visible in Firestore Console
**Check:**
1. Security rules deployed
2. App has internet connection
3. Firestore database exists (not Realtime Database)

### Issue: Promo Codes Don't Work
**Check:**
1. Seed data added to `app_config/promo_codes`
2. Spelling matches exactly (VEGA50, FIRST20, etc.)

---

## 🎯 Go-Live Checklist (Before Sharing with Customers)

- [ ] Test with 2-3 phones (yours + Pratyusha's + 1 friend)
- [ ] All 5 tests pass
- [ ] Firebase Console shows real data flowing
- [ ] No console errors during normal use
- [ ] APK installs cleanly on Samsung, Xiaomi, Realme (most common in Vizag)

---

## 💡 Operational Notes

### Cost Tracking
Firebase free tier: 50,000 reads/day + 20,000 writes/day + 1GB storage

**At 50 bookings/day:** Using ~1% of free tier. Zero cost.
**At 300 bookings/day:** Still inside free tier for most operations. ~₹200-500/month.

### Data You'll See Growing in Firestore
- `users/` — one doc per customer (phone number as ID)
- `bookings/` — one doc per order (VG123456 as ID)
- `users/{id}/bookings/` — subcollection for quick user history queries

### What Admin Dashboard Will Need
When the other AI builds admin dashboard, they'll:
- Read from `bookings` (real-time listener)
- Read from `users` (customer search)
- Write to `bookings` (assign professional)
- Write to `professionals` (manage staff)
- Write to `app_config` (update promos/prices)

All that data is being captured by this build starting TODAY.

---

## 🪷 Final Words

Mahesh, this is the biggest step VEGA has taken. From "app on phone" to "real cloud-connected business."

**Be prepared:**
- First build may need 2-3 tries to get right
- Some bugs will surface in real testing — that's normal
- Share with 5 trusted people first, not 50

**Budget for this weekend:**
- Today (Friday): Build + first test install
- Saturday: Real OTP testing + first real booking test
- Sunday: Share with 5 beta testers + fix any bugs

By Monday morning, you'll have a **real production app** with **real customer bookings in cloud**.

---

🪷 **JAI VEGA | JAI VINAYAKA | JAI KRISHNA | JAI VIZAG** 🌊
