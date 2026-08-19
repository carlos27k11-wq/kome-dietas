import React, { useEffect, useMemo, useState } from "react";
import { Insight, PixelBar } from "../components/ui";
import { updateProfile, deleteProfile } from "../lib/store";
import { ACTIVITY, GOALS, MEALS, targetsFor, ageFrom } from "../lib/nutrition";

const EMOJIS = ["🍙", "🍣", "🐱", "🌸", "🍵", "🦊", "🌙", "🍜", "🐼", "🍡", "🐟", "🌿", "⛩️", "🍥", "🐧", "🍄"];

export default function ProfilePage({ profile, onUpdate, onSwitch, onDeleted, toast }) {
  const [f, setF] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setF(profile); setDirty(false); }, [profile]);

  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setDirty(true); };
  const t = useMemo(() => targetsFor(f), [f]);
  const age = ageFrom(f.birth_date);

  async function save() {
    setSaving(true);
    try {
      const patch = {
        name: f.name, avatar_emoji: f.avatar_emoji, color: f.color,
        sex: f.sex, birth_date: f.birth_date || null,
        height_cm: f.height_cm ? Number(f.height_cm) : null,
        weight_kg: f.weight_kg ? Number(f.weight_kg) : null,
        activity_level: f.activity_level, goal: f.goal,
        auto_targets: f.auto_targets,
        protein_per_kg: Number(f.protein_per_kg) || 1.8,
        fat_per_kg: Number(f.fat_per_kg) || 0.9,
        water_goal_ml: Number(f.water_goal_ml) || 2000,
        steps_goal: Number(f.steps_goal) || 10000,
        meal_split: f.meal_split,
        kcal_goal: f.auto_targets ? t.kcal : Number(f.kcal_goal) || 2000,
        protein_goal: f.auto_targets ? t.protein : Number(f.protein_goal) || 130,
        carbs_goal: f.auto_targets ? t.carbs : Number(f.carbs_goal) || 220,
        fat_goal: f.auto_targets ? t.fat : Number(f.fat_goal) || 65,
        fiber_goal: f.auto_targets ? t.fiber : Number(f.fiber_goal) || 30,
      };
      const updated = await updateProfile(profile.id, patch);
      onUpdate(updated);
      setDirty(false);
      toast("Guardado");
    } catch (e) { toast("No se pudo guardar"); }
    finally { setSaving(false); }
  }

  const splitTotal = MEALS.reduce((a, m) => a + (Number(f.meal_split?.[m.key]) || 0), 0);

  return (
    <div className="wrap stack" style={{ paddingTop: 12 }}>
      <div className="row-b">
        <div>
          <div className="kanji">設定</div>
          <h2 style={{ fontSize: 20 }}>{f.name}</h2>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onSwitch}>Cambiar de perfil</button>
      </div>

      {/* --- identidad --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="avatar" style={{ width: 62, height: 62, fontSize: 28, borderColor: f.color }}>{f.avatar_emoji}</div>
          <div className="field grow">
            <label>Nombre</label>
            <input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 5, marginTop: 10 }}>
          {EMOJIS.map((e) => (
            <button key={e} className="chip center" data-on={f.avatar_emoji === e} style={{ fontSize: 16, padding: 5 }}
              onClick={() => set("avatar_emoji", e)}>{e}</button>
          ))}
        </div>
      </div>

      {/* --- datos --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Tus datos</div>
        <div className="row" style={{ gap: 10 }}>
          <div className="field grow">
            <label>Sexo</label>
            <select className="input" value={f.sex || "f"} onChange={(e) => set("sex", e.target.value)}>
              <option value="f">Mujer</option>
              <option value="m">Hombre</option>
            </select>
          </div>
          <div className="field grow">
            <label>Nacimiento</label>
            <input className="input" type="date" value={f.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} />
          </div>
        </div>
        <div className="row" style={{ gap: 10, marginTop: 10 }}>
          <div className="field grow">
            <label>Altura (cm)</label>
            <input className="input num" type="number" inputMode="decimal" value={f.height_cm || ""} onChange={(e) => set("height_cm", e.target.value)} />
          </div>
          <div className="field grow">
            <label>Peso (kg)</label>
            <input className="input num" type="number" step="0.1" inputMode="decimal" value={f.weight_kg || ""} onChange={(e) => set("weight_kg", e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Actividad diaria</label>
          <select className="input" value={f.activity_level || "ligero"} onChange={(e) => set("activity_level", e.target.value)}>
            {Object.entries(ACTIVITY).map(([k, v]) => (
              <option key={k} value={k}>{v.label} — {v.hint}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <label>Objetivo</label>
          <select className="input" value={f.goal || "mantener"} onChange={(e) => set("goal", e.target.value)}>
            {Object.entries(GOALS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}{v.kg ? ` (${v.kg > 0 ? "+" : ""}${v.kg} kg/semana)` : ""}</option>
            ))}
          </select>
        </div>
        {age != null && <p className="tiny dim" style={{ marginBottom: 0 }}>{age} años</p>}
      </div>

      {/* --- cálculo --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row-b">
          <div className="eyebrow">Objetivos del día</div>
          <label className="row tiny" style={{ gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!!f.auto_targets} onChange={(e) => set("auto_targets", e.target.checked)} />
            calcular solo
          </label>
        </div>

        {f.auto_targets ? (
          t.auto ? (
            <>
              <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <div className="grow">
                  <div className="tiny dim">Metabolismo basal</div>
                  <div className="num" style={{ fontSize: 17 }}>{t.bmr} kcal</div>
                </div>
                <div className="grow">
                  <div className="tiny dim">Gasto total (×{t.factor})</div>
                  <div className="num" style={{ fontSize: 17 }}>{t.tdee} kcal</div>
                </div>
                <div className="grow">
                  <div className="tiny dim">{t.goalLabel}</div>
                  <div className="num" style={{ fontSize: 17, color: "var(--sakura)" }}>{t.kcal} kcal</div>
                </div>
              </div>
              <hr className="divider" />
              <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
                <span className="num tiny" style={{ color: "var(--sakura)" }}>P {t.protein} g ({t.proteinPerKg} g/kg)</span>
                <span className="num tiny" style={{ color: "var(--lantern)" }}>C {t.carbs} g</span>
                <span className="num tiny" style={{ color: "var(--mizu)" }}>G {t.fat} g</span>
                <span className="num tiny" style={{ color: "var(--matcha)" }}>Fibra {t.fiber} g</span>
              </div>
              <p className="tiny dim" style={{ marginTop: 8, marginBottom: 0 }}>
                Calculado con Mifflin-St Jeor y tu factor de actividad. La proteína se fija por kilo de peso, la grasa también,
                y el carbohidrato ocupa la energía restante.
              </p>
              {t.warn && <Insight tone="warn" text={t.warn} />}
              {t.notes?.map((n, i) => <Insight key={i} tone="info" text={n} />)}

              <div className="row" style={{ gap: 10, marginTop: 10 }}>
                <div className="field grow">
                  <label>Proteína g/kg</label>
                  <input className="input num" type="number" step="0.1" min="1" max="3"
                    value={f.protein_per_kg || 1.8} onChange={(e) => set("protein_per_kg", e.target.value)} />
                </div>
                <div className="field grow">
                  <label>Grasa g/kg</label>
                  <input className="input num" type="number" step="0.1" min="0.5" max="2"
                    value={f.fat_per_kg || 0.9} onChange={(e) => set("fat_per_kg", e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <Insight tone="warn" text="Rellena sexo, fecha de nacimiento, altura y peso para que se puedan calcular tus calorías." />
          )
        ) : (
          <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {[["kcal_goal", "Kcal"], ["protein_goal", "Proteína"], ["carbs_goal", "Carbos"], ["fat_goal", "Grasa"], ["fiber_goal", "Fibra"]].map(([k, l]) => (
              <div className="field" key={k} style={{ width: "calc(33% - 7px)" }}>
                <label>{l}</label>
                <input className="input num" type="number" value={f[k] || ""} onChange={(e) => set(k, e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- reparto por comidas --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Reparto de energía</div>
        {MEALS.map((m) => {
          const v = Math.round((Number(f.meal_split?.[m.key]) || 0) * 100);
          return (
            <div key={m.key} style={{ marginBottom: 9 }}>
              <div className="row-b" style={{ marginBottom: 3 }}>
                <span className="tiny">{m.emoji} {m.label}</span>
                <span className="num tiny dim">{v}% · {Math.round((v / 100) * t.kcal)} kcal</span>
              </div>
              <input
                type="range" min="0" max="60" step="5" value={v}
                style={{ width: "100%", accentColor: "var(--sakura)" }}
                onChange={(e) => set("meal_split", { ...(f.meal_split || {}), [m.key]: Number(e.target.value) / 100 })}
              />
            </div>
          );
        })}
        <PixelBar value={splitTotal} max={1} color={Math.abs(splitTotal - 1) < 0.02 ? "var(--matcha)" : "var(--kaki)"} />
        <p className="tiny dim" style={{ marginTop: 6, marginBottom: 0 }}>
          Suma {Math.round(splitTotal * 100)}%. Es orientativo: reparte según a qué hora tengas más hambre o entrenes.
        </p>
      </div>

      {/* --- agua y pasos --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row" style={{ gap: 10 }}>
          <div className="field grow">
            <label>Objetivo de agua (ml)</label>
            <input className="input num" type="number" step="250" value={f.water_goal_ml || 2000}
              onChange={(e) => set("water_goal_ml", e.target.value)} />
          </div>
          <div className="field grow">
            <label>Objetivo de pasos</label>
            <input className="input num" type="number" step="1000" value={f.steps_goal || 10000}
              onChange={(e) => set("steps_goal", e.target.value)} />
          </div>
        </div>
        <p className="tiny dim" style={{ marginBottom: 0 }}>
          Referencia: unos 30-35 ml por kilo de peso, más si hace calor o entrenas.
          {f.weight_kg ? ` Para ti serían unos ${Math.round(Number(f.weight_kg) * 33)} ml.` : ""}
        </p>
      </div>

      <button className="btn btn-primary btn-block" disabled={!dirty || saving} onClick={save}>
        {saving ? "Guardando…" : dirty ? "Guardar cambios" : "Todo guardado"}
      </button>

      <button className="btn btn-ghost btn-block btn-sm"
        onClick={async () => {
          if (!confirm(`¿Borrar el perfil de ${profile.name} y todo su diario? No se puede deshacer.`)) return;
          await deleteProfile(profile.id);
          onDeleted();
        }}>
        Borrar este perfil
      </button>

      <p className="tiny center" style={{ color: "var(--muted-2)", paddingBottom: 10 }}>
        米 kome · datos de alimentos de Open Food Facts (ODbL)
      </p>
    </div>
  );
}
