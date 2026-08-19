import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Sheet } from "./ui";

// el lector de códigos pesa; se carga solo cuando hace falta
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));
import { searchOFF, lookupBarcode, NUTRISCORE_COLOR } from "../lib/off";
import { searchFoods, recentFoods, saveFood, bumpFood, findFoodByBarcode } from "../lib/store";
import { scaleFood, scaleRecipe, energyCheck, MEALS } from "../lib/nutrition";

const TABS = [
  { key: "buscar", label: "Buscar", jp: "探" },
  { key: "recetas", label: "Recetas", jp: "献" },
  { key: "escanear", label: "Escanear", jp: "码" },
  { key: "rapido", label: "Rápido", jp: "速" },
];

function Nutriscore({ grade }) {
  if (!grade) return null;
  return (
    <span className="tag" style={{ background: NUTRISCORE_COLOR[grade] || "var(--panel-2)", color: "#14121f", fontWeight: 700 }}>
      {grade}
    </span>
  );
}

function FoodRow({ food, onPick, badge }) {
  return (
    <button
      onClick={() => onPick(food)}
      className="px"
      style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", padding: 9, cursor: "pointer", marginBottom: 8, border: "var(--px) solid var(--line-soft)" }}
    >
      {food.image_url ? (
        <img src={food.image_url} alt="" width={40} height={40} style={{ objectFit: "cover", background: "var(--night)" }} loading="lazy" />
      ) : (
        <div style={{ width: 40, height: 40, background: "var(--night)", display: "grid", placeItems: "center", fontSize: 18 }}>🥄</div>
      )}
      <div className="grow">
        <div style={{ fontSize: 14, lineHeight: 1.25 }}>{food.name}</div>
        <div className="tiny dim" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {food.brand && <span>{food.brand}</span>}
          <span className="num">{Math.round(food.kcal_100)} kcal/100g</span>
          <Nutriscore grade={food.nutriscore} />
          {badge && <span className="tag">{badge}</span>}
        </div>
      </div>
      <span className="num" style={{ color: "var(--sakura)" }}>＋</span>
    </button>
  );
}

