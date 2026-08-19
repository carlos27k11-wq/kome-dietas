import { supabase } from "./supabase";
import { isoDate, shiftDate } from "./nutrition";

/* ---------------- perfiles ---------------- */

export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles").select("*").order("sort_order").order("created_at");
  if (error) throw error;
  return data;
}

export async function createProfile(p) {
  const { data, error } = await supabase.from("profiles").insert(p).select().single();
  if (error) throw error;
  return data;
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProfile(id) {
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- alimentos ---------------- */

export async function searchFoods(q, limit = 30) {
  let qb = supabase.from("foods").select("*").limit(limit);
  if (q && q.trim()) qb = qb.ilike("name", `%${q.trim()}%`);
  const { data, error } = await qb.order("times_used", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function recentFoods(limit = 12) {
  const { data, error } = await supabase
    .from("foods").select("*").order("times_used", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []).filter((f) => f.times_used > 0);
}

export async function findFoodByBarcode(code) {
  const { data, error } = await supabase.from("foods").select("*").eq("barcode", code).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveFood(food) {
  if (food.barcode) {
    const existing = await findFoodByBarcode(food.barcode);
    if (existing) return existing;
  }
  const { data, error } = await supabase.from("foods").insert(food).select().single();
  if (error) throw error;
  return data;
}

export async function bumpFood(id) {
  const { data } = await supabase.from("foods").select("times_used").eq("id", id).maybeSingle();
  if (data) await supabase.from("foods").update({ times_used: (data.times_used || 0) + 1 }).eq("id", id);
}

export async function updateFood(id, patch) {
  const { data, error } = await supabase.from("foods").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFood(id) {
  const { error } = await supabase.from("foods").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- recetas ---------------- */

export async function listRecipes() {
  const { data, error } = await supabase
    .from("recipes").select("*").order("is_favorite", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRecipeIngredients(recipeId) {
  const { data, error } = await supabase
    .from("recipe_ingredients").select("*").eq("recipe_id", recipeId).order("position");
  if (error) throw error;
  return data;
}

export async function saveRecipe(recipe, ingredients) {
  let row;
  if (recipe.id) {
    const { data, error } = await supabase.from("recipes").update(recipe).eq("id", recipe.id).select().single();
    if (error) throw error;
    row = data;
    await supabase.from("recipe_ingredients").delete().eq("recipe_id", row.id);
  } else {
    const { data, error } = await supabase.from("recipes").insert(recipe).select().single();
    if (error) throw error;
    row = data;
  }
  if (ingredients?.length) {
    const payload = ingredients.map((ing, i) => ({
      recipe_id: row.id,
      food_id: ing.food_id || null,
      name: ing.name,
      grams: ing.grams,
      kcal: ing.kcal, protein: ing.protein, carbs: ing.carbs, fat: ing.fat,
      fiber: ing.fiber || 0, sugars: ing.sugars || 0, sat_fat: ing.sat_fat || 0, sodium: ing.sodium || 0,
      position: i,
    }));
    const { error } = await supabase.from("recipe_ingredients").insert(payload);
    if (error) throw error;
  }
  return row;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleRecipeFavorite(id, value) {
  await supabase.from("recipes").update({ is_favorite: value }).eq("id", id);
}

/* ---------------- diario ---------------- */

export async function getDay(profileId, date) {
  const { data, error } = await supabase
    .from("diary_entries").select("*").eq("profile_id", profileId).eq("date", date)
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function addEntries(rows) {
  const { data, error } = await supabase.from("diary_entries").insert(rows).select();
  if (error) throw error;
  return data;
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase.from("diary_entries").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from("diary_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function copyDay(profileId, fromDate, toDate, meal = null) {
  const rows = await getDay(profileId, fromDate);
  const filtered = meal ? rows.filter((r) => r.meal === meal) : rows;
  if (!filtered.length) return [];
  const payload = filtered.map(({ id, created_at, date, ...rest }) => ({ ...rest, date: toDate }));
  return addEntries(payload);
}

/* ---------------- histórico ---------------- */

export async function getRange(profileId, fromDate, toDate) {
  const { data, error } = await supabase
    .from("daily_totals").select("*")
    .eq("profile_id", profileId).gte("date", fromDate).lte("date", toDate)
    .order("date");
  if (error) throw error;
  return data;
}

/** Serie continua de días (rellena huecos con ceros) */
export async function getSeries(profileId, days = 7, endDate = isoDate()) {
  const start = shiftDate(endDate, -(days - 1));
  const rows = await getRange(profileId, start, endDate);
  const byDate = Object.fromEntries(rows.map((r) => [r.date, r]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = shiftDate(start, i);
    out.push(byDate[d] || { date: d, kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, sat_fat: 0, sodium: 0, items: 0 });
  }
  return out;
}

/* ---------------- agua y peso ---------------- */

export async function getWater(profileId, date) {
  const { data, error } = await supabase
    .from("water_logs").select("ml").eq("profile_id", profileId).eq("date", date);
  if (error) throw error;
  return (data || []).reduce((a, r) => a + (r.ml || 0), 0);
}

export async function addWater(profileId, date, ml) {
  const { error } = await supabase.from("water_logs").insert({ profile_id: profileId, date, ml });
  if (error) throw error;
}

export async function resetWater(profileId, date) {
  await supabase.from("water_logs").delete().eq("profile_id", profileId).eq("date", date);
}

export async function listWeights(profileId, limit = 90) {
  const { data, error } = await supabase
    .from("weight_logs").select("*").eq("profile_id", profileId).order("date", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function saveWeight(profileId, date, weight_kg, note = null) {
  const { data, error } = await supabase
    .from("weight_logs").upsert({ profile_id: profileId, date, weight_kg, note }, { onConflict: "profile_id,date" })
    .select().single();
  if (error) throw error;
  await supabase.from("profiles").update({ weight_kg }).eq("id", profileId);
  return data;
}

export async function deleteWeight(id) {
  await supabase.from("weight_logs").delete().eq("id", id);
}

/* ---------------- pasos ---------------- */

export async function getSteps(profileId, date) {
  const { data, error } = await supabase
    .from("step_logs").select("steps").eq("profile_id", profileId).eq("date", date).maybeSingle();
  if (error) throw error;
  return data?.steps || 0;
}

export async function setSteps(profileId, date, steps) {
  const value = Math.max(0, Math.round(steps));
  const { error } = await supabase
    .from("step_logs").upsert({ profile_id: profileId, date, steps: value }, { onConflict: "profile_id,date" });
  if (error) throw error;
  return value;
}

/* ---------------- series de agua y pasos ---------------- */

async function seriesFromView(view, field, profileId, days, endDate) {
  const start = shiftDate(endDate, -(days - 1));
  const { data, error } = await supabase
    .from(view).select("*").eq("profile_id", profileId).gte("date", start).lte("date", endDate);
  if (error) throw error;
  const byDate = Object.fromEntries((data || []).map((r) => [r.date, r[field]]));
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = shiftDate(start, i);
    out.push({ date: d, [field]: byDate[d] || 0 });
  }
  return out;
}

export function getWaterSeries(profileId, days = 7, endDate = isoDate()) {
  return seriesFromView("daily_water", "ml", profileId, days, endDate);
}

export function getStepsSeries(profileId, days = 7, endDate = isoDate()) {
  return seriesFromView("daily_steps", "steps", profileId, days, endDate);
}

/* ---------------- planificación semanal ---------------- */

export async function getPlan(fromDate, toDate) {
  const { data, error } = await supabase
    .from("meal_plan").select("*").gte("date", fromDate).lte("date", toDate).order("position");
  if (error) throw error;
  return data;
}

export async function addPlanItem(item) {
  const { data, error } = await supabase.from("meal_plan").insert(item).select().single();
  if (error) throw error;
  return data;
}

export async function deletePlanItem(id) {
  const { error } = await supabase.from("meal_plan").delete().eq("id", id);
  if (error) throw error;
}

/** Copia la planificación de una semana a la siguiente */
export async function copyWeek(fromMonday, toMonday) {
  const rows = await getPlan(fromMonday, shiftDate(fromMonday, 6));
  if (!rows.length) return [];
  const offset = (new Date(toMonday + "T12:00:00") - new Date(fromMonday + "T12:00:00")) / 86400000;
  const payload = rows.map(({ id, created_at, date, ...rest }) => ({ ...rest, date: shiftDate(date, Math.round(offset)) }));
  const { data, error } = await supabase.from("meal_plan").insert(payload).select();
  if (error) throw error;
  return data;
}

/* ---------------- lista de la compra ---------------- */

export async function listShopping() {
  const { data, error } = await supabase
    .from("shopping_items").select("*").order("done").order("created_at");
  if (error) throw error;
  return data;
}

/** Alta en bloque: [{ text, qty }] */
export async function addShoppingItems(rows, profileId) {
  if (!rows?.length) return [];
  const payload = rows.map((r) => ({
    text: (r.text || "").trim(),
    qty: r.qty || null,
    added_by: profileId || null,
  })).filter((r) => r.text);
  const { data, error } = await supabase.from("shopping_items").insert(payload).select();
  if (error) throw error;
  return data;
}

/** Ingredientes de una receta, listos para la lista de la compra */
export async function recipeShoppingRows(recipeId) {
  const ings = await getRecipeIngredients(recipeId);
  return ings.map((i) => ({ text: i.name, qty: fmtGrams(i.grams) }));
}

/** Ingredientes sumados de todas las recetas planificadas en un rango */
export async function planIngredients(fromDate, toDate) {
  const plan = await getPlan(fromDate, toDate);
  const ids = [...new Set(plan.map((p) => p.recipe_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from("recipe_ingredients").select("*").in("recipe_id", ids);
  if (error) throw error;
  const times = {};
  plan.forEach((p) => { if (p.recipe_id) times[p.recipe_id] = (times[p.recipe_id] || 0) + 1; });
  const acc = {};
  (data || []).forEach((ing) => {
    const n = times[ing.recipe_id] || 1;
    const key = ing.name.trim().toLowerCase();
    acc[key] = acc[key] || { text: ing.name.trim(), grams: 0 };
    acc[key].grams += (Number(ing.grams) || 0) * n;
  });
  return Object.values(acc)
    .sort((a, b) => b.grams - a.grams)
    .map((x) => ({ text: x.text, qty: fmtGrams(x.grams) }));
}

export function fmtGrams(g) {
  const n = Number(g) || 0;
  if (!n) return null;
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} kg` : `${Math.round(n)} g`;
}

export async function addShoppingItem(text, profileId) {
  const { data, error } = await supabase
    .from("shopping_items").insert({ text: text.trim(), added_by: profileId || null }).select().single();
  if (error) throw error;
  return data;
}

export async function toggleShoppingItem(id, done) {
  const { error } = await supabase.from("shopping_items").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteShoppingItem(id) {
  const { error } = await supabase.from("shopping_items").delete().eq("id", id);
  if (error) throw error;
}

export async function clearDoneShopping() {
  const { error } = await supabase.from("shopping_items").delete().eq("done", true);
  if (error) throw error;
}
