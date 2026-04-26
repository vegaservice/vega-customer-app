# 🪷 VEGA Firestore Seed Data — Copy Into Firebase Console

**Purpose:** Add initial test data so the app has promo codes, areas, and test professionals to display.

**Where to add:** Firebase Console → Firestore Database → Start collection

---

## 1️⃣ Collection: `app_config`

### Document ID: `promo_codes`

Fields to add (click "Add field" for each):

| Field name | Type | Value |
|---|---|---|
| VEGA50 | map | `{ type: "pct", val: 50, label: "50% off first order", active: true, minOrder: 99 }` |
| FIRST20 | map | `{ type: "pct", val: 20, label: "20% off", active: true, minOrder: 99 }` |
| FLAT100 | map | `{ type: "flat", val: 100, label: "₹100 flat off", active: true, minOrder: 349 }` |
| VIZAG20 | map | `{ type: "pct", val: 20, label: "Vizag special", active: true }` |
| VEGA2025 | map | `{ type: "pct", val: 20, label: "New user offer", active: true }` |

**Simpler method:** Click "JSON view" in Firestore and paste:

```json
{
  "VEGA50": {"type": "pct", "val": 50, "label": "50% off first order", "active": true, "minOrder": 99},
  "FIRST20": {"type": "pct", "val": 20, "label": "20% off", "active": true, "minOrder": 99},
  "FLAT100": {"type": "flat", "val": 100, "label": "₹100 flat off", "active": true, "minOrder": 349},
  "VIZAG20": {"type": "pct", "val": 20, "label": "Vizag special", "active": true},
  "VEGA2025": {"type": "pct", "val": 20, "label": "New user offer", "active": true}
}
```

---

### Document ID: `settings`

```json
{
  "signupBonus": 200,
  "referralBonus": 200,
  "ratingBonus": 50,
  "platformFee": 19,
  "instantArrivalMinutes": 45,
  "minOrderAmount": 99,
  "supportPhone": "+91-891-VEGA-999",
  "supportEmail": "hello@vegavizag.in",
  "emergencyBookingEnabled": false
}
```

---

## 2️⃣ Collection: `professionals`

Add 3-5 test professionals so bookings can assign real data.

### Document ID: `pro_lakshmi01`
```json
{
  "id": "pro_lakshmi01",
  "name": "Lakshmi Devi",
  "phone": "9999991111",
  "photo": null,
  "services": ["home", "bathroom", "kitchen", "t_fan", "t_dust"],
  "rating": 4.9,
  "totalJobs": 0,
  "badge": "Top Rated",
  "isAvailable": true,
  "isActive": true,
  "currentArea": "Madhurawada",
  "assignedAreas": ["Madhurawada", "Kommadi"],
  "hubId": "HUB_MADHURAWADA",
  "joinedAt": "2026-04-22",
  "earnings": {"today": 0, "thisWeek": 0, "thisMonth": 0, "total": 0}
}
```

### Document ID: `pro_priya02`
```json
{
  "id": "pro_priya02",
  "name": "Priya Kumari",
  "phone": "9999992222",
  "photo": null,
  "services": ["home", "bathroom", "kitchen", "beauty"],
  "rating": 4.8,
  "totalJobs": 0,
  "badge": "Verified",
  "isAvailable": true,
  "isActive": true,
  "currentArea": "Madhurawada",
  "assignedAreas": ["Madhurawada"],
  "hubId": "HUB_MADHURAWADA",
  "joinedAt": "2026-04-22",
  "earnings": {"today": 0, "thisWeek": 0, "thisMonth": 0, "total": 0}
}
```

### Document ID: `pro_ramu03`
```json
{
  "id": "pro_ramu03",
  "name": "Ramu Babu",
  "phone": "9999993333",
  "photo": null,
  "services": ["car", "t_wm", "appliance"],
  "rating": 4.7,
  "totalJobs": 0,
  "badge": "Rising Star",
  "isAvailable": true,
  "isActive": true,
  "currentArea": "Madhurawada",
  "assignedAreas": ["Madhurawada", "Rushikonda"],
  "hubId": "HUB_MADHURAWADA",
  "joinedAt": "2026-04-22",
  "earnings": {"today": 0, "thisWeek": 0, "thisMonth": 0, "total": 0}
}
```

---

## 3️⃣ Collection: `areas`

### Document ID: `madhurawada`
```json
{
  "id": "madhurawada",
  "name": "Madhurawada",
  "city": "Visakhapatnam",
  "pinCode": "530048",
  "hubId": "HUB_MADHURAWADA",
  "isActive": true,
  "centerLat": 17.8245,
  "centerLng": 83.4218,
  "radiusKm": 5
}
```

### Document ID: `rushikonda`
```json
{
  "id": "rushikonda",
  "name": "Rushikonda",
  "city": "Visakhapatnam",
  "pinCode": "530045",
  "hubId": "HUB_MADHURAWADA",
  "isActive": false,
  "centerLat": 17.7870,
  "centerLng": 83.3920,
  "radiusKm": 5
}
```

### Document ID: `mvp_colony`
```json
{
  "id": "mvp_colony",
  "name": "MVP Colony",
  "city": "Visakhapatnam",
  "pinCode": "530017",
  "hubId": "HUB_MADHURAWADA",
  "isActive": false,
  "centerLat": 17.7435,
  "centerLng": 83.3330,
  "radiusKm": 5
}
```

---

## ✅ After Adding Data

1. Go back to app
2. Open cart → enter promo code `VEGA50` → should apply 50% discount
3. Place a test booking → should appear in Firestore Console → `bookings` collection

If you see the booking document in Firebase Console after placing order = **Firebase is fully working!** 🎉

---

🪷 **JAI VEGA | JAI VINAYAKA | JAI KRISHNA | JAI VIZAG** 🌊
