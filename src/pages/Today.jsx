import React, { useCallback, useEffect, useMemo, useState } from "react";
import { WindowScene, RiceBowl, dayPhase } from "../components/PixelArt";
import { Sheet, PixelBar, MacroBar, Insight } from "../components/ui";
import AddSheet from "../components/AddSheet";
import {
  MEALS, targetsFor, mealTargets, sumEntries, dayInsights,
  isoDate, shiftDate, prettyDate, stepsInfo,
} from "../lib/nutrition";
import {
  getDay, addEntries, updateEntry, deleteEntry, copyDay,
  getWater, addWater, resetWater, getSteps, setSteps,
} from "../lib/store";

/* --- vaso de agua en píxeles --- */
function Cup({ filled }) {
  return (
    <svg viewBox="0 0 10 12" width="20" height="24" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1" y="1" width="8" height="10" fill={filled ? "#79b0dc" : "#241f3b"} />
      <rect x="1" y="1" width="8" height="1" fill={filled ? "#a8d0ec" : "#362f57"} />
      <g fill="#453c6b">
        <rect x="0" y="0" width="10" height="1" />
        <rect x="0" y="0" width="1" height="12" />
        <rect x="9" y="0" width="1" height="12" />
        <rect x="1" y="11" width="8" height="1" />
      </g>
    </svg>
  );
}

/* --- huella en píxeles --- */
function Footprint({ on }) {
  const c = on ? "#9cc97f" : "#3a3159";
  return (
    <svg viewBox="0 0 7 10" width="14" height="20" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="1" y="0" width="1" height="1" fill={c} />
      <rect x="3" y="0" width="1" height="1" fill={c} />
      <rect x="5" y="1" width="1" height="1" fill={c} />
      <rect x="1" y="2" width="5" height="3" fill={c} />
      <rect x="2" y="5" width="3" height="2" fill={c} />
      <rect x="1" y="7" width="4" height="3" fill={c} />
    </svg>
  );
}

