/* ============================================================
   Catálogo de supermercado — Mercadona y Consum.

   Se baja de Open Food Facts (licencia ODbL) todo lo que hay de
   esas dos casas, se normaliza a "por 100 g" igual que hace la
   app y se deja en data/catalogo-es.json.

   Uso:  node scripts/catalogo.mjs
   ============================================================ */
import fs from "fs";

const BUSQUEDAS = [
  { q: "brands:hacendado", tienda: "Mercadona" },
  { q: "stores:mercadona", tienda: "Mercadona" },
  { q: "brands:consum", tienda: "Consum" },
  { q: "stores:consum", tienda: "Consum" },
];

const CAMPOS = [
  "code", "product_name", "product_name_es", "generic_name_es", "brands",
  "quantity", "serving_size", "serving_quantity", "stores", "categories_tags",
  "image_front_small_url", "image_small_url", "nutriments",
].join(",");

const PASO = 200;          // productos por página (el máximo cómodo)
const ESPERA = 400;        // ms entre peticiones, por educación
const TOPE = 10000;        // el buscador no deja pasar de ahí

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function pagina(q, page) {
  const url =
    `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}` +
    `&page_size=${PASO}&page=${page}&fields=${CAMPOS}`;
  const res = await fetch(url, { headers: { "User-Agent": "kome-dietas/1.0 (uso familiar)" } });
  if (!res.ok) throw new Error(`${res.status} en ${q} página ${page}`);
  return res.json();
}

/* --- de un producto de OFF a una fila de la despensa --- */
const num = (v) => {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? +n.toFixed(2) : null;
};

/* los nombres de OFF vienen con saltos de línea y códigos delante */
const limpiaNombre = (t) =>
  String(t || "").replace(/\s+/g, " ").replace(/^[0-9]{3,}[\s\-–:]*/, "").trim();

const limpiaMarca = (t) =>
  String(t || "").trim().toLowerCase()
    .replace(/(^|[\s\-'])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase()) || null;

function normalizar(p, tienda) {
  const n = p.nutriments || {};
  const nombre = limpiaNombre(p.product_name_es || p.product_name || p.generic_name_es);
  if (nombre.length < 2 || !p.code) return null;

  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && n["energy_100g"]) kcal = num(Number(n["energy_100g"]) / 4.184);

  const protein = num(n.proteins_100g) ?? 0;
  const carbs = num(n.carbohydrates_100g) ?? 0;
  const fat = num(n.fat_100g) ?? 0;
  if (kcal == null) kcal = +(protein * 4 + carbs * 4 + fat * 9).toFixed(1);
  if (!kcal && !protein && !carbs && !fat) return null;   // sin datos no sirve
  if (kcal > 950) return null;                            // eso no es comida

  let sodio = num(n.sodium_100g);
  if (sodio != null) sodio = +(sodio * 1000).toFixed(0);
  else if (n.salt_100g != null) sodio = +(Number(n.salt_100g) * 400).toFixed(0);

  // el buscador devuelve las marcas en lista, la API antigua en texto
  const marcas = Array.isArray(p.brands) ? p.brands : String(p.brands || "").split(",");
  const marca = limpiaMarca(marcas.map((m) => String(m).trim()).filter(Boolean)[0]);

  return {
    barcode: String(p.code),
    name: nombre.slice(0, 120),
    brand: marca,
    store: tienda,
    kcal_100: kcal,
    protein_100: protein,
    carbs_100: carbs,
    fat_100: fat,
    fiber_100: num(n.fiber_100g),
    sugars_100: num(n.sugars_100g),
    sat_fat_100: num(n["saturated-fat_100g"]),
    sodium_100: sodio,
    default_serving_g: num(p.serving_quantity) || 100,
    serving_name: p.serving_size || null,
    quantity: p.quantity || null,
    image_url: p.image_front_small_url || p.image_small_url || null,
  };
}

/* ---------------- a por ello ---------------- */
const porCodigo = new Map();
let vistos = 0;

for (const { q, tienda } of BUSQUEDAS) {
  const primera = await pagina(q, 1);
  const total = Math.min(primera.count || 0, TOPE);
  const paginas = Math.ceil(total / PASO);
  process.stdout.write(`\n${q}: ${primera.count} productos (${paginas} páginas)\n`);

  for (let page = 1; page <= paginas; page++) {
    const datos = page === 1 ? primera : await pagina(q, page);
    for (const hit of datos.hits || []) {
      vistos++;
      const fila = normalizar(hit, tienda);
      if (!fila) continue;
      // si ya lo teníamos, nos quedamos con la ficha más completa
      const previo = porCodigo.get(fila.barcode);
      const relleno = (f) => Object.values(f).filter((v) => v != null).length;
      if (!previo || relleno(fila) > relleno(previo)) porCodigo.set(fila.barcode, fila);
    }
    process.stdout.write(`  página ${page}/${paginas} → ${porCodigo.size} guardados\r`);
    if (page < paginas) await dormir(ESPERA);
  }
}

const catalogo = [...porCodigo.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
fs.mkdirSync("data", { recursive: true });
fs.writeFileSync("data/catalogo-es.json", JSON.stringify(catalogo, null, 0));

const porTienda = catalogo.reduce((a, f) => ({ ...a, [f.store]: (a[f.store] || 0) + 1 }), {});
console.log(`\n\nVistos ${vistos} productos, guardados ${catalogo.length}`);
console.log(porTienda);
console.log(`→ data/catalogo-es.json (${(fs.statSync("data/catalogo-es.json").size / 1e6).toFixed(1)} MB)`);
