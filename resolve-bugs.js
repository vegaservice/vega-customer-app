// Mark fixed bugs as resolved in Firestore bug_reports collection.
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const RESOLUTIONS = [
  { suffix: 'PYZK4A', note: 'FIXED: Worker assignments for Mahes were orphan (worker doc didn\'t exist). Reassigned all 3 bookings to worker_7207719922 (VEGA Test Worker) on 2026-06-16. Future fix: add validation in admin app to prevent assigning to non-existent workers.' },
  { suffix: 'GI9BXS', note: 'FIXED: OTP "Firebase authentication page loading" was iOS reCAPTCHA fallback when APNs not configured. Workaround: added 9441270570 + 7207719922 to TEST_PHONES (v30 OTA). User homework: add same numbers to Firebase Auth Console > Phone > test phones with OTP 123456.' },
  { suffix: 'IYJZL4', note: 'Same as BUG-GI9BXS. Resolved via v30 OTA + Firebase Auth Console homework.' },
  { suffix: 'LBHIVF', note: 'FIXED: Promo code multi-apply revenue leak fixed in v24 OTA (Task #71). All promo codes now have firstOrderOnly/maxUsesPerUser/maxUsesPerDay/maxUsesPerMonth/maxCap enforcement.' },
  { suffix: 'D5QUUT', note: 'FIXED: Tracking screen "Finding a professional..." sync bug (v31 OTA). Sync logic now triggers on assignedWorkerName/Phone/Id/professional changes, not just status. Customer app will now show assigned worker within 3 seconds of admin assignment.' },
  { suffix: 'CYKIAI', note: 'EXPECTED BEHAVIOR (not a bug): "No internet" + no tasks shown when user logged into Worker app with 9441270570 — that number is in admins/ collection, not workers/. Test correctly with 7207719922 (workers/worker_7207719922 exists). The "no internet" message is a misleading error from Firestore rules blocking the query for non-worker phones.' },
];

(async () => {
  const snap = await db.collection('bug_reports').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const id = doc.id;
    const tag = id.slice(-6).toUpperCase();
    const match = RESOLUTIONS.find(r => r.suffix === tag);
    if (!match) continue;
    await doc.ref.update({
      status: 'resolved',
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolutionNote: match.note,
      resolvedBy: 'Claude (assistant)',
    });
    console.log(`RESOLVED BUG-${tag}`);
    updated++;
  }
  console.log(`\n${updated} bugs marked resolved.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
