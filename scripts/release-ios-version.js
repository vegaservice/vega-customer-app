// Release the approved iOS App Store version to the public App Store.
// Uses Apple's App Store Connect REST API endpoint:
//   POST /v1/appStoreVersionReleaseRequests
//
// This is the FINAL, IRREVERSIBLE action that pushes the approved app
// from "Ready for Distribution" → "Pending Apple Release" → "Ready for Sale"
// (live on the public App Store, typically within 2-24 hours).

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const KEY_ID    = 'LHLV7R8HWA';
const ISSUER_ID = 'cd055938-80a7-4ccc-9bad-cec819845051';
const KEY_PATH  = path.join(__dirname, '..', 'asc-api-key.p8');
const APP_ID    = '6769142600';
const PLATFORM  = 'IOS';

// ── JWT ES256 ─────────────────────────────────────────────────────
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

function api(method, p, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    const req = https.request({ host: 'api.appstoreconnect.apple.com', path: p, method, headers }, r => {
      let buf = ''; r.on('data', c => buf += c);
      r.on('end', () => { try { resolve({ status: r.statusCode, body: buf ? JSON.parse(buf) : null }); } catch { resolve({ status: r.statusCode, body: buf }); }});
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('Generating JWT...');
  const token = makeJWT();

  // 1. Find the current Ready-for-Distribution appStoreVersion 1.0
  console.log('Looking up appStoreVersion 1.0 (IOS, ready for release)...');
  const versRes = await api('GET',
    `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=${PLATFORM}&filter[versionString]=1.0&limit=10`, token);
  if (versRes.status !== 200) {
    console.error('Failed to list versions:', versRes.status, JSON.stringify(versRes.body, null, 2));
    process.exit(1);
  }
  const versions = versRes.body.data || [];
  versions.forEach(v => console.log(`  id=${v.id}  state=${v.attributes.appStoreState}  vstring=${v.attributes.versionString}`));

  // Apple's modern state name is APPROVED. Older docs use READY_FOR_SALE / PENDING_DEVELOPER_RELEASE.
  const releasable = versions.find(v =>
    ['APPROVED', 'PENDING_DEVELOPER_RELEASE', 'READY_FOR_DISTRIBUTION'].includes(v.attributes.appStoreState));
  const version = releasable || versions[0];
  if (!version) { console.error('No appStoreVersion found.'); process.exit(1); }
  console.log(`Using version id=${version.id}, current state=${version.attributes.appStoreState}`);

  // 2. POST a releaseRequest for that version
  console.log('Creating appStoreVersionReleaseRequest...');
  const rel = await api('POST', '/v1/appStoreVersionReleaseRequests', token, {
    data: {
      type: 'appStoreVersionReleaseRequests',
      relationships: {
        appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
      },
    },
  });

  if (rel.status === 201) {
    console.log('SUCCESS: release requested.');
    console.log('  request id:', rel.body?.data?.id);
    console.log('  status will move to PROCESSING_FOR_APP_STORE then READY_FOR_SALE');
    console.log('  globally live in 2-24 hours');
  } else {
    console.error(`Release request failed: status=${rel.status}`);
    console.error(JSON.stringify(rel.body, null, 2));
    process.exit(1);
  }

  // 3. Re-fetch the version state to confirm transition
  console.log('Re-fetching version state...');
  const verify = await api('GET', `/v1/appStoreVersions/${version.id}`, token);
  if (verify.status === 200) {
    console.log(`  New state: ${verify.body?.data?.attributes?.appStoreState}`);
  }
})().catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
