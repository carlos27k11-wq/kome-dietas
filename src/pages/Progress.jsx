import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PixelBar, PixelChart, PixelLine, Insight, Sheet } from "../components/ui";
import { getSeries, listWeights, saveWeight, deleteWeight, getWaterSeries, getStepsSeries } from "../lib/store";
import { targetsFor, periodStats, streakOf, isoDate, GOALS, stepsInfo } from "../lib/nutrition";

const RANGES = [
  { key: 7, label: "7 días", jp: "週" },
  { key: 30, label: "30 días", jp: "月" },
  { key: 90, label: "90 días", jp: "季" },
];

const DOW = ["D", "L", "M", "X", "J", "V", "S"];

function Stat({ label, value, sub, color }) {
  return (
    <div className="px" style={{ padding: "10px 12px", flex: "1 1 44%", minWidth: 130 }}>
      <div className="eyebrow">{label}</div>
      <div className="num" style={{ fontSize: 21, color: color || "var(--washi)" }}>{value}</div>
      {sub && <div className="tiny" style={{ color: "var(--muted-2)" }}>{sub}</div>}
    </div>
  );
}

export default function Progress({ profile, toast }) {
  const [range, setRange] = useState(7);
  const [days, setDays] = useState([]);
  const [weights, setWeights] = useState([]);
  const [waterDays, setWaterDays] = useState([]);
  const [stepDays, setStepDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weighIn, setWeighIn] = useState(false);
  const [w, setW] = useState("");

  const targets = useMemo(() => targetsFor(profile), [profile]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, wl, wa, st] = await Promise.all([
        getSeries(profile.id, range),
        listWeights(profile.id),
        getWaterSeries(profile.id, range),
        getStepsSeries(profile.id, range),
      ]);
      setDays(s); setWeights(wl); setWaterDays(wa); setStepDays(st);
    } catch { toast("No se pudo cargar el histórico"); }
    finally { setLoading(false); }
  }, [profile.id, range, toast]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => periodStats(days, targets), [days, targets]);
  const streak = useMemo(() => streakOf(days), [days]);

  const labelFor = (iso) => {
    const dt = new Date(iso + "T12:00:00");
    return range <= 7 ? DOW[dt.getDay()] : dt.getDate() % 5 === 0 ? String(dt.getDate()) : "";
  };

  const waterGoal = profile.water_goal_ml || 2000;
  const stepsGoal = profile.steps_goal || 10000;

  const waterData = waterDays.map((d) => ({ value: d.ml, label: d.date, short: labelFor(d.date) }));
  const stepData = stepDays.map((d) => ({ value: d.steps, label: d.date, short: labelFor(d.date) }));

  const waterLogged = waterData.filter((d) => d.value > 0);
  const stepsLogged = stepData.filter((d) => d.value > 0);
  const waterAvg = waterLogged.length ? Math.round(waterLogged.reduce((a, d) => a + d.value, 0) / waterLogged.length) : 0;
  const stepsAvg = stepsLogged.length ? Math.round(stepsLogged.reduce((a, d) => a + d.value, 0) / stepsLogged.length) : 0;
  const stepsTotal = stepData.reduce((a, d) => a + d.value, 0);
  const walkTotal = stepsInfo(stepsTotal, profile.weight_kg);

  const chartData = days.map((d) => {
    const dt = new Date(d.date + "T12:00:00");
    return {
      value: d.kcal,
      label: d.date,
      short: range <= 7 ? DOW[dt.getDay()] : dt.getDate() % 5 === 0 ? String(dt.getDate()) : "",
    };
  });

  const colorFor = (d) => {
    if (!d.value) return "var(--line-soft)";
    const r = d.value / targets.kcal;
    if (r > 1.1) return "var(--kaki)";
    if (r < 0.85) return "var(--ume)";
    return "var(--matcha)";
  };

  const weightPoints = [...weights].reverse().map((x) => ({ y: Number(x.weight_kg), x: x.date }));
  const wFirst = weightPoints[0]?.y, wLast = weightPoints[weightPoints.length - 1]?.y;
  const wDelta = wFirst && wLast ? +(wLast - wFirst).toFixed(1) : null;
  const goal = GOALS[profile.goal] || GOALS.mantener;

  const notes = [];
  if (stats) {
    if (stats.adherence >= 70) notes.push({ tone: "good", text: `Buena constancia: ${stats.adherence}% de los días dentro del ±10% del objetivo.` });
    else notes.push({ tone: "warn", text: `Solo el ${stats.adherence}% de los días caen cerca del objetivo. Ajustar el objetivo suele funcionar mejor que forzar la dieta.` });

    if (Math.abs(stats.kgTrend) >= 0.1) {
      notes.push({
        tone: "info",
        text: `El balance de ${stats.days} días equivale a ${stats.kgTrend > 0 ? "+" : ""}${stats.kgTrend} kg de tejido graso, si los datos apuntados son fieles.`,
      });
    }
    if (profile.weight_kg && stats.protein) {
      const gkg = +(stats.protein / profile.weight_kg).toFixed(1);
      notes.push({
        tone: gkg >= 1.6 ? "good" : "warn",
        text: `Media de proteína: ${gkg} g/kg. ${gkg >= 1.6 ? "Suficiente para mantener masa magra." : "Por debajo de 1,6 g/kg, el rango recomendado en dieta."}`,
      });
    }
    if (stats.fiber && stats.fiber < targets.fiber * 0.7)
      notes.push({ tone: "warn", text: `Fibra media de ${stats.fiber} g frente a ${targets.fiber} g recomendados.` });
  }

  return (
    <div className="wrap stack" style={{ paddingTop: 12 }}>
      <div>
        <div className="kanji">記録</div>
        <h2 style={{ fontSize: 20 }}>Tu registro</h2>
      </div>

      <div className="chips">
        {RANGES.map((r) => (
          <button key={r.key} className="chip" data-on={range === r.key} onClick={() => setRange(r.key)}>
            {r.jp} {r.label}
          </button>
        ))}
      </div>

      <div className="px" style={{ padding: 14 }}>
        <div className="row-b" style={{ marginBottom: 10 }}>
          <span className="eyebrow">Kcal por día</span>
          <span className="tiny num dim">objetivo {targets.kcal}</span>
        </div>
        <PixelChart data={chartData} target={targets.kcal} colorFor={colorFor} height={110} />
        <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: "wrap" }}>
          <span className="tiny dim"><span style={{ color: "var(--matcha)" }}>■</span> en rango</span>
          <span className="tiny dim"><span style={{ color: "var(--kaki)" }}>■</span> pasado</span>
          <span className="tiny dim"><span style={{ color: "var(--ume)" }}>■</span> corto</span>
        </div>
      </div>

      {stats ? (
        <>
          <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
            <Stat label="Media kcal" value={stats.kcal} sub={`${stats.days} días con registro`} />
            <Stat label="Constancia" value={`${stats.adherence}%`} sub="días cerca del objetivo"
              color={stats.adherence >= 70 ? "var(--matcha)" : "var(--kaki)"} />
            <Stat label="Racha" value={`${streak} d`} sub="días seguidos apuntando" color="var(--lantern)" />
            <Stat label="Balance" value={`${stats.balance > 0 ? "+" : ""}${stats.balance}`} sub={`≈ ${stats.kgTrend > 0 ? "+" : ""}${stats.kgTrend} kg`}
              color={stats.balance <= 0 ? "var(--mizu)" : "var(--kaki)"} />
          </div>

          <div className="px" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Medias de macros</div>
            {[
              ["Proteína", stats.protein, targets.protein, "var(--sakura)"],
              ["Carbos", stats.carbs, targets.carbs, "var(--lantern)"],
              ["Grasa", stats.fat, targets.fat, "var(--mizu)"],
              ["Fibra", stats.fiber, targets.fiber, "var(--matcha)"],
            ].map(([l, v, t, c]) => (
              <div key={l} style={{ marginBottom: 10 }}>
                <div className="row-b" style={{ marginBottom: 3 }}>
                  <span className="eyebrow" style={{ color: c }}>{l}</span>
                  <span className="num tiny">{v} <span className="dim">/ {t} g</span></span>
                </div>
                <PixelBar value={v} max={t} color={c} />
              </div>
            ))}
          </div>

          {notes.length > 0 && (
            <div className="px" style={{ padding: "10px 12px" }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Lectura del periodo</div>
              {notes.map((n, i) => <Insight key={i} {...n} />)}
            </div>
          )}
        </>
      ) : (
        !loading && <div className="empty tiny">Aún no hay días apuntados en este periodo.</div>
      )}

      {/* --- agua --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row-b" style={{ marginBottom: 10 }}>
          <div>
            <span className="eyebrow">Agua 水</span>
            <div className="num" style={{ fontSize: 18, color: "var(--mizu)" }}>
              {(waterAvg / 1000).toFixed(2).replace(".", ",")} L
              <span className="tiny dim"> de media</span>
            </div>
          </div>
          <span className="tiny num dim">objetivo {(waterGoal / 1000).toString().replace(".", ",")} L</span>
        </div>
        <PixelChart
          data={waterData} target={waterGoal} height={80}
          colorFor={(d) => (!d.value ? "var(--line-soft)" : d.value >= waterGoal ? "var(--mizu)" : "#4d7ba3")}
        />
        <p className="tiny" style={{ color: "var(--muted-2)", marginBottom: 0, marginTop: 8 }}>
          {waterLogged.length
            ? `${waterLogged.filter((d) => d.value >= waterGoal).length} de ${waterLogged.length} días llegaste al objetivo.`
            : "Todavía no has apuntado agua en este periodo."}
        </p>
      </div>

      {/* --- pasos --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row-b" style={{ marginBottom: 10 }}>
          <div>
            <span className="eyebrow">Pasos 歩数</span>
            <div className="num" style={{ fontSize: 18, color: "var(--matcha)" }}>
              {stepsAvg.toLocaleString("es-ES")}
              <span className="tiny dim"> al día</span>
            </div>
          </div>
          <span className="tiny num dim">objetivo {stepsGoal.toLocaleString("es-ES")}</span>
        </div>
        <PixelChart
          data={stepData} target={stepsGoal} height={80}
          colorFor={(d) => (!d.value ? "var(--line-soft)" : d.value >= stepsGoal ? "var(--matcha)" : "#6f9c58")}
        />
        <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: "wrap" }}>
          <span className="tiny num dim">total {stepsTotal.toLocaleString("es-ES")} pasos</span>
          <span className="tiny num dim">≈ {walkTotal.km.toString().replace(".", ",")} km</span>
          {walkTotal.kcal ? <span className="tiny num dim">≈ {walkTotal.kcal} kcal</span> : null}
        </div>
        {stepsLogged.length > 0 && (
          <p className="tiny" style={{ color: "var(--muted-2)", marginBottom: 0, marginTop: 6 }}>
            {stepsAvg >= 8000
              ? "Buen nivel de actividad diaria: por encima de 8.000 pasos ya hay beneficio claro para la salud."
              : "Subir hacia los 7.000-8.000 pasos diarios es donde más se nota la mejora, según los estudios de mortalidad por actividad."}
          </p>
        )}
      </div>

      {/* --- peso --- */}
      <div className="px" style={{ padding: 14 }}>
        <div className="row-b">
          <div>
            <div className="eyebrow">Peso 体重</div>
            <div className="num" style={{ fontSize: 21 }}>
              {wLast ? `${wLast} kg` : "—"}
              {wDelta != null && wDelta !== 0 && (
                <span className="tiny" style={{ color: wDelta < 0 ? "var(--matcha)" : "var(--lantern)", marginLeft: 8 }}>
                  {wDelta > 0 ? "+" : ""}{wDelta} kg
                </span>
              )}
            </div>
          </div>
          <button className="btn btn-sm" onClick={() => { setW(wLast || profile.weight_kg || ""); setWeighIn(true); }}>Apuntar peso</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <PixelLine points={weightPoints} />
        </div>

        {goal.kg !== 0 && (
          <p className="tiny dim" style={{ marginBottom: 0 }}>
            Con el objetivo “{goal.label}” la previsión razonable es {goal.kg > 0 ? "+" : ""}{goal.kg} kg por semana.
            El peso oscila con líquidos y glucógeno: fíjate en la tendencia de dos semanas, no en el día.
          </p>
        )}

        {weights.length > 0 && (
          <details style={{ marginTop: 10 }}>
            <summary className="tiny dim" style={{ cursor: "pointer" }}>Ver todos los pesajes</summary>
            {weights.map((x) => (
              <div key={x.id} className="entry">
                <span className="grow tiny">{new Date(x.date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}</span>
                <span className="num tiny">{x.weight_kg} kg</span>
                <button className="icon-btn tiny" onClick={async () => { await deleteWeight(x.id); load(); }} aria-label="Borrar">✕</button>
              </div>
            ))}
          </details>
        )}
      </div>

      {loading && <div className="center tiny dim blink">cargando…</div>}

      <Sheet open={weighIn} onClose={() => setWeighIn(false)} title="Apuntar peso" jp="体重">
        <div className="stack">
          <div className="field">
            <label>Peso de hoy (kg)</label>
            <input className="input num" type="number" step="0.1" inputMode="decimal" value={w}
              onChange={(e) => setW(e.target.value)} autoFocus />
          </div>
          <p className="tiny dim">Pésate en ayunas, después del baño y sin ropa. Siempre en las mismas condiciones.</p>
          <button className="btn btn-primary btn-block" disabled={!Number(w)}
            onClick={async () => {
              await saveWeight(profile.id, isoDate(), Number(w));
              setWeighIn(false); toast("Peso apuntado"); load();
            }}>
            Guardar
          </button>
        </div>
      </Sheet>
    </div>
  );
}
