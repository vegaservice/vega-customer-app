// Check which territories the VEGA Home Services app is available in.
// Apple's ASC API endpoint: GET /v1/apps/{id}/appAvailabilityV2  (new)
// Fallback: GET /v1/apps/{id}/availabilities  (old)

const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const KEY_ID    = 'LHLV7R8HWA';
const ISSUER_ID = 'cd055938-80a7-4ccc-9bad-cec819845051';
const KEY_PATH  = path.join(__dirname, '..', 'asc-api-key.p8');
const APP_ID    = '6769142600';

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function makeJWT() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const h = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const p = { iss: ISSUER_ID, iat: now, exp: now + 60*20, aud: 'appstoreconnect-v1' };
  const eh = base64url(JSON.stringify(h));
  const ep = base64url(JSON.stringify(p));
  const m = `${eh}.${ep}`;
  const s = crypto.createSign('SHA256');
  s.update(m);
  const sig = s.sign({ key: pk, dsaEncoding: 'ieee-p1363' });
  return `${m}.${base64url(sig)}`;
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
  const token = makeJWT();

  // 1. Get the appAvailabilityV2 record id
  console.log('Fetching appAvailabilityV2 record...');
  const av = await api('GET',
    `/v1/apps/${APP_ID}/appAvailabilityV2?include=territoryAvailabilities`,
    token);
  console.log('Status:', av.status);
  if (av.status !== 200) {
    console.log(JSON.stringify(av.body, null, 2));
    return;
  }
  const recordId = av.body?.data?.id;
  console.log('Availability record id:', recordId);
  console.log('Attributes:', JSON.stringify(av.body?.data?.attributes, null, 2));

  // 2. List which territories are available
  const territories = (av.body.included || []).filter(x => x.type === 'territoryAvailabilities');
  console.log(`\nTotal territories returned: ${territories.length}`);
  const available = territories.filter(t => t.attributes?.available);
  const unavailable = territories.filter(t => !t.attributes?.available);
  console.log(`  available:   ${available.length}`);
  console.log(`  unavailable: ${unavailable.length}`);

  // 3. Specifically check India + a few common regions
  const checks = ['IND', 'USA', 'GBR', 'AUS', 'CAN', 'SGP', 'ARE'];
  console.log('\nKey territory states:');
  checks.forEach(t => {
    const match = territories.find(x => x.id?.endsWith('/' + t) || x.id === t || x.attributes?.territory === t);
    console.log(`  ${t}: ${match ? (match.attributes?.available ? 'AVAILABLE' : 'NOT AVAILABLE') : 'NOT FOUND in record'}`);
  });

  // 4. Show a sample of which IDs Apple uses
  console.log('\nFirst 10 territory ids in response:');
  territories.slice(0, 10).forEach(t => {
    console.log(`  id=${t.id}  available=${t.attributes?.available}  ts=${t.attributes?.territory || '-'}`);
  });
})().catch(e => console.error('ERROR:', e.message));
