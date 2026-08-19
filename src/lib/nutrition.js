/* ============================================================
   Motor de nutrición
   Referencias usadas:
   - Gasto en reposo: Mifflin-St Jeor (1990), el más fiable en
     población general sin composición corporal medida.
   - Factores de actividad: PAL clásicos (FAO/OMS/UNU).
   - Proteína: 1,6–2,2 g/kg cubre síntesis proteica máxima; se
     sube en déficit para proteger masa magra (Helms et al.).
   - Grasa: mínimo ~0,6 g/kg para hormonas y vitaminas liposolubles.
   - Fibra: 14 g por cada 1.000 kcal (recomendación IOM).
   - Azúcares libres: <10% de la energía (OMS).
   - Grasa saturada: <10% de la energía (OMS/EFSA).
   - Sodio: <2.000 mg/día (OMS) = 5 g de sal.
   ============================================================ */

export const ACTIVITY = {
  sedentario: { f: 1.2, label: "Sedentario", hint: "Oficina, poco movimiento" },
  ligero: { f: 1.375, label: "Ligero", hint: "1-3 entrenos/semana o mucho andar" },
  moderado: { f: 1.55, label: "Moderado", hint: "3-5 entrenos/semana" },
  activo: { f: 1.725, label: "Activo", hint: "6-7 entrenos/semana" },
  muy_activo: { f: 1.9, label: "Muy activo", hint: "Trabajo físico + entreno diario" },
};

export const GOALS = {
  perder_rapido: { adj: -0.22, label: "Perder rápido", kg: -0.7, warn: "Ritmo agresivo: solo sostenible unas semanas." },
  perder: { adj: -0.15, label: "Perder peso", kg: -0.45, warn: null },
  mantener: { adj: 0, label: "Mantener", kg: 0, warn: null },
  ganar: { adj: 0.1, label: "Ganar músculo", kg: 0.25, warn: null },
  ganar_rapido: { adj: 0.18, label: "Ganar rápido", kg: 0.45, warn: "Parte del peso ganado será grasa." },
};

export const MEALS = [
  { key: "desayuno", label: "Desayuno", jp: "朝", emoji: "🍞" },
  { key: "comida", label: "Comida", jp: "昼", emoji: "🍚" },
  { key: "merienda", label: "Merienda", jp: "間", emoji: "🍡" },
  { key: "cena", label: "Cena", jp: "夜", emoji: "🍜" },
  { key: "snack", label: "Extra", jp: "他", emoji: "🍫" },
];

export const MACROS = [
  { key: "protein", label: "Proteína", short: "P", kcal: 4, color: "var(--sakura)" },
  { key: "carbs", label: "Carbos", short: "C", kcal: 4, color: "var(--lantern)" },
  { key: "fat", label: "Grasa", short: "G", kcal: 9, color: "var(--mizu)" },
];

export function ageFrom(birth) {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b)) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

/** Metabolismo basal — Mifflin-St Jeor */
export function bmr({ sex, weight_kg, height_cm, age }) {
  if (!weight_kg || !height_cm || age == null) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return Math.round(sex === "m" ? base + 5 : base - 161);
}

/** Gasto total estimado */
export function tdee(profile) {
  const b = bmr({
    sex: profile.sex,
    weight_kg: Number(profile.weight_kg),
    height_cm: Number(profile.height_cm),
    age: ageFrom(profile.birth_date),
  });
  if (!b) return null;
  const f = (ACTIVITY[profile.activity_level] || ACTIVITY.ligero).f;
  return { bmr: b, tdee: Math.round(b * f), factor: f };
}

/**
 * Objetivos del día. Si el perfil tiene auto_targets, se calculan;
 * si no, se usan los valores que la persona haya fijado a mano.
 */
