#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PERMANENT FIX for "iOS native crash on missing Info.plist permission" bug.
//
// iOS force-crashes any app that calls Location / Camera / Photos / Mic APIs
// without the corresponding NSXxxUsageDescription key in Info.plist.
//
// This script scans each app's App.js for usage of those APIs, then checks
// that the matching infoPlist key exists in app.json. Mismatches → exit 1.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const APPS = [
  { name: 'Customer',   dir: '../../Vega-app' },
  { name: 'Worker',     dir: '../../VEGA-Worker-App' },
  { name: 'HubManager', dir: '../../VEGA-HubManager-App' },
  { name: 'Admin',      dir: '../../Vega-admin' },
];

// Each API pattern → required Info.plist key
const REQUIREMENTS = [
  { api: /\bLocation\./,                key: 'NSLocationWhenInUseUsageDescription', name: 'Location' },
  { api: /\bImagePicker\b|launchCamera/, key: 'NSCameraUsageDescription',           name: 'Camera' },
  { api: /\bImagePicker\b|launchImageLibrary/, key: 'NSPhotoLibraryUsageDescription', name: 'Photo Library' },
  { api: /\bAudio\.Recording|expo-av/,  key: 'NSMicrophoneUsageDescription',        name: 'Microphone' },
  { api: /\bContacts\./,                key: 'NSContactsUsageDescription',          name: 'Contacts' },
  { api: /\bCalendar\./,                key: 'NSCalendarsUsageDescription',         name: 'Calendar' },
];

const red    = s => `\x1b[31m${s}\x1b[0m`;
const green  = s => `\x1b[32m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const dim    = s => `\x1b[90m${s}\x1b[0m`;

function main() {
  console.log(dim('━'.repeat(70)));
  console.log(' iOS Info.plist Permissions vs Code — Coverage Check');
  console.log(dim('━'.repeat(70)));

  let totalMissing = 0;
  for (const app of APPS) {
    const appJsPath  = path.join(__dirname, app.dir, 'App.js');
    const appJsonPath = path.join(__dirname, app.dir, 'app.json');
    if (!fs.existsSync(appJsPath) || !fs.existsSync(appJsonPath)) {
      console.log(`${yellow('?')} ${app.name.padEnd(12)} ${dim('(missing files)')}`);
      continue;
    }
    const code = fs.readFileSync(appJsPath, 'utf8');
    const cfg  = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const infoPlist = cfg.expo?.ios?.infoPlist || {};

    const needed = REQUIREMENTS.filter(r => r.api.test(code));
    const missing = needed.filter(r => !infoPlist[r.key]);

    if (needed.length === 0) {
      console.log(`${green('✓')} ${app.name.padEnd(12)} ${dim('uses no permission-gated APIs')}`);
    } else if (missing.length === 0) {
      const list = needed.map(r => r.name).join(', ');
      console.log(`${green('✓')} ${app.name.padEnd(12)} ${dim('uses:')} ${list} ${dim('— all permission strings present')}`);
    } else {
      console.log(`${red('✗')} ${app.name.padEnd(12)} ${red('MISSING Info.plist keys (iOS WILL CRASH):')}`);
      missing.forEach(r => {
        console.log(`    ${red('•')} ${r.key} ${dim('(required for ' + r.name + ' API)')}`);
      });
      totalMissing += missing.length;
    }
  }

  console.log();
  console.log(dim('━'.repeat(70)));
  if (totalMissing > 0) {
    console.log(red(`✗ ${totalMissing} required Info.plist key(s) missing`));
    console.log(red('  → iOS will native-crash the app when these APIs are called'));
    console.log(red('  → Add the missing keys to app.json under expo.ios.infoPlist'));
    process.exit(1);
  } else {
    console.log(green('✓ All apps have required Info.plist permission strings'));
    process.exit(0);
  }
}

main();
