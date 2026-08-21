import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet } from "../components/ui";
import { useTheme, Jp } from "../components/theme";
import {
  saveFood, saveRecipe, deleteRecipe, getRecipeIngredients,
  toggleRecipeFavorite, addShoppingItems, fmtGrams,
  searchFoods, recentFoods, findFoodByBarcode,
} from "../lib/store";
import { uploadRecipePhoto } from "../lib/supabase";
import { searchOFF, lookupBarcode } from "../lib/off";
import { scaleFood } from "../lib/nutrition";
import { stripUi } from "../components/AddSheet";
import { ManualFood } from "../components/FoodFinder";
import IngredientsTab from "./Ingredients";

// el lector de códigos pesa; solo se descarga cuando se abre la cámara
const BarcodeScanner = lazy(() => import("../components/BarcodeScanner"));

const CATS = [
  { key: "todas", label: "Todas", jp: "全" },
  { key: "desayuno", label: "Desayunos", jp: "朝" },
  { key: "comida", label: "Comidas", jp: "昼" },
  { key: "merienda", label: "Meriendas", jp: "間" },
  { key: "cena", label: "Cenas", jp: "夜" },
  { key: "snack", label: "Extras", jp: "他" },
];

const EMPTY = {
  name: "", category: "comida", photo_url: "", notes: "", steps: "",
  servings: 2, prep_min: "", tags: [], liked_by: [],
};

/* ============================================================
   Buscador de ingredientes para la receta.
   Dos formas de encontrar algo: escribiendo el nombre o
   apuntando con la cámara al código de barras. Busca primero
   en la despensa de casa y, si no está, en Open Food Facts.
   ============================================================ */
function IngredientRow({ f, badge, onPick }) {
  return (
    <button
      onClick={() => onPick(f)}
      className="px"
      style={{
        display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
        padding: 9, cursor: "pointer", marginBottom: 8, color: "inherit",
      }}
    >
      {f.image_url ? (
        <img src={f.image_url} alt="" width={40} height={40} style={{ objectFit: "cover", background: "var(--night)" }} loading="lazy" />
      ) : (
        <div style={{ width: 40, height: 40, background: "var(--night)", display: "grid", placeItems: "center", fontSize: 18 }}>🥄</div>
      )}
      <div className="grow">
        <div style={{ fontSize: 15, lineHeight: 1.25 }}>{f.name}</div>
        <div className="tiny dim">
          {f.brand ? `${f.brand} · ` : ""}<span className="num">{Math.round(f.kcal_100)} kcal/100 g</span>
          {badge ? ` · ${badge}` : ""}
        </div>
      </div>
      <span className="num" style={{ color: "var(--sakura)" }}>＋</span>
    </button>
  );
}