/* --------- editor de ración --------- */
function PortionEditor({ item, kind, meal, onCancel, onConfirm }) {
  const isRecipe = kind === "recipe";
  const [amount, setAmount] = useState(isRecipe ? 1 : Number(item.default_serving_g) || 100);
  const [mealKey, setMealKey] = useState(meal);
  const [busy, setBusy] = useState(false);

  const macros = isRecipe ? scaleRecipe(item, amount) : scaleFood(item, amount);
  const check = !isRecipe && energyCheck(item);

  const quick = isRecipe
    ? [0.5, 1, 1.5, 2]
    : [30, 50, 100, 150, 200, Number(item.default_serving_g) || 100]
        .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
        .sort((a, b) => a - b);

  async function confirm() {
    setBusy(true);
    try { await onConfirm({ amount, meal: mealKey, macros }); }
    finally { setBusy(false); }
  }

  return (
    <div className="stack">
      <div className="px" style={{ padding: 12 }}>
        <div className="row" style={{ gap: 10 }}>
          {(item.image_url || item.photo_url) && (
            <img src={item.image_url || item.photo_url} alt="" width={52} height={52} style={{ objectFit: "cover" }} />
          )}
          <div className="grow">
            <div style={{ fontFamily: "var(--font-display)" }}>{item.name}</div>
            <div className="tiny dim">
              {isRecipe ? `${Math.round(item.kcal)} kcal por ración` : `${Math.round(item.kcal_100)} kcal / 100 g`}
              {item.brand ? ` · ${item.brand}` : ""}
            </div>
          </div>
        </div>
      </div>

      <div className="field">
        <label>{isRecipe ? "Raciones" : "Cantidad en gramos"}</label>
        <div className="row">
          <input
            className="input num grow" type="number" inputMode="decimal" min="0"
            step={isRecipe ? 0.25 : 5}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          />
          <span className="dim num">{isRecipe ? "rac." : "g"}</span>
        </div>
        <div className="chips" style={{ marginTop: 6 }}>
          {quick.map((q) => (
            <button key={q} className="chip" data-on={amount === q} onClick={() => setAmount(q)}>
              {q}{isRecipe ? " rac." : " g"}
            </button>
          ))}
        </div>
        {!isRecipe && item.serving_name && (
          <div className="tiny dim">Ración del envase: {item.serving_name}</div>
        )}
      </div>

      <div className="field">
        <label>Comida</label>
        <div className="chips">
          {MEALS.map((m) => (
            <button key={m.key} className="chip" data-on={mealKey === m.key} onClick={() => setMealKey(m.key)}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px" style={{ padding: 12 }}>
        <div className="row-b">
          <span className="eyebrow">Aporta</span>
          <span className="num" style={{ fontSize: 22 }}>{Math.round(macros.kcal)} kcal</span>
        </div>
        <hr className="divider" />
        <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
          <span className="num tiny" style={{ color: "var(--sakura)" }}>P {macros.protein} g</span>
          <span className="num tiny" style={{ color: "var(--lantern)" }}>C {macros.carbs} g</span>
          <span className="num tiny" style={{ color: "var(--mizu)" }}>G {macros.fat} g</span>
          {macros.fiber > 0 && <span className="num tiny" style={{ color: "var(--matcha)" }}>F {macros.fiber} g</span>}
        </div>
        {check && (
          <p className="tiny" style={{ color: "var(--kaki)", marginBottom: 0 }}>
            Ojo: los macros suman {check.calc} kcal pero la etiqueta declara {check.dec}. Dato posiblemente incompleto.
          </p>
        )}
      </div>

      <div className="row">
        <button className="btn btn-ghost" onClick={onCancel}>Volver</button>
        <button className="btn btn-primary grow" disabled={busy || amount <= 0} onClick={confirm}>
          {busy ? "Guardando…" : "Añadir al diario"}
        </button>
      </div>
    </div>
  );
}

/* --------- alta rápida --------- */
function QuickAdd({ meal, onConfirm }) {
  const [f, setF] = useState({ name: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [mealKey, setMealKey] = useState(meal);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const kcalAuto = Math.round((Number(f.protein) || 0) * 4 + (Number(f.carbs) || 0) * 4 + (Number(f.fat) || 0) * 9);
  const ok = f.name.trim() && (Number(f.kcal) > 0 || kcalAuto > 0);

  return (
    <div className="stack">
      <p className="tiny dim">Para lo que no está en ninguna base: un plato de casa, un menú del día, lo que sea.</p>
      <div className="field">
        <label>Qué has comido</label>
        <input className="input" value={f.name} onChange={set("name")} placeholder="Lentejas de la abuela" />
      </div>
      <div className="row">
        <div className="field grow"><label>Proteína (g)</label><input className="input num" inputMode="decimal" value={f.protein} onChange={set("protein")} /></div>
        <div className="field grow"><label>Carbos (g)</label><input className="input num" inputMode="decimal" value={f.carbs} onChange={set("carbs")} /></div>
        <div className="field grow"><label>Grasa (g)</label><input className="input num" inputMode="decimal" value={f.fat} onChange={set("fat")} /></div>
      </div>
      <div className="field">
        <label>Kcal {kcalAuto > 0 && <span className="dim">— calculadas: {kcalAuto}</span>}</label>
        <input className="input num" inputMode="decimal" value={f.kcal} onChange={set("kcal")} placeholder={kcalAuto || "0"} />
      </div>
      <div className="field">
        <label>Comida</label>
        <div className="chips">
          {MEALS.map((m) => (
            <button key={m.key} className="chip" data-on={mealKey === m.key} onClick={() => setMealKey(m.key)}>{m.emoji} {m.label}</button>
          ))}
        </div>
      </div>
      <button
        className="btn btn-primary btn-block" disabled={!ok}
        onClick={() =>
          onConfirm({
            meal: mealKey,
            source_type: "quick",
            name: f.name.trim(),
            kcal: Number(f.kcal) || kcalAuto,
            protein: Number(f.protein) || 0,
            carbs: Number(f.carbs) || 0,
            fat: Number(f.fat) || 0,
          })
        }
      >
        Añadir al diario
      </button>
    </div>
  );
}

/* ============================================================ */
export default function AddSheet({ open, onClose, meal = "comida", recipes = [], profileId, onAdded }) {
  const [tab, setTab] = useState("buscar");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState([]);
  const [off, setOff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(null); // {item, kind}
  const [scanMsg, setScanMsg] = useState("");

  useEffect(() => {
    if (!open) { setPicked(null); setQ(""); setOff([]); setTab("buscar"); setScanMsg(""); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    recentFoods().then(setMine).catch(() => {});
  }, [open]);

  // búsqueda con retardo: primero lo nuestro, luego Open Food Facts
  useEffect(() => {
    if (!open || tab !== "buscar") return;
    const term = q.trim();
    if (term.length < 2) { setOff([]); recentFoods().then(setMine).catch(() => {}); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [local, remote] = await Promise.all([
          searchFoods(term).catch(() => []),
          searchOFF(term, { signal: ctrl.signal }).catch(() => []),
        ]);
        setMine(local);
        const localCodes = new Set(local.map((f) => f.barcode).filter(Boolean));
        setOff(remote.filter((r) => !localCodes.has(r.barcode)));
      } finally { setLoading(false); }
    }, 420);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, tab, open]);

  const addFood = useCallback(
    async ({ amount, meal: mealKey, macros }) => {
      let food = picked.item;
      if (!food.id) food = await saveFood(stripUi(food));
      else bumpFood(food.id).catch(() => {});
      await onAdded([{
        profile_id: profileId, meal: mealKey, source_type: "food", food_id: food.id,
        name: food.name + (food.brand ? ` · ${food.brand}` : ""), grams: amount, ...macros,
      }]);
      onClose();
    },
    [picked, profileId, onAdded, onClose]
  );

  const addRecipe = useCallback(
    async ({ amount, meal: mealKey, macros }) => {
      const r = picked.item;
      await onAdded([{
        profile_id: profileId, meal: mealKey, source_type: "recipe", recipe_id: r.id,
        name: r.name, servings: amount, ...macros,
      }]);
      onClose();
    },
    [picked, profileId, onAdded, onClose]
  );

  const onScan = useCallback(async (code) => {
    if (!code) return;
    setScanMsg("Buscando " + code + "…");
    try {
      const local = await findFoodByBarcode(code);
      if (local) { setPicked({ item: local, kind: "food" }); return; }
      const found = await lookupBarcode(code);
      if (found) setPicked({ item: found, kind: "food" });
      else setScanMsg(`El código ${code} no está en Open Food Facts. Añádelo con "Rápido" o créalo a mano.`);
    } catch {
      setScanMsg("Fallo al consultar el código. Prueba otra vez.");
    }
  }, []);

  const recipesByCat = useMemo(() => recipes, [recipes]);

  return (
    <Sheet open={open} onClose={onClose} title={picked ? "Ajusta la ración" : "Añadir al diario"} jp={picked ? "量" : "追加"}>
      {picked ? (
        <PortionEditor
          item={picked.item}
          kind={picked.kind}
          meal={meal}
          onCancel={() => setPicked(null)}
          onConfirm={picked.kind === "recipe" ? addRecipe : addFood}
        />
      ) : (
        <div className="stack">
          <div className="chips">
            {TABS.map((t) => (
              <button key={t.key} className="chip" data-on={tab === t.key} onClick={() => setTab(t.key)}>
                {t.jp} {t.label}
              </button>
            ))}
          </div>

          {tab === "buscar" && (
            <>
              <input
                className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Yogur griego, arroz, pechuga…"
              />
              {loading && <div className="tiny dim center blink">buscando…</div>}

              {mine.length > 0 && (
                <>
                  <div className="eyebrow">{q.trim().length < 2 ? "Lo que más usáis" : "En vuestra despensa"}</div>
                  {mine.map((f) => <FoodRow key={f.id} food={f} onPick={(x) => setPicked({ item: x, kind: "food" })} />)}
                </>
              )}

              {off.length > 0 && (
                <>
                  <div className="eyebrow">Open Food Facts</div>
                  {off.map((f, i) => (
                    <FoodRow key={f.barcode || i} food={f} badge="nuevo" onPick={(x) => setPicked({ item: x, kind: "food" })} />
                  ))}
                </>
              )}

              {!loading && q.trim().length >= 2 && !mine.length && !off.length && (
                <div className="empty tiny">Sin resultados. Créalo desde “Rápido”.</div>
              )}
            </>
          )}

          {tab === "recetas" && (
            <>
              {!recipesByCat.length && <div className="empty tiny">Todavía no hay recetas guardadas.</div>}
              {recipesByCat.map((r) => (
                <button
                  key={r.id} className="px"
                  onClick={() => setPicked({ item: r, kind: "recipe" })}
                  style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", padding: 9, marginBottom: 8, cursor: "pointer", border: "var(--px) solid var(--line-soft)" }}
                >
                  {r.photo_url
                    ? <img src={r.photo_url} alt="" width={44} height={44} style={{ objectFit: "cover" }} />
                    : <div style={{ width: 44, height: 44, background: "var(--night)", display: "grid", placeItems: "center" }}>🍱</div>}
                  <div className="grow">
                    <div style={{ fontSize: 14 }}>{r.name}</div>
                    <div className="tiny dim num">{Math.round(r.kcal)} kcal · P{Math.round(r.protein)} C{Math.round(r.carbs)} G{Math.round(r.fat)}</div>
                  </div>
                  <span className="num" style={{ color: "var(--sakura)" }}>＋</span>
                </button>
              ))}
            </>
          )}

          {tab === "escanear" && (
            <>
              <Suspense fallback={<div className="empty tiny blink">abriendo la cámara…</div>}>
                <BarcodeScanner onDetected={onScan} />
              </Suspense>
              {scanMsg && <p className="tiny" style={{ color: "var(--kaki)" }}>{scanMsg}</p>}
            </>
          )}

          {tab === "rapido" && (
            <QuickAdd
              meal={meal}
              onConfirm={async (row) => { await onAdded([{ profile_id: profileId, ...row }]); onClose(); }}
            />
          )}
        </div>
      )}
    </Sheet>
  );
}

/** quita campos que no existen en la tabla foods */
export function stripUi(f) {
  const { nutriscore, nova, ...rest } = f;
  return rest;
}
