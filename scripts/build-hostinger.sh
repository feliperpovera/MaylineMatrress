#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/deploy/hostinger"
ZIP_PATH="$ROOT_DIR/deploy/maylin-mattress-hostinger.zip"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

cp "$ROOT_DIR/index.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/portal.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/gracias.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/admin.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/en.html" "$OUTPUT_DIR/"
cp "$ROOT_DIR/styles.css" "$OUTPUT_DIR/"
cp "$ROOT_DIR/main.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/portal.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/storage.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/supabase.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/supabase-config.js" "$OUTPUT_DIR/"
cp "$ROOT_DIR/.htaccess" "$OUTPUT_DIR/"
cp "$ROOT_DIR/robots.txt" "$OUTPUT_DIR/"
cp "$ROOT_DIR/sitemap.xml" "$OUTPUT_DIR/"
cp "$ROOT_DIR/PRODUCT_IMAGE_SOURCES.md" "$OUTPUT_DIR/"
cp "$ROOT_DIR/README.md" "$OUTPUT_DIR/"
cp -R "$ROOT_DIR/assets" "$OUTPUT_DIR/"

mkdir -p "$OUTPUT_DIR/portal"
cp "$ROOT_DIR/portal.html" "$OUTPUT_DIR/portal/index.html"

mkdir -p "$OUTPUT_DIR/gracias"
cp "$ROOT_DIR/gracias.html" "$OUTPUT_DIR/gracias/index.html"

mkdir -p "$OUTPUT_DIR/admin"
cp "$ROOT_DIR/admin.html" "$OUTPUT_DIR/admin/index.html"

mkdir -p "$OUTPUT_DIR/en"
cp "$ROOT_DIR/en.html" "$OUTPUT_DIR/en/index.html"

find "$OUTPUT_DIR" -name '.DS_Store' -delete

# Ship only the optimized WebP assets (plus favicons and the social logo).
find "$OUTPUT_DIR/assets" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) \
  ! -path '*/favicons/*' ! -name 'maylin-mattress-logo.png' -delete

# Drop source media the site does not reference (raw video, archives).
find "$OUTPUT_DIR/assets" -type f \( -iname '*.mov' -o -iname '*.mp4' -o -iname '*.zip' -o -iname '*.heic' \) -delete
find "$OUTPUT_DIR/assets" -type d -empty -delete

mkdir -p "$ROOT_DIR/deploy"
rm -f "$ZIP_PATH"
cd "$OUTPUT_DIR"
zip -qr "$ZIP_PATH" .

echo "Hostinger bundle created at: $ZIP_PATH"
