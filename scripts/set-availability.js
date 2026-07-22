// Set App Store availability for VEGA Home Services.
// THIS IS WHY THE APP SHOWED "not available in your country" — the
// appAvailabilities record was never created, so no territory was enabled.
//
// Creates a fresh appAvailabilities record including: India (primary),
// USA, UK, Australia, Canada, Singapore, UAE, Saudi Arabia, Kuwait, NZ, Ireland.
// Also flag "availableInNewTerritories=true" so future Apple-added countries
// auto-enable.
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const KEY_ID    = 'LHLV7R8HWA';
const ISSUER_ID = 'cd055938-80a7-4ccc-9bad-cec819845051';
const KEY_PATH  = path.join(__dirname, '..', 'asc-api-key.p8');
const APP_ID    = '6769142600';

// Territories to enable. ISO 3166-1 alpha-3 codes (Apple's format).
// India is the primary market. Other countries chosen to cover Indian
// diaspora + major English-speaking app stores.
// Will be populated dynamically from Apple's /v1/territories endpoint.
let TERRITORIES = [];

function base64url(b) { return Buffer.from(b).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function makeJWT() {
  const pk = fs.readFileSync(KEY_PATH, 'utf8');
  const now = Math.floor(Date.now()/1000);
  const eh = base64url(JSON.stringify({alg:'ES256',kid:KEY_ID,typ:'JWT'}));
  const ep = base64url(JSON.stringify({iss:ISSUER_ID,iat:now,exp:now+60*20,aud:'appstoreconnect-v1'}));
  const m = `${eh}.${ep}`;
  const s = crypto.createSign('SHA256'); s.update(m);
  return `${m}.${base64url(s.sign({key:pk,dsaEncoding:'ieee-p1363'}))}`;
}
function api(method, p, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { Authorization: `Bearer ${token}` };
    if (body) { headers['Content-Type']='application/json'; headers['Content-Length']=Buffer.byteLength(data); }
    const req = https.request({host:'api.appstoreconnect.apple.com',path:p,method,headers}, r => {
      let buf=''; r.on('data',c=>buf+=c);
      r.on('end',()=>{ try { resolve({status:r.statusCode, body: buf?JSON.parse(buf):null}); } catch { resolve({status:r.statusCode, body:buf}); }});
    });
    req.on('error', reject);
    if (body) req.write(data);
    req.end();
  });
}

(async () => {
  const token = makeJWT();

  // 1. Pull the complete list of Apple territories (~175 ISO-3 codes)
  console.log('Fetching all Apple territories...');
  const tRes = await api('GET', '/v1/territories?limit=200', token);
  if (tRes.status !== 200) { console.error('Territory list failed:', tRes.body); return; }
  TERRITORIES = (tRes.body.data || []).map(t => t.id);
  console.log(`Found ${TERRITORIES.length} territories.`);
  console.log(`  India present: ${TERRITORIES.includes('IND')}`);

  console.log(`\nCreating appAvailabilities for ALL ${TERRITORIES.length} territories...`);

  // Build the included[] array of territoryAvailabilities — one per territory.
  // Each one references a territory by its ISO-3 code.
  // Local IDs must use the ${name} format per Apple's JSON:API rules
  const included = TERRITORIES.map(code => ({
    type: 'territoryAvailabilities',
    id:   `\${ta_${code}}`,
    attributes: {
      available: true,
    },
    relationships: {
      territory: { data: { type: 'territories', id: code } },
    },
  }));

  // The main appAvailabilities resource
  const body = {
    data: {
      type: 'appAvailabilities',
      attributes: { availableInNewTerritories: true },
      relationships: {
        app: { data: { type: 'apps', id: APP_ID } },
        territoryAvailabilities: {
          data: included.map(t => ({ type: 'territoryAvailabilities', id: t.id })),
        },
      },
    },
    included,
  };

  const r = await api('POST', '/v2/appAvailabilities', token, body);
  console.log('POST status:', r.status);
  console.log(JSON.stringify(r.body, null, 2).substring(0, 1500));

  if (r.status === 201 || r.status === 200) {
    console.log('\nSUCCESS — availability set.');
    console.log('Re-fetching to confirm...');
    const v = await api('GET', `/v1/apps/${APP_ID}/appAvailabilityV2?include=territoryAvailabilities`, token);
    console.log('verify status:', v.status);
    if (v.status === 200) {
      const ts = (v.body.included || []).filter(x => x.type === 'territoryAvailabilities' && x.attributes?.available);
      console.log(`  active territories: ${ts.length}`);
      const codes = ts.map(t => t.relationships?.territory?.data?.id || t.id).slice(0, 30);
      console.log('  codes:', codes.join(', '));
    }
  } else {
    console.error('\nFAILED — see error above. App may need manual territory setup via App Store Connect UI:');
    console.error('  https://appstoreconnect.apple.com/apps/6769142600/distribution/pricing');
  }
})().catch(e => console.error('ERROR:', e.message));
