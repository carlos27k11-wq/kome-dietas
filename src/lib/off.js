/* ============================================================
   Open Food Facts — base de datos abierta de alimentos.
   Priorizamos el índice español y normalizamos a "por 100 g".
   ============================================================ */

const UA = "kome-dietas-familia/1.0 (app familiar)";
const FIELDS = [
  "code", "product_name", "product_name_es", "brands", "quantity",
  "serving_size", "serving_quantity", "image_front_small_url", "image_small_url",
  "nutriments", "nutriscore_grade", "nova_group", "categories_tags",
].join(",");

function num(v) {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? +n.toFixed(2) : null;
}

export function normalizeOFF(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  const name = (p.product_name_es || p.product_name || "").trim();
  if (!name) return null;

  // kcal por 100 g; algunos productos solo traen kJ
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && n["energy_100g"]) kcal = num(Number(n["energy_100g"]) / 4.184);

  const protein = num(n.proteins_100g) ?? 0;
  const carbs = num(n.carbohydrates_100g) ?? 0;
  const fat = num(n.fat_100g) ?? 0;
  if (kcal == null) kcal = +(protein * 4 + carbs * 4 + fat * 9).toFixed(1);
  if (!kcal && !protein && !carbs && !fat) return null;

  // sodio: OFF da sodium en g -> pasamos a mg
  let sodium = num(n.sodium_100g);
  if (sodium != null) sodium = +(sodium * 1000).toFixed(0);
  else if (n.salt_100g != null) sodium = +(Number(n.salt_100g) * 400).toFixed(0);

  return {
    name,
    brand: (p.brands || "").split(",")[0]?.trim() || null,
    barcode: p.code || null,
    source: "off",
    off_id: p.code || null,
    kcal_100: kcal,
    protein_100: protein,
    carbs_100: carbs,
    fat_100: fat,
    fiber_100: num(n.fiber_100g),
    sugars_100: num(n.sugars_100g),
    sat_fat_100: num(n["saturated-fat_100g"]),
    sodium_100: sodium,
    default_serving_g: num(p.serving_quantity) || 100,
    serving_name: p.serving_size || null,
    image_url: p.image_front_small_url || p.image_small_url || null,
    nutriscore: p.nutriscore_grade && p.nutriscore_grade.length === 1 ? p.nutriscore_grade.toUpperCase() : null,
    nova: p.nova_group || null,
  };
}

export async function searchOFF(query, { signal, page = 1 } = {}) {
  if (!query || query.trim().length < 2) return [];
  const url =
    `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=24&page=${page}&fields=${FIELDS}`;
  const res = await fetch(url, { signal, headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("No se pudo consultar Open Food Facts");
  const data = await res.json();
  return (data.products || []).map(normalizeOFF).filter(Boolean);
}

export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 1) return null;
  return normalizeOFF(data.product);
}

export const NUTRISCORE_COLOR = {
  A: "#1e8f4e", B: "#7cb342", C: "#f0c069", D: "#e5875e", E: "#d9534f",
};