export function targetsFor(profile) {
  if (!profile) return { kcal: 2000, protein: 130, carbs: 220, fat: 65, fiber: 30, auto: false };

  const manual = {
    kcal: profile.kcal_goal || 2000,
    protein: profile.protein_goal || 130,
    carbs: profile.carbs_goal || 220,
    fat: profile.fat_goal || 65,
    fiber: profile.fiber_goal || 30,
    auto: false,
    notes: [],
  };

  const t = tdee(profile);
  if (!profile.auto_targets || !t) return manual;

  const kg = Number(profile.weight_kg);
  const goal = GOALS[profile.goal] || GOALS.mantener;
  let kcal = Math.round(t.tdee * (1 + goal.adj));
  const notes = [];

  // suelos de seguridad: nunca por debajo del metabolismo basal ni de
  // 1.500 (hombres) / 1.200 (mujeres) kcal
  const floor = Math.max(t.bmr, profile.sex === "m" ? 1500 : 1200);
  if (kcal < floor) {
    kcal = floor;
    notes.push("Ajustado al mínimo seguro: no baja de tu metabolismo basal.");
  }

  // proteína: se sube automáticamente en déficit
  let pkg = Number(profile.protein_per_kg) || 1.8;
  if (goal.adj < 0) pkg = Math.max(pkg, 2.0);
  let protein = Math.round(kg * pkg);

  let fat = Math.round(kg * (Number(profile.fat_per_kg) || 0.9));
  const fatFloor = Math.round(kg * 0.6);
  if (fat < fatFloor) { fat = fatFloor; notes.push("Grasa subida al mínimo hormonal (0,6 g/kg)."); }

  let carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
  if (carbs < 60) {
    // reequilibrar: recortar grasa antes que proteína
    const deficit = (60 - carbs) * 4;
    fat = Math.max(fatFloor, Math.round(fat - deficit / 9));
    carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
    notes.push("Reequilibrado para dejar carbohidrato suficiente.");
  }
  if (carbs < 0) carbs = 0;

  const fiber = Math.round((kcal / 1000) * 14);

  return {
    kcal, protein, carbs, fat, fiber,
    auto: true,
    bmr: t.bmr, tdee: t.tdee, factor: t.factor,
    sugarsMax: Math.round((kcal * 0.10) / 4),
    satFatMax: Math.round((kcal * 0.10) / 9),
    sodiumMax: 2000,
    proteinPerKg: kg ? +(protein / kg).toFixed(2) : null,
    goalLabel: goal.label,
    weeklyKg: goal.kg,
    warn: goal.warn,
    notes,
  };
}

/** Reparto de kcal por comida a partir del meal_split del perfil */
export function mealTargets(profile, kcal) {
  const split = profile?.meal_split || { desayuno: 0.25, comida: 0.35, merienda: 0.1, cena: 0.3, snack: 0 };
  const out = {};
  MEALS.forEach((m) => { out[m.key] = Math.round((split[m.key] ?? 0) * kcal); });
  return out;
}

/** Escala macros de un alimento (valores por 100 g) a X gramos */
export function scaleFood(food, grams) {
  const k = (grams || 0) / 100;
  const n = (v) => +(((Number(v) || 0) * k)).toFixed(1);
  return {
    kcal: n(food.kcal_100),
    protein: n(food.protein_100),
    carbs: n(food.carbs_100),
    fat: n(food.fat_100),
    fiber: n(food.fiber_100),
    sugars: n(food.sugars_100),
    sat_fat: n(food.sat_fat_100),
    sodium: n(food.sodium_100),
  };
}

export function scaleRecipe(recipe, servings) {
  const k = servings || 1;
  const n = (v) => +(((Number(v) || 0) * k)).toFixed(1);
  return {
    kcal: n(recipe.kcal), protein: n(recipe.protein), carbs: n(recipe.carbs),
    fat: n(recipe.fat), fiber: n(recipe.fiber), sugars: n(recipe.sugars),
    sat_fat: n(recipe.sat_fat), sodium: n(recipe.sodium),
  };
}

export const EMPTY_TOTALS = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, sat_fat: 0, sodium: 0 };

export function sumEntries(entries = []) {
  return entries.reduce((a, e) => {
    Object.keys(EMPTY_TOTALS).forEach((k) => { a[k] += Number(e[k]) || 0; });
    return a;
  }, { ...EMPTY_TOTALS });
}

/** Coherencia energética de un alimento: detecta datos raros de OFF */
export function energyCheck(f) {
  const calc = (f.protein_100 || 0) * 4 + (f.carbs_100 || 0) * 4 + (f.fat_100 || 0) * 9;
  const dec = Number(f.kcal_100) || 0;
  if (!dec || !calc) return null;
  const diff = Math.abs(calc - dec) / dec;
  return diff > 0.25 ? { calc: Math.round(calc), dec: Math.round(dec) } : null;
}

/**
 * Lectura experta del día: qué está bien y qué corregir.
 * Devuelve avisos ordenados por importancia.
 */
