// Submit iOS build 6 to Apple App Review via the ASC REST API
// Bypasses the broken App Store Connect UI flow.
//
// Steps:
//   1. Generate ES256 JWT from asc-api-key.p8
//   2. Find appStoreVersion 1.0 (platform IOS) for the app
//   3. Find build with version "6" for the app
//   4. PATCH the version's build relationship → set to build 6
//   5. POST a new reviewSubmission (platform IOS)
//   6. POST a reviewSubmissionItem linking the version to the submission
//   7. PATCH the reviewSubmission state → SUBMITTED (submit for review)

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

// ── Config (from eas.json + project) ─────────────────────────────────────
const KEY_ID      = 'LHLV7R8HWA';
const ISSUER_ID   = 'cd055938-80a7-4ccc-9bad-cec819845051';
const KEY_PATH    = path.join(__dirname, '..', 'asc-api-key.p8');
const APP_ID      = '6769142600';
const TARGET_BUILD_VERSION = '6';
const TARGET_VERSION_STRING = '1.0';   // appStoreVersion versionString
const PLATFORM    = 'IOS';

// ── JWT generation (ES256) ───────────────────────────────────────────────
function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJWT() {
  const privateKey = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);

  const header  = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const payload = { iss: ISSUER_ID, iat: now, exp: now + 60 * 20, aud: 'appstoreconnect-v1' };

  const eh = base64url(JSON.stringify(header));
  const ep = base64url(JSON.stringify(payload));
  const message = `${eh}.${ep}`;

  const sign = crypto.createSign('SHA256');
  sign.update(message);
  const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${message}.${base64url(sig)}`;
}

// ── HTTP helper ──────────────────────────────────────────────────────────
function api(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({ host: 'api.appstoreconnect.apple.com', path, method, headers }, r => {
      let buf = '';
      r.on('data', c => (buf += c));
      r.on('end', () => {
        let parsed = null;
        try { parsed = buf ? JSON.parse(buf) : null; } catch (_) { parsed = buf; }
        resolve({ status: r.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────
(async () => {
  console.log('🔑 Generating JWT…');
  const token = makeJWT();

  // 1. Find appStoreVersion 1.0 (IOS, in EDITABLE state)
  console.log(`\n🔎 Looking up appStoreVersion ${TARGET_VERSION_STRING} (${PLATFORM})…`);
  const versRes = await api('GET',
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=${PLATFORM}&filter[versionString]=${TARGET_VERSION_STRING}&limit=10`,
    token);
  if (versRes.status !== 200) {
    console.error('❌ Failed to list versions:', versRes.status, JSON.stringify(versRes.body, null, 2));
    process.exit(1);
  }
  const versions = versRes.body.data || [];
  console.log(`   Found ${versions.length} matching version(s):`);
  versions.forEach(v => console.log(`     id=${v.id}  state=${v.attributes.appStoreState}  vstring=${v.attributes.versionString}`));
  // Pick the most editable one (not removed)
  const version = versions.find(v => v.attributes.appStoreState !== 'PENDING_DEVELOPER_RELEASE' && v.attributes.appStoreState !== 'IN_REVIEW') || versions[0];
  if (!version) { console.error('❌ No usable appStoreVersion'); process.exit(1); }
  console.log(`   → Using version ${version.id} (state=${version.attributes.appStoreState})`);

  // 2. Find build with version 6
  console.log(`\n🔎 Looking up build #${TARGET_BUILD_VERSION}…`);
  const buildRes = await api('GET',
    `/v1/builds?filter[app]=${APP_ID}&filter[version]=${TARGET_BUILD_VERSION}&limit=5&sort=-uploadedDate`,
    token);
  if (buildRes.status !== 200) {
    console.error('❌ Failed to list builds:', buildRes.status, JSON.stringify(buildRes.body, null, 2));
    process.exit(1);
  }
  const builds = buildRes.body.data || [];
  console.log(`   Found ${builds.length} matching build(s):`);
  builds.forEach(b => console.log(`     id=${b.id}  version=${b.attributes.version}  state=${b.attributes.processingState}  uploaded=${b.attributes.uploadedDate}`));
  const build = builds.find(b => b.attributes.processingState === 'VALID') || builds[0];
  if (!build) { console.error('❌ Build 6 not found'); process.exit(1); }
  console.log(`   → Using build ${build.id} (processingState=${build.attributes.processingState})`);

  // 3. PATCH version's build relationship
  console.log(`\n🔧 Attaching build 6 to version 1.0…`);
  const linkRes = await api('PATCH',
    `/v1/appStoreVersions/${version.id}/relationships/build`,
    token,
    { data: { type: 'builds', id: build.id } });
  if (linkRes.status !== 204 && linkRes.status !== 200) {
    console.error('❌ Failed to link build:', linkRes.status, JSON.stringify(linkRes.body, null, 2));
    process.exit(1);
  }
  console.log(`   ✅ Build 6 attached to version 1.0`);

  // 4. Create review submission
  console.log(`\n📤 Creating reviewSubmission (platform ${PLATFORM})…`);
  const subRes = await api('POST', '/v1/reviewSubmissions', token, {
    data: {
      type: 'reviewSubmissions',
      attributes: { platform: PLATFORM },
      relationships: { app: { data: { type: 'apps', id: APP_ID } } },
    },
  });
  if (subRes.status !== 201) {
    console.error('❌ Failed to create reviewSubmission:', subRes.status, JSON.stringify(subRes.body, null, 2));
    process.exit(1);
  }
  const submission = subRes.body.data;
  console.log(`   ✅ Review submission created: id=${submission.id}`);

  // 5. Add the version to the submission as an item
  console.log(`\n📎 Adding appStoreVersion ${version.id} to the submission…`);
  const itemRes = await api('POST', '/v1/reviewSubmissionItems', token, {
    data: {
      type: 'reviewSubmissionItems',
      relationships: {
        reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
        appStoreVersion:  { data: { type: 'appStoreVersions',  id: version.id } },
      },
    },
  });
  if (itemRes.status !== 201) {
    console.error('❌ Failed to add submission item:', itemRes.status, JSON.stringify(itemRes.body, null, 2));
    process.exit(1);
  }
  console.log(`   ✅ Item added: id=${itemRes.body.data.id}`);

  // 6. Submit for review (state → SUBMITTED)
  console.log(`\n🚀 Submitting for review (state=SUBMITTED)…`);
  const finalRes = await api('PATCH', `/v1/reviewSubmissions/${submission.id}`, token, {
    data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } },
  });
  if (finalRes.status !== 200) {
    console.error('❌ Failed to submit:', finalRes.status, JSON.stringify(finalRes.body, null, 2));
    process.exit(1);
  }
  console.log(`   ✅ Submission ${submission.id} is now in Apple's review queue!`);
  console.log(`\n🎉 DONE — build 1.0.0 (6) submitted to App Review.`);
  console.log(`\n   App Store Connect link:`);
  console.log(`   https://appstoreconnect.apple.com/apps/${APP_ID}/distribution/ios/version/inflight`);
})().catch(e => { console.error('💥 ERROR:', e.message); process.exit(1); });
