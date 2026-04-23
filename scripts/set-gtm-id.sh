#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: bash scripts/set-gtm-id.sh GTM-XXXXXXX"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GTM_ID="$1"

if [[ ! "$GTM_ID" =~ ^GTM-[A-Z0-9]+$ ]]; then
  echo "Invalid GTM ID: $GTM_ID"
  exit 1
fi

for file in "$ROOT_DIR/index.html" "$ROOT_DIR/portal.html"; do
  perl -0pi -e "s/GTM-[A-Z0-9]+/$GTM_ID/g" "$file"
done

echo "Updated GTM ID to $GTM_ID in index.html and portal.html"
