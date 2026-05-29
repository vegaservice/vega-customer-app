#!/usr/bin/env bash
# VEGA OTA Rollback Script
# Reverts the latest OTA on both preview AND production channels to the previous version.
# Use when: customers report mass failures after an OTA push.
#
# Usage:
#   bash scripts/rollback-ota.sh
#
# Time to revert: ~30 seconds. Customers force-close + reopen → get prior version.

set -e

cd "$(dirname "$0")/.."

echo "🔄 Fetching last 2 updates on production branch..."
LAST_TWO=$(npx eas-cli update:list --branch production --limit 2 --non-interactive --json 2>/dev/null)
PREVIOUS=$(echo "$LAST_TWO" | node -e "
  let d = ''; process.stdin.on('data', c => d += c); process.stdin.on('end', () => {
    const arr = JSON.parse(d);
    if (arr.length < 2) { console.error('Not enough OTAs to roll back'); process.exit(1); }
    console.log(arr[1].id);  // arr[0] = current, arr[1] = previous
  });
")

if [ -z "$PREVIOUS" ]; then
  echo "❌ Could not determine previous OTA. Manual rollback needed."
  exit 1
fi

echo "Previous OTA ID: $PREVIOUS"
echo ""
read -p "Republish $PREVIOUS to BOTH preview and production? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Cancelled."
  exit 0
fi

echo "Rolling back preview..."
npx eas-cli update:republish --group "$PREVIOUS" --branch preview --message "ROLLBACK to previous OTA" --non-interactive

echo "Rolling back production..."
npx eas-cli update:republish --group "$PREVIOUS" --branch production --message "ROLLBACK to previous OTA" --non-interactive

echo ""
echo "✅ Rollback published to both channels."
echo "   Tell customers to force-close + reopen the app."
echo "   They will get the rolled-back version within ~30 seconds."
