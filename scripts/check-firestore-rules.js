#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// PERMANENT FIX for "missing Firestore rule crashes app" bug class.
//
// Scans every app's App.js for `.collection('X')` calls and compares against
// `match /X/` blocks in firestore.rules. If any collection used by code is
// not allowed by rules, the script prints clear errors and exits non-zero.
//
// USAGE:
//   node scripts/check-firestore-rules.js
//
// Run this before every deploy. If you add this to package.json as a "predeploy"
// or "prebuild" script, it becomes mandatory — never ship with missing rules.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Apps to scan (relative to "My Business" folder)
const APPS = [
  { name: 'Customer',     dir: '../../Vega-app' },
  { name: 'Worker',       dir: '../../VEGA-Worker-App' },
  { name: 'HubManager',   dir: '../../VEGA-HubManager-App' },
  { name: 'Admin',        dir: '../../Vega-admin' },
];

// The single source of truth — only one firestore.rules file is deployed
const RULES_PATH = path.join(__dirname, '..', 'firestore.rules');

// Whitelist of collections that are intentionally NOT in rules
// (e.g. created on-the-fly by Cloud Functions only, or wildcards)
const KNOWN_OK = new Set([
  // Add collection names here if rules use a wildcard pattern that covers them
]);

const colorize = (s, code) => `\x1b[${code}m${s}\x1b[0m`;
const red    = s => colorize(s, '31');
const green  = s => colorize(s, '32');
const yellow = s => colorize(s, '33');
const dim    = s => colorize(s, '90');

function extractCollectionsFromCode(appJsPath) {
  if (!fs.existsSync(appJsPath)) return [];
  const src = fs.readFileSync(appJsPath, 'utf8');
  const regex = /\.collection\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const set = new Set();
  let m;
  while ((m = regex.exec(src))) set.add(m[1]);
  return [...set].sort();
}

function extractAllowedCollectionsFromRules(rulesPath) {
  if (!fs.existsSync(rulesPath)) {
    console.error(red('ERROR: firestore.rules not found at ' + rulesPath));
    process.exit(2);
  }
  const src = fs.readFileSync(rulesPath, 'utf8');
  // Capture first path segment after `match /...` — handles both top-level
  // collections and subcollections (we record the parent collection name).
  // Also captures subcollections like `match /users/{x}/addresses/{y}` —
  // we want BOTH `users` AND `addresses` recorded as allowed.
  const set = new Set();
  // Top-level path segments: `/users/{userId}` → users
  const segmentRegex = /\/([a-zA-Z_][a-zA-Z0-9_]*)\//g;
  let m;
  while ((m = segmentRegex.exec(src))) set.add(m[1]);
  // Also catch the final path segment if no trailing /: `/users {` would be weird but cover it
  const tailRegex = /match\s+\/([a-zA-Z_][a-zA-Z0-9_]*)\s*\/[^{]*\{/g;
  while ((m = tailRegex.exec(src))) set.add(m[1]);
  // Strip Firestore root names that aren't actual collections
  set.delete('databases');
  set.delete('documents');
  return set;
}

function main() {
  console.log(dim('━'.repeat(70)));
  console.log(' Firestore Rules vs Code — Coverage Check');
  console.log(dim('━'.repeat(70)));

  const allowed = extractAllowedCollectionsFromRules(RULES_PATH);
  console.log(`${dim('Rules allow:')} ${[...allowed].sort().join(', ')}`);
  console.log();

  let totalMissing = 0;

  for (const app of APPS) {
    const appJs = path.join(__dirname, app.dir, 'App.js');
    const used = extractCollectionsFromCode(appJs);
    const missing = used.filter(c => !allowed.has(c) && !KNOWN_OK.has(c));

    if (used.length === 0) {
      console.log(`${yellow('?')} ${app.name.padEnd(12)} ${dim('(App.js not found)')}`);
      continue;
    }

    if (missing.length === 0) {
      console.log(`${green('✓')} ${app.name.padEnd(12)} ${dim('uses:')} ${used.join(', ')}`);
    } else {
      console.log(`${red('✗')} ${app.name.padEnd(12)} ${red('MISSING in rules:')} ${red(missing.join(', '))}`);
      console.log(`  ${dim('all used:')} ${used.join(', ')}`);
      totalMissing += missing.length;
    }
  }

  console.log();
  console.log(dim('━'.repeat(70)));

  if (totalMissing > 0) {
    console.log(red(`✗ ${totalMissing} collection(s) used by code but missing from firestore.rules`));
    console.log(red('  → App WILL crash for those collections (permission denied)'));
    console.log(red('  → Fix firestore.rules then re-run this check'));
    process.exit(1);
  } else {
    console.log(green('✓ All collections used by code are covered by firestore.rules'));
    process.exit(0);
  }
}

main();
