// Update App Store Connect Privacy Policy URL (+ Support URL + Marketing URL)
// to point to https://vegaservice.in.
//
// Why: now that vegaservice.in is LIVE with SSL, we can replace the placeholder
// or third-party hosted URLs with our own domain. This is a metadata change —
// NO Apple review needed, propagates in minutes.
//
// Updates:
//   appInfoLocalizations.privacyPolicyUrl -> https://vegaservice.in/privacy
//   appStoreVersionLocalizations.supportUrl -> https://vegaservice.in
//   appStoreVersionLocalizations.marketingUrl -> https://vegaservice.in
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const path = require('path');

const KEY_ID    = 'LHLV7R8HWA';
const ISSUER_ID = 'cd055938-80a7-4ccc-9bad-cec819845051';
const KEY_PATH  = path.join(__dirname, '..', 'asc-api-key.p8');
const APP_ID    = '6769142600';

const NEW_PRIVACY_URL   = 'https://vegaservice.in/privacy';
const NEW_SUPPORT_URL   = 'https://vegaservice.in';
const NEW_MARKETING_URL = 'https://vegaservice.in';

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

  // ---------- 1. PRIVACY URL: AppInfoLocalizations ----------
  console.log('Fetching app infos...');
  const ai = await api('GET', `/v1/apps/${APP_ID}/appInfos`, token);
  if (ai.status !== 200) { console.error('appInfos failed:', ai.body); return; }
  const editableAppInfo = (ai.body.data || []).find(x =>
    x.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION' ||
    x.attributes.appStoreState === 'READY_FOR_DISTRIBUTION' ||
    x.attributes.appStoreState === 'READY_FOR_REVIEW' ||
    !x.attributes.appStoreState
  ) || ai.body.data[0];
  console.log(`Using appInfo ${editableAppInfo.id} (state=${editableAppInfo.attributes.appStoreState})`);

  console.log('Fetching app info localizations...');
  const aiLoc = await api('GET', `/v1/appInfos/${editableAppInfo.id}/appInfoLocalizations`, token);
  if (aiLoc.status !== 200) { console.error('appInfoLocalizations failed:', aiLoc.body); return; }
  console.log(`Found ${aiLoc.body.data.length} locales for app info.`);

  for (const loc of aiLoc.body.data) {
    console.log(`  Updating privacy URL on ${loc.attributes.locale}...`);
    const r = await api('PATCH', `/v1/appInfoLocalizations/${loc.id}`, token, {
      data: {
        type: 'appInfoLocalizations',
        id: loc.id,
        attributes: { privacyPolicyUrl: NEW_PRIVACY_URL },
      },
    });
    console.log(`    -> ${r.status} ${r.status >= 200 && r.status < 300 ? 'OK' : JSON.stringify(r.body).substring(0, 200)}`);
  }

  // ---------- 2. SUPPORT + MARKETING URL: AppStoreVersionLocalizations ----------
  console.log('\nFetching app store versions (for support/marketing URL)...');
  const versions = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5&sort=-createdDate`, token);
  if (versions.status !== 200) { console.error('appStoreVersions failed:', versions.body); return; }
  const editableVersion = (versions.body.data || []).find(v =>
    ['READY_FOR_DISTRIBUTION', 'READY_FOR_SALE', 'PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'].includes(v.attributes.appStoreState)
  ) || versions.body.data[0];
  console.log(`Using version ${editableVersion.attributes.versionString} (state=${editableVersion.attributes.appStoreState})`);

  console.log('Fetching version localizations...');
  const vLoc = await api('GET', `/v1/appStoreVersions/${editableVersion.id}/appStoreVersionLocalizations`, token);
  if (vLoc.status !== 200) { console.error('versionLocalizations failed:', vLoc.body); return; }
  console.log(`Found ${vLoc.body.data.length} locales for version.`);

  for (const loc of vLoc.body.data) {
    console.log(`  Updating support+marketing URL on ${loc.attributes.locale}...`);
    const r = await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, token, {
      data: {
        type: 'appStoreVersionLocalizations',
        id: loc.id,
        attributes: {
          supportUrl: NEW_SUPPORT_URL,
          marketingUrl: NEW_MARKETING_URL,
        },
      },
    });
    console.log(`    -> ${r.status} ${r.status >= 200 && r.status < 300 ? 'OK' : JSON.stringify(r.body).substring(0, 200)}`);
  }

  console.log('\nDONE.');
  console.log(`Privacy Policy URL  -> ${NEW_PRIVACY_URL}`);
  console.log(`Support URL         -> ${NEW_SUPPORT_URL}`);
  console.log(`Marketing URL       -> ${NEW_MARKETING_URL}`);
  console.log('\nNo Apple review needed — these are metadata-only changes.');
})();