function EntryEditor({ entry, onClose, onSave, onDelete }) {
  const isRecipe = entry?.source_type === "recipe";
  const base = isRecipe ? Number(entry.servings) || 1 : Number(entry.grams) || 0;
  const [amount, setAmount] = useState(base);
  if (!entry) return null;

  const scalable = base > 0;
  const k = scalable ? amount / base : 1;
  const sc = (v) => +(((Number(v) || 0) * k)).toFixed(1);

  return (
    <Sheet open onClose={onClose} title={entry.name} jp="編集">
      <div className="stack">
        {scalable ? (
          <div className="field">
            <label>{isRecipe ? "Raciones" : "Gramos"}</label>
            <input className="input num" type="number" inputMode="decimal" min="0"
              step={isRecipe ? 0.25 : 5} value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} />
          </div>
        ) : (
          <p className="tiny dim">Esta entrada se apuntó a mano, así que no se puede escalar. Bórrala y créala de nuevo si quieres cambiarla.</p>
        )}

        <div className="px" style={{ padding: 12 }}>
          <div className="row-b">
            <span className="eyebrow">Aporta</span>
            <span className="num" style={{ fontSize: 20 }}>{Math.round(sc(entry.kcal))} kcal</span>
          </div>
          <hr className="divider" />
          <div className="row" style={{ gap: 14 }}>
            <span className="num tiny" style={{ color: "var(--sakura)" }}>P {sc(entry.protein)}</span>
            <span className="num tiny" style={{ color: "var(--lantern)" }}>C {sc(entry.carbs)}</span>
            <span className="num tiny" style={{ color: "var(--mizu)" }}>G {sc(entry.fat)}</span>
          </div>
        </div>

        <div className="row">
          <button className="btn btn-ghost" onClick={() => onDelete(entry)}>Borrar</button>
          {scalable && (
            <button className="btn btn-primary grow"
              onClick={() => onSave(entry, {
                [isRecipe ? "servings" : "grams"]: amount,
                kcal: sc(entry.kcal), protein: sc(entry.protein), carbs: sc(entry.carbs), fat: sc(entry.fat),
                fiber: sc(entry.fiber), sugars: sc(entry.sugars), sat_fat: sc(entry.sat_fat), sodium: sc(entry.sodium),
              })}>
              Guardar
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export default function Today({ profile, recipes, toast }) {
  const [date, setDate] = useState(isoDate());
  const [entries, setEntries] = useState([]);
  const [water, setWater] = useState(0);
  const [steps, setStepsState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addFor, setAddFor] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showMicros, setShowMicros] = useState(false);

  const targets = useMemo(() => targetsFor(profile), [profile]);
  const totals = useMemo(() => sumEntries(entries), [entries]);
  const perMeal = useMemo(() => mealTargets(profile, targets.kcal), [profile, targets.kcal]);
  const insights = useMemo(() => dayInsights(totals, targets, profile), [totals, targets, profile]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, w, st] = await Promise.all([
        getDay(profile.id, date), getWater(profile.id, date), getSteps(profile.id, date),
      ]);
      setEntries(e); setWater(w); setStepsState(st);
    } catch (err) { toast("No se pudo cargar el día"); }
    finally { setLoading(false); }
  }, [profile.id, date, toast]);

  useEffect(() => { load(); }, [load]);

  const byMeal = useMemo(() => {
    const m = {};
    MEALS.forEach((x) => (m[x.key] = []));
    entries.forEach((e) => { (m[e.meal] ||= []).push(e); });
    return m;
  }, [entries]);

  const left = targets.kcal - totals.kcal;
  const ratio = targets.kcal ? totals.kcal / targets.kcal : 0;
  const proteinDone = totals.protein >= targets.protein;
  const waterGoal = profile.water_goal_ml || 2000;
  const stepsGoal = profile.steps_goal || 10000;
  const walk = stepsInfo(steps, profile.weight_kg);

  async function handleAdded(rows) {
    await addEntries(rows.map((r) => ({ ...r, date })));
    toast("Apuntado");
    load();
  }

  return (
    <div className="wrap stack" style={{ paddingTop: 12 }}>
      {/* --- navegación de día --- */}
      <div className="row-b">
        <button className="icon-btn num" onClick={() => setDate(shiftDate(date, -1))} aria-label="Día anterior">◀</button>
        <div className="center">
          <div className="kanji">{date}</div>
          <h2 style={{ fontSize: 18, textTransform: "capitalize" }}>{prettyDate(date)}</h2>
        </div>
        <button className="icon-btn num" onClick={() => setDate(shiftDate(date, 1))}
          disabled={date >= isoDate()} style={{ opacity: date >= isoDate() ? 0.25 : 1 }} aria-label="Día siguiente">▶</button>
      </div>

      {/* --- ventana + resumen --- */}
      <div className="px drop" style={{ padding: 0, overflow: "hidden" }}>
        <WindowScene phase={dayPhase()} showCat={proteinDone} kcalRatio={ratio} />
        <div style={{ padding: 14, borderTop: "var(--px) solid var(--line)" }}>
          <div className="row-b" style={{ alignItems: "flex-end" }}>
            <div>
              <div className="eyebrow">{left >= 0 ? "Te quedan" : "Te has pasado"}</div>
              <div className="big-num" style={{ color: left >= 0 ? "var(--washi)" : "var(--kaki)" }}>
                {Math.abs(Math.round(left))}
              </div>
              <div className="tiny dim num">de {targets.kcal} kcal · llevas {Math.round(totals.kcal)}</div>
            </div>
            <RiceBowl ratio={ratio} size={4} />
          </div>

          <div style={{ marginTop: 12 }}>
            <PixelBar value={totals.kcal} max={targets.kcal} color="var(--washi)" height={18} />
          </div>

          <div className="row" style={{ gap: 12, marginTop: 14, alignItems: "flex-start" }}>
            <MacroBar label="Prote" value={totals.protein} target={targets.protein} color="var(--sakura)" />
            <MacroBar label="Carbo" value={totals.carbs} target={targets.carbs} color="var(--lantern)" />
            <MacroBar label="Grasa" value={totals.fat} target={targets.fat} color="var(--mizu)" />
          </div>

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setShowMicros((v) => !v)}>
            {showMicros ? "Ocultar detalle" : "Fibra, azúcar, sal…"}
          </button>

          {showMicros && (
            <div className="stack" style={{ marginTop: 12 }}>
              <MacroBar label="Fibra" value={totals.fiber} target={targets.fiber} color="var(--matcha)" />
              <MacroBar label="Azúcares" value={totals.sugars} target={targets.sugarsMax || Math.round(targets.kcal * 0.1 / 4)} color="var(--ume)" />
              <MacroBar label="G. saturada" value={totals.sat_fat} target={targets.satFatMax || Math.round(targets.kcal * 0.1 / 9)} color="var(--kaki)" />
              <MacroBar label="Sodio" value={totals.sodium} target={2000} unit="mg" color="var(--mizu)" />
              <p className="tiny dim" style={{ margin: 0 }}>
                Los límites de azúcar y grasa saturada son el 10% de tu energía (OMS). El sodio, 2.000 mg ≈ 5 g de sal.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- agua --- */}
      <div className="px" style={{ padding: 12 }}>
        <div className="row-b">
          <div>
            <div className="eyebrow">Agua 水</div>
            <div className="num" style={{ fontSize: 17 }}>
              {(water / 1000).toFixed(2).replace(".", ",")} L <span className="dim tiny">/ {(waterGoal / 1000).toString().replace(".", ",")} L</span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" onClick={async () => { await addWater(profile.id, date, 250); setWater(water + 250); }}>+250 ml</button>
            <button className="icon-btn tiny" onClick={async () => { await resetWater(profile.id, date); setWater(0); }} aria-label="Reiniciar agua">↺</button>
          </div>
        </div>
        <div className="row" style={{ gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          {Array.from({ length: Math.ceil(waterGoal / 250) }).map((_, i) => (
            <Cup key={i} filled={i < Math.floor(water / 250)} />
          ))}
        </div>
      </div>

      {/* --- pasos --- */}
      <div className="px" style={{ padding: 12 }}>
        <div className="row-b">
          <div>
            <div className="eyebrow">Pasos 歩数</div>
            <div className="num" style={{ fontSize: 17 }}>
              {steps.toLocaleString("es-ES")} <span className="dim tiny">/ {stepsGoal.toLocaleString("es-ES")}</span>
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm" disabled={steps < 1000}
              onClick={async () => { const v = await setSteps(profile.id, date, steps - 1000); setStepsState(v); }}>−1.000</button>
            <button className="btn btn-sm"
              onClick={async () => { const v = await setSteps(profile.id, date, steps + 1000); setStepsState(v); }}>+1.000</button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <PixelBar value={steps} max={stepsGoal} color="var(--matcha)" />
        </div>

        <div className="row" style={{ gap: 3, marginTop: 8, flexWrap: "wrap" }}>
          {Array.from({ length: Math.ceil(stepsGoal / 1000) }).map((_, i) => (
            <Footprint key={i} on={i < Math.floor(steps / 1000)} />
          ))}
        </div>

        <div className="row-b" style={{ marginTop: 8 }}>
          <span className="tiny dim num">
            ≈ {walk.km.toString().replace(".", ",")} km{walk.kcal ? ` · ${walk.kcal} kcal gastadas` : ""}
          </span>
          <button className="icon-btn tiny" aria-label="Poner pasos a mano"
            onClick={async () => {
              const v = prompt("Pasos de hoy", String(steps));
              if (v === null) return;
              const n = Number(v.replace(/\./g, "").replace(",", "."));
              if (!isFinite(n)) return;
              setStepsState(await setSteps(profile.id, date, n));
            }}>✎</button>
        </div>
        <p className="tiny" style={{ color: "var(--muted-2)", margin: "6px 0 0" }}>
          Las kcal andando no se suman a lo que puedes comer: tu factor de actividad ya las incluye.
        </p>
      </div>

      {/* --- lectura del día --- */}
      {insights.length > 0 && (
        <div className="px" style={{ padding: "10px 12px" }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Cómo va el día</div>
          {insights.map((x, i) => <Insight key={i} {...x} />)}
        </div>
      )}

      {/* --- comidas --- */}
      {MEALS.map((m) => {
        const rows = byMeal[m.key] || [];
        const kcal = rows.reduce((a, r) => a + Number(r.kcal), 0);
        const target = perMeal[m.key];
        return (
          <div key={m.key} className="px meal">
            <div className="row-b">
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 17 }}>{m.emoji}</span>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{m.label}</div>
                  <div className="tiny num" style={{ color: "var(--muted-2)" }}>
                    {Math.round(kcal)} kcal{target > 0 ? ` · objetivo ${target}` : ""}
                  </div>
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setAddFor(m.key)}>＋</button>
            </div>

            {rows.length > 0 && <div style={{ marginTop: 8 }} />}
            {rows.map((e) => (
              <div key={e.id} className="entry">
                <button className="grow" onClick={() => setEditing(e)}
                  style={{ background: "none", border: "none", textAlign: "left", padding: 0, cursor: "pointer", color: "inherit" }}>
                  <div style={{ fontSize: 14 }}>{e.name}</div>
                  <div className="tiny num" style={{ color: "var(--muted-2)" }}>
                    {e.source_type === "recipe" ? `${e.servings} rac.` : e.grams ? `${Math.round(e.grams)} g` : "a ojo"}
                    {" · "}P{Math.round(e.protein)} C{Math.round(e.carbs)} G{Math.round(e.fat)}
                  </div>
                </button>
                <span className="num" style={{ fontSize: 13 }}>{Math.round(e.kcal)}</span>
              </div>
            ))}

            {rows.length === 0 && (
              <div className="tiny" style={{ color: "var(--muted-2)", marginTop: 6 }}>
                {target > 0 ? `Sin apuntar. Aquí te tocarían unas ${target} kcal.` : "Sin apuntar."}
              </div>
            )}
          </div>
        );
      })}

      {/* --- acciones del día --- */}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost grow btn-sm"
          onClick={async () => {
            const rows = await copyDay(profile.id, shiftDate(date, -1), date);
            toast(rows.length ? `Copiadas ${rows.length} entradas de ayer` : "Ayer no hay nada apuntado");
            load();
          }}>
          Copiar el día de ayer
        </button>
        {date !== isoDate() && (
          <button className="btn btn-ghost btn-sm" onClick={() => setDate(isoDate())}>Ir a hoy</button>
        )}
      </div>

      {loading && <div className="center tiny dim blink">cargando…</div>}

      <AddSheet
        open={!!addFor} meal={addFor || "comida"} onClose={() => setAddFor(null)}
        recipes={recipes} profileId={profile.id} onAdded={handleAdded}
      />

      {editing && (
        <EntryEditor
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={async (e, patch) => { await updateEntry(e.id, patch); setEditing(null); toast("Actualizado"); load(); }}
          onDelete={async (e) => { await deleteEntry(e.id); setEditing(null); toast("Borrado"); load(); }}
        />
      )}
    </div>
  );
}