export function dayInsights(totals, targets, profile) {
  const out = [];
  const kg = Number(profile?.weight_kg) || null;
  const pct = (v, t) => (t ? v / t : 0);

  const kcalPct = pct(totals.kcal, targets.kcal);
  const protPct = pct(totals.protein, targets.protein);

  if (totals.kcal > 0) {
    if (kcalPct > 1.15)
      out.push({ tone: "warn", text: `Vas ${Math.round(totals.kcal - targets.kcal)} kcal por encima del objetivo.` });
    else if (kcalPct >= 0.9 && kcalPct <= 1.1)
      out.push({ tone: "good", text: "Energía dentro del rango objetivo." });
  }

  if (protPct < 0.8 && totals.kcal > targets.kcal * 0.6)
    out.push({ tone: "warn", text: `Falta proteína: ${Math.round(targets.protein - totals.protein)} g para llegar. Prueba lácteos, huevo, legumbre o pescado.` });
  else if (protPct >= 1)
    out.push({ tone: "good", text: kg ? `Proteína cubierta (${(totals.protein / kg).toFixed(1)} g/kg).` : "Proteína cubierta." });

  if (targets.fiber && totals.fiber < targets.fiber * 0.6 && totals.kcal > targets.kcal * 0.7)
    out.push({ tone: "warn", text: `Fibra baja (${Math.round(totals.fiber)} de ${targets.fiber} g). Suma verdura, fruta con piel o legumbre.` });
  else if (targets.fiber && totals.fiber >= targets.fiber)
    out.push({ tone: "good", text: "Fibra completa. Bien para saciedad y microbiota." });

  if (targets.satFatMax && totals.sat_fat > targets.satFatMax)
    out.push({ tone: "warn", text: `Grasa saturada por encima del 10% de la energía (${Math.round(totals.sat_fat)} g).` });

  if (targets.sugarsMax && totals.sugars > targets.sugarsMax)
    out.push({ tone: "warn", text: `Azúcares altos (${Math.round(totals.sugars)} g). El límite orientativo son ${targets.sugarsMax} g.` });

  if (totals.sodium > 2000)
    out.push({ tone: "warn", text: `Sodio elevado: ${Math.round(totals.sodium)} mg (~${(totals.sodium / 400).toFixed(1)} g de sal).` });

  return out;
}

/** Análisis semanal / mensual */
export function periodStats(days, targets) {
  const withFood = days.filter((d) => d.kcal > 0);
  if (!withFood.length) return null;
  const avg = (k) => Math.round(withFood.reduce((a, d) => a + (d[k] || 0), 0) / withFood.length);
  const onTarget = withFood.filter((d) => Math.abs(d.kcal - targets.kcal) <= targets.kcal * 0.1).length;
  const balance = withFood.reduce((a, d) => a + (d.kcal - targets.kcal), 0);
  return {
    days: withFood.length,
    kcal: avg("kcal"), protein: avg("protein"), carbs: avg("carbs"), fat: avg("fat"), fiber: avg("fiber"),
    adherence: Math.round((onTarget / withFood.length) * 100),
    balance: Math.round(balance),
    kgTrend: +(balance / 7700).toFixed(2), // 1 kg de grasa ≈ 7.700 kcal
  };
}

export function streakOf(days) {
  // días consecutivos con registro, terminando hoy o ayer
  const set = new Set(days.filter((d) => d.kcal > 0).map((d) => d.date));
  let n = 0;
  const d = new Date();
  if (!set.has(isoDate(d))) d.setDate(d.getDate() - 1);
  while (set.has(isoDate(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function isoDate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function shiftDate(iso, days) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function prettyDate(iso) {
  const today = isoDate();
  if (iso === today) return "Hoy";
  if (iso === shiftDate(today, -1)) return "Ayer";
  if (iso === shiftDate(today, 1)) return "Mañana";
  return new Date(iso + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" });
}

/** Distancia y gasto aproximado de los pasos del día */
export function stepsInfo(steps, kg) {
  const km = +((steps || 0) * 0.00072).toFixed(2); // zancada media 72 cm
  const kcal = kg ? Math.round(km * Number(kg) * 0.5) : null; // ~0,5 kcal por kg y km andando
  return { km, kcal };
}

/** Lunes de la semana a la que pertenece una fecha */
export function mondayOf(iso) {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return isoDate(d);
}

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
export const WEEKDAYS_JP = ["月", "火", "水", "木", "金", "土", "日"];
