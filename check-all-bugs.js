// Check all bug reports filed in the app (Firestore bug_reports collection)
const admin = require('./functions/node_modules/firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  console.log('======================================================');
  console.log('  ALL BUG REPORTS — Firestore bug_reports collection');
  console.log('======================================================\n');

  const snap = await db.collection('bug_reports').orderBy('reportedAt', 'desc').get();
  console.log(`Total bug reports: ${snap.size}\n`);

  const byStatus = { open: [], in_progress: [], resolved: [], closed: [], other: [] };
  snap.forEach(doc => {
    const d = doc.data();
    const status = d.status || 'other';
    const bucket = byStatus[status] || byStatus.other;
    bucket.push({ id: doc.id, ...d });
  });

  console.log('Status breakdown:');
  Object.entries(byStatus).forEach(([s, list]) => {
    if (list.length > 0) console.log(`  ${s}: ${list.length}`);
  });
  console.log();

  // Show OPEN bugs first (most important)
  const open = byStatus.open || [];
  console.log(`=== OPEN BUGS (${open.length}) ===\n`);
  open.forEach((b, i) => {
    const bugId = 'BUG-' + b.id.slice(-6).toUpperCase();
    const date = b.reportedAt?.toDate?.()?.toISOString()?.slice(0, 16).replace('T', ' ') || '?';
    console.log(`[${i+1}] ${bugId} | ${b.severity || 'normal'} | ${b.app || '?'} | ${date}`);
    console.log(`     Screen:   ${b.currentScreen || '?'}`);
    console.log(`     User:     ${b.userPhone || 'guest'}`);
    console.log(`     Has shot: ${b.hasScreenshot ? 'YES' : 'no'}`);
    console.log(`     What:     ${(b.description || '').substring(0, 200)}`);
    if ((b.description || '').length > 200) console.log(`               ...${(b.description || '').length - 200} more chars`);
    console.log();
  });

  if (open.length === 0) console.log('No open bugs!\n');

  // Show recent in-progress + resolved too
  const others = ['in_progress', 'resolved', 'closed'];
  for (const s of others) {
    const list = byStatus[s] || [];
    if (list.length === 0) continue;
    console.log(`\n=== ${s.toUpperCase()} BUGS (showing latest 5 of ${list.length}) ===\n`);
    list.slice(0, 5).forEach((b, i) => {
      const bugId = 'BUG-' + b.id.slice(-6).toUpperCase();
      console.log(`  ${bugId} | ${b.app || '?'} | ${b.severity || 'normal'} | ${(b.description || '').substring(0, 100)}`);
    });
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
