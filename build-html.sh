#!/bin/bash
# Regenera kome.html (un solo archivo) a partir del código de src/
set -e
cd "$(dirname "$0")"
URL="${VITE_SUPABASE_URL:-https://qznmsqubnavzgyrnfgfr.supabase.co}"
KEY="${VITE_SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bm1zcXVibmF2emd5cm5mZ2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzczODAsImV4cCI6MjEwMjY1MzM4MH0.IzYC2lsRK-CH2eYhTOAEhjL1NyhDsftGGnDU8pv4g44}"
npx esbuild _vendor.js --bundle --format=iife --minify --target=es2019 \
  --define:process.env.NODE_ENV='"production"' --outfile=.tmp-vendor.js --log-level=warning
npx esbuild _single.jsx --bundle --format=iife --jsx=transform --target=es2019 \
  --external:react --external:react-dom/client --external:@supabase/supabase-js --external:html5-qrcode \
  --define:import.meta.env="{\"VITE_SUPABASE_URL\":\"$URL\",\"VITE_SUPABASE_ANON_KEY\":\"$KEY\"}" \
  --outfile=.tmp-app.js --log-level=warning
node build-html.mjs "$URL" "$KEY"
rm -f .tmp-vendor.js .tmp-app.js
echo "→ kome.html listo"
