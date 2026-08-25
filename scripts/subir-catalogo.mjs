/* Sube data/catalogo-es.json a la tabla catalog_foods de Supabase. */
import fs from "fs";
const URL_ = process.env.VITE_SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const filas = JSON.parse(fs.readFileSync("data/catalogo-es.json", "utf8"));
const LOTE = 500;
let subidas = 0;
for (let i = 0; i < filas.length; i += LOTE) {
  const trozo = filas.slice(i, i + LOTE);
  const res = await fetch(`${URL_}/rest/v1/catalog_foods?on_conflict=barcode`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(trozo),
  });
  if (!res.ok) { console.error(res.status, (await res.text()).slice(0, 300)); process.exit(1); }
  subidas += trozo.length;
  process.stdout.write(`  ${subidas}/${filas.length}\r`);
}
console.log(`\nsubidas ${subidas} filas`);