function IngredientPicker({ onAdd }) {
  const [sel, setSel] = useState(null);
  const [grams, setGrams] = useState(100);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState([]);
  const [off, setOff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cam, setCam] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [scanMsg, setScanMsg] = useState("");
  const [suelto, setSuelto] = useState("");   // código escaneado que no conoce nadie
  const [crear, setCrear] = useState(null);   // alta a mano, con su código si lo hay

  useEffect(() => { recentFoods(8).then(setMine).catch(() => {}); }, []);

  useEffect(() => {
    if (sel) return;
    const term = q.trim();
    if (term.length < 2) {
      setOff([]);
      recentFoods(8).then(setMine).catch(() => {});
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const [local, remote] = await Promise.all([
          searchFoods(term, 10).catch(() => []),
          searchOFF(term, { signal: ctrl.signal }).catch(() => []),
        ]);
        setMine(local);
        const codes = new Set(local.map((f) => f.barcode).filter(Boolean));
        setOff(remote.filter((r) => !codes.has(r.barcode)));
      } finally { setLoading(false); }
    }, 420);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, sel]);

  const choose = useCallback((f) => {
    setSel(f);
    setGrams(Number(f.default_serving_g) || 100);
    setCam(false);
    setScanMsg("");
    setSuelto("");
    setCrear(null);
  }, []);

  const onScan = useCallback(async (code) => {
    if (!code) return;
    setScanMsg(`Leyendo el código ${code}…`);
    try {
      const local = await findFoodByBarcode(code);
      if (local) { choose(local); return; }
      const found = await lookupBarcode(code);
      if (found) { choose(found); return; }
      setSuelto(code);
      setScanMsg(`El código ${code} no está en ninguna base. Créalo aquí mismo y queda guardado con su código.`);
    } catch {
      setScanMsg("Fallo al consultar el código. Prueba otra vez.");
    }
  }, [choose]);

  /* --- ingrediente nuevo: se crea aquí y se usa al momento --- */
  if (crear !== null) {
    return (
      <div className="px" style={{ padding: 12 }}>
        <div className="row-b" style={{ marginBottom: 10 }}>
          <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Ingrediente nuevo</strong>
          <button className="icon-btn" onClick={() => setCrear(null)} aria-label="Volver al buscador">✕</button>
        </div>
        <ManualFood
          barcode={crear}
          onCancel={() => setCrear(null)}
          onSaved={(food) => choose(food)}
        />
      </div>
    );
  }

  /* --- ya hay ingrediente elegido: solo falta la cantidad --- */
  if (sel) {
    const m = scaleFood(sel, grams);
    const raciones = [30, 50, 100, 150, 200, Number(sel.default_serving_g) || 100]
      .filter((v, i, a) => v > 0 && a.indexOf(v) === i)
      .sort((a, b) => a - b);
    return (
      <div className="px" style={{ padding: 12 }}>
        <div className="row-b">
          <div>
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{sel.name}</strong>
            {sel.brand && <div className="tiny dim">{sel.brand}</div>}
          </div>
          <button className="icon-btn" onClick={() => setSel(null)} aria-label="Elegir otro">✕</button>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <input className="input num grow" type="number" inputMode="decimal" value={grams} min="0" step="5"
            onChange={(e) => setGrams(Math.max(0, Number(e.target.value)))} />
          <span className="dim num">g</span>
        </div>
        <div className="chips" style={{ marginTop: 6 }}>
          {raciones.map((g) => (
            <button key={g} className="chip" data-on={grams === g} onClick={() => setGrams(g)}>{g} g</button>
          ))}
        </div>
        <div className="tiny num dim" style={{ marginTop: 6 }}>
          {Math.round(m.kcal)} kcal · P{m.protein} C{m.carbs} G{m.fat}
        </div>
        <button className="btn btn-primary btn-block btn-sm" style={{ marginTop: 10 }}
          onClick={async () => {
            let food = sel;
            if (!food.id) { try { food = await saveFood(stripUi(food)); } catch { /* seguimos sin guardarlo */ } }
            onAdd({ food_id: food.id || null, name: sel.name, grams, ...m });
            setSel(null); setGrams(100); setQ("");
          }}>
          Añadir ingrediente
        </button>
      </div>
    );
  }

  /* --- buscador --- */
  return (
    <div className="stack">
      <div className="row">
        <input
          className="input grow"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca un ingrediente…"
        />
        <button
          className="btn"
          onClick={() => { setCam((v) => !v); setScanMsg(""); setScanKey((k) => k + 1); }}
          aria-label={cam ? "Cerrar la cámara" : "Escanear código de barras"}
          title="Escanear código de barras"
        >
          {cam ? "✕" : "📷"}
        </button>
      </div>

      {cam && (
        <div className="px" style={{ padding: 10 }}>
          <Suspense fallback={<div className="empty tiny blink">abriendo la cámara…</div>}>
            <BarcodeScanner key={scanKey} onDetected={onScan} />
          </Suspense>
          {scanMsg && <p className="tiny" style={{ color: "var(--kaki)", margin: "6px 0" }}>{scanMsg}</p>}
          <div className="row">
            <button className="btn btn-sm grow" onClick={() => { setScanKey((k) => k + 1); setScanMsg(""); setSuelto(""); }}>
              Volver a escanear
            </button>
            {suelto && (
              <button className="btn btn-sm btn-primary grow" onClick={() => setCrear(suelto)}>
                ✎ Crearlo
              </button>
            )}
          </div>
        </div>
      )}

      {loading && <div className="tiny dim center blink">buscando…</div>}

      <div style={{ maxHeight: "42vh", overflowY: "auto" }}>
        {mine.length > 0 && (
          <>
            <div className="eyebrow">{q.trim().length < 2 ? "Lo que más usáis" : "En vuestra despensa"}</div>
            {mine.map((f) => <IngredientRow key={f.id} f={f} onPick={choose} />)}
          </>
        )}
        {off.length > 0 && (
          <>
            <div className="eyebrow">Open Food Facts</div>
            {off.map((f, i) => <IngredientRow key={f.barcode || i} f={f} badge="nuevo" onPick={choose} />)}
          </>
        )}
      </div>

      {!loading && q.trim().length >= 2 && !mine.length && !off.length && (
        <div className="empty tiny">
          Sin resultados.
          <button className="btn btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => setCrear("")}>
            ✎ Crearlo a mano
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- editor de receta ---------------- */
function RecipeEditor({ open, initial, onClose, onSaved, toast, profiles = [] }) {
  const [r, setR] = useState(EMPTY);
  const [ings, setIngs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setR({ ...EMPTY, ...initial, prep_min: initial.prep_min ?? "", liked_by: initial.liked_by || [] });
      getRecipeIngredients(initial.id).then(setIngs).catch(() => setIngs([]));
    } else { setR(EMPTY); setIngs([]); }
  }, [open, initial]);

  const totals = useMemo(() => {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, sat_fat: 0, sodium: 0, grams: 0 };
    ings.forEach((i) => {
      Object.keys(t).forEach((k) => { if (k !== "grams") t[k] += Number(i[k]) || 0; });
      t.grams += Number(i.grams) || 0;
    });
    return t;
  }, [ings]);

  const servings = Math.max(0.25, Number(r.servings) || 1);
  const per = (k) => +((totals[k] / servings)).toFixed(1);

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadRecipePhoto(file);
      setR((x) => ({ ...x, photo_url: url }));
    } catch { toast("No se pudo subir la foto"); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!r.name.trim()) return;
    setBusy(true);
    try {
      const payload = {
        ...(r.id ? { id: r.id } : {}),
        name: r.name.trim(), category: r.category, photo_url: r.photo_url || null,
        notes: r.notes || null, steps: r.steps || null,
        servings, prep_min: r.prep_min === "" ? null : Number(r.prep_min),
        total_weight_g: totals.grams || null,
        liked_by: r.liked_by || [],
        kcal: per("kcal"), protein: per("protein"), carbs: per("carbs"), fat: per("fat"),
        fiber: per("fiber"), sugars: per("sugars"), sat_fat: per("sat_fat"), sodium: per("sodium"),
        is_favorite: !!r.is_favorite,
      };
      await saveRecipe(payload, ings);
      toast(r.id ? "Receta actualizada" : "Receta guardada");
      onSaved();
      onClose();
    } catch (e) { toast("No se pudo guardar: " + (e.message || "")); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={r.id ? "Editar receta" : "Nueva receta"} jp="献立">
      <div className="stack">
        {/* foto */}
        <div>
          {r.photo_url ? (
            <div style={{ position: "relative" }}>
              <img src={r.photo_url} alt="" style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", border: "var(--px) solid var(--line)" }} />
              <button className="btn btn-sm" style={{ position: "absolute", right: 8, bottom: 8 }}
                onClick={() => setR({ ...r, photo_url: "" })}>Quitar</button>
            </div>
          ) : (
            <button className="btn btn-block" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Subiendo…" : "📷 Poner foto del plato"}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
        </div>

        <div className="field">
          <label>Nombre</label>
          <input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} placeholder="Salmón con arroz y brócoli" />
        </div>

        <div className="row">
          <div className="field grow">
            <label>Momento</label>
            <select className="input" value={r.category} onChange={(e) => setR({ ...r, category: e.target.value })}>
              {CATS.filter((c) => c.key !== "todas").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Raciones</label>
            <input className="input num" type="number" min="0.25" step="0.25" value={r.servings}
              onChange={(e) => setR({ ...r, servings: e.target.value })} />
          </div>
          <div className="field" style={{ width: 90 }}>
            <label>Minutos</label>
            <input className="input num" type="number" min="0" value={r.prep_min}
              onChange={(e) => setR({ ...r, prep_min: e.target.value })} />
          </div>
        </div>

        {/* ingredientes */}
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Ingredientes</div>
          {ings.map((i, idx) => (
            <div key={idx} className="entry">
              <div className="grow">
                <div style={{ fontSize: 15 }}>{i.name}</div>
                <div className="tiny num dim">{Math.round(i.grams)} g · {Math.round(i.kcal)} kcal</div>
              </div>
              <button className="icon-btn" onClick={() => setIngs(ings.filter((_, j) => j !== idx))} aria-label="Quitar">✕</button>
            </div>
          ))}
          {!ings.length && (
            <p className="tiny dim">
              Búscalos por el nombre o escanea el código de barras. La app calcula sola los macros por ración.
            </p>
          )}
          <div style={{ marginTop: 8 }}>
            <IngredientPicker onAdd={(ing) => setIngs([...ings, ing])} />
          </div>
        </div>

        {/* resumen */}
        {ings.length > 0 && (
          <div className="px" style={{ padding: 12 }}>
            <div className="row-b">
              <span className="eyebrow">Por ración</span>
              <span className="num" style={{ fontSize: 20 }}>{Math.round(per("kcal"))} kcal</span>
            </div>
            <hr className="divider" />
            <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
              <span className="num tiny" style={{ color: "var(--sakura)" }}>P {per("protein")} g</span>
              <span className="num tiny" style={{ color: "var(--lantern)" }}>C {per("carbs")} g</span>
              <span className="num tiny" style={{ color: "var(--mizu)" }}>G {per("fat")} g</span>
              <span className="num tiny" style={{ color: "var(--matcha)" }}>Fibra {per("fiber")} g</span>
            </div>
            <div className="tiny dim" style={{ marginTop: 6 }}>
              Total en crudo: {Math.round(totals.grams)} g · {Math.round(totals.grams / servings)} g por ración
            </div>
          </div>
        )}

        {profiles.length > 0 && (
          <div className="field">
            <label>¿A quién le gusta?</label>
            <div className="chips" style={{ flexWrap: "wrap" }}>
              {profiles.map((p) => {
                const on = (r.liked_by || []).includes(p.id);
                return (
                  <button key={p.id} className="chip" data-on={on}
                    onClick={() => setR({
                      ...r,
                      liked_by: on
                        ? r.liked_by.filter((x) => x !== p.id)
                        : [...(r.liked_by || []), p.id],
                    })}>
                    {p.avatar_emoji} {p.name}
                  </button>
                );
              })}
              <button className="chip" data-on={(r.liked_by || []).length === profiles.length}
                onClick={() => setR({ ...r, liked_by: profiles.map((p) => p.id) })}>
                ✓ A todos
              </button>
            </div>
            <span className="tiny dim">Si no marcas a nadie, la receta sale siempre.</span>
          </div>
        )}

        <div className="field">
          <label>Preparación</label>
          <textarea className="input" value={r.steps || ""} onChange={(e) => setR({ ...r, steps: e.target.value })}
            placeholder={"1. Precalienta el horno a 200º\n2. …"} />
        </div>
        <div className="field">
          <label>Notas</label>
          <input className="input" value={r.notes || ""} onChange={(e) => setR({ ...r, notes: e.target.value })} placeholder="Le va bien un chorrito de limón" />
        </div>

        <button className="btn btn-primary btn-block" disabled={busy || !r.name.trim()} onClick={save}>
          {busy ? "Guardando…" : "Guardar receta"}
        </button>
        {r.id && (
          <button className="btn btn-ghost btn-block btn-sm"
            onClick={async () => {
              if (!confirm("¿Borrar esta receta?")) return;
              await deleteRecipe(r.id); toast("Receta borrada"); onSaved(); onClose();
            }}>
            Borrar receta
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ---------------- detalle ---------------- */
function RecipeDetail({ recipe, onClose, onEdit, onZoom, onReload, toast, profiles = [] }) {
  const [ings, setIngs] = useState([]);
  useEffect(() => { if (recipe) getRecipeIngredients(recipe.id).then(setIngs).catch(() => {}); }, [recipe]);
  if (!recipe) return null;

  return (
    <Sheet open onClose={onClose} title={recipe.name} jp="料理">
      <div className="stack">
        {recipe.photo_url && (
          <button onClick={() => onZoom(recipe.photo_url)} style={{ padding: 0, border: "none", background: "none", cursor: "zoom-in" }}>
            <img src={recipe.photo_url} alt={recipe.name}
              style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", border: "var(--px) solid var(--line)" }} />
          </button>
        )}

        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <span className="tag">{recipe.category}</span>
          {recipe.prep_min ? <span className="tag">{recipe.prep_min} min</span> : null}
          <span className="tag">{recipe.servings} raciones</span>
          <button className="tag" style={{ cursor: "pointer", color: recipe.is_favorite ? "var(--lantern)" : "var(--muted)" }}
            onClick={async () => { await toggleRecipeFavorite(recipe.id, !recipe.is_favorite); onReload(); }}>
            ★ favorita
          </button>
        </div>

        {recipe.liked_by?.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className="eyebrow" style={{ alignSelf: "center" }}>Les gusta a</span>
            {profiles.filter((p) => recipe.liked_by.includes(p.id)).map((p) => (
              <span key={p.id} className="tag" style={{ color: p.color }}>{p.avatar_emoji} {p.name}</span>
            ))}
          </div>
        )}

        <div className="px" style={{ padding: 12 }}>
          <div className="row-b">
            <span className="eyebrow">Por ración</span>
            <span className="num" style={{ fontSize: 22 }}>{Math.round(recipe.kcal)} kcal</span>
          </div>
          <hr className="divider" />
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <span className="num tiny" style={{ color: "var(--sakura)" }}>P {recipe.protein} g</span>
            <span className="num tiny" style={{ color: "var(--lantern)" }}>C {recipe.carbs} g</span>
            <span className="num tiny" style={{ color: "var(--mizu)" }}>G {recipe.fat} g</span>
            <span className="num tiny" style={{ color: "var(--matcha)" }}>Fibra {recipe.fiber} g</span>
          </div>
        </div>

        {ings.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Ingredientes (receta entera)</div>
            {ings.map((i) => (
              <div key={i.id} className="entry">
                <span className="grow tiny">{i.name}</span>
                <span className="num tiny dim">{Math.round(i.grams)} g</span>
              </div>
            ))}
          </div>
        )}

        {recipe.steps && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Preparación</div>
            <p className="tiny" style={{ whiteSpace: "pre-wrap", color: "var(--muted)" }}>{recipe.steps}</p>
          </div>
        )}
        {recipe.notes && <p className="tiny dim">✎ {recipe.notes}</p>}

        {ings.length > 0 && (
          <button className="btn btn-block"
            onClick={async () => {
              try {
                await addShoppingItems(ings.map((i) => ({ text: i.name, qty: fmtGrams(i.grams) })));
                toast(`${ings.length} ingredientes en la lista de la compra`);
              } catch { toast("No se pudo añadir"); }
            }}>
            🧺 Llevar ingredientes a la compra
          </button>
        )}

        <button className="btn btn-block" onClick={() => onEdit(recipe)}>Editar receta</button>
      </div>
    </Sheet>
  );
}

/* ---------------- listado de recetas ---------------- */
function RecipeList({ recipes, reload, toast, profiles }) {
  const { jpLabel } = useTheme();
  const [cat, setCat] = useState("todas");
  const [who, setWho] = useState("todos");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [zoom, setZoom] = useState(null);

  const list = useMemo(() => {
    let l = recipes;
    if (cat !== "todas") l = l.filter((r) => r.category === cat);
    if (who === "casa") {
      // gusta a todo el mundo
      l = l.filter((r) => profiles.length > 0 && profiles.every((p) => (r.liked_by || []).includes(p.id)));
    } else if (who !== "todos") {
      // sin marcar = vale para cualquiera
      l = l.filter((r) => !r.liked_by?.length || r.liked_by.includes(who));
    }
    if (q.trim()) l = l.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    return l;
  }, [recipes, cat, q, who, profiles]);

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar receta…" />
        <button className="btn btn-primary" onClick={() => setEditing({})}>＋ Nueva</button>
      </div>

      <div className="chips">
        {CATS.map((c) => (
          <button key={c.key} className="chip" data-on={cat === c.key} onClick={() => setCat(c.key)}>
            {jpLabel(c.jp, c.label)}
          </button>
        ))}
      </div>

      {profiles.length > 0 && (
        <div className="chips">
          <button className="chip" data-on={who === "todos"} onClick={() => setWho("todos")}>Sin filtrar</button>
          <button className="chip" data-on={who === "casa"} onClick={() => setWho("casa")}>🏠 Gusta a todos</button>
          {profiles.map((p) => (
            <button key={p.id} className="chip" data-on={who === p.id} onClick={() => setWho(p.id)}>
              {p.avatar_emoji} {p.name}
            </button>
          ))}
        </div>
      )}

      {!list.length && (
        <div className="empty">
          <div style={{ fontSize: 34 }}>🍱</div>
          <p className="tiny">Aquí irán vuestros platos. Haz una foto de la próxima comida y guárdala.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>Crear la primera</button>
        </div>
      )}

      <div className="rgrid">
        {list.map((r) => (
          <div key={r.id} className="rcard px drop" onClick={() => setDetail(r)}>
            {r.photo_url ? (
              <img className="thumb" src={r.photo_url} alt={r.name} loading="lazy" />
            ) : (
              <div className="thumb" style={{ display: "grid", placeItems: "center", fontSize: 30 }}>🍚</div>
            )}
            <div className="meta">
              <div style={{ fontSize: 14, lineHeight: 1.25 }}>
                {r.is_favorite && <span style={{ color: "var(--lantern)" }}>★ </span>}{r.name}
              </div>
              <div className="tiny num" style={{ color: "var(--muted-2)" }}>{Math.round(r.kcal)} kcal · P{Math.round(r.protein)}</div>
              {r.liked_by?.length > 0 && (
                <div style={{ fontSize: 14, marginTop: 2 }}>
                  {profiles.filter((p) => r.liked_by.includes(p.id)).map((p) => p.avatar_emoji).join(" ")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <RecipeDetail
        recipe={detail} onClose={() => setDetail(null)}
        onEdit={(r) => { setDetail(null); setEditing(r); }}
        onZoom={setZoom} onReload={reload} toast={toast} profiles={profiles}
      />

      <RecipeEditor
        open={!!editing} initial={editing} onClose={() => setEditing(null)}
        onSaved={reload} toast={toast} profiles={profiles}
      />

      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-label="Foto ampliada">
          <img src={zoom} alt="" />
          <button className="btn btn-sm" style={{ position: "absolute", top: 16, right: 16 }} onClick={() => setZoom(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- página con sus dos subpestañas ---------------- */
export default function RecipesPage({ recipes, reload, toast, profiles = [] }) {
  const [sub, setSub] = useState("recetas");

  return (
    <div className="wrap stack" style={{ paddingTop: 12 }}>
      <div>
        <Jp>献立帳</Jp>
        <h2 style={{ fontSize: 22 }}>Recetario</h2>
      </div>

      {/* subpestañas: las recetas y la despensa de ingredientes */}
      <div className="subtabs" role="tablist">
        <button className="subtab" role="tab" aria-selected={sub === "recetas"}
          data-on={sub === "recetas"} onClick={() => setSub("recetas")}>
          Recetas
        </button>
        <button className="subtab" role="tab" aria-selected={sub === "ingredientes"}
          data-on={sub === "ingredientes"} onClick={() => setSub("ingredientes")}>
          Ingredientes
        </button>
      </div>

      {sub === "recetas"
        ? <RecipeList recipes={recipes} reload={reload} toast={toast} profiles={profiles} />
        : <IngredientsTab toast={toast} />}
    </div>
  );
}
