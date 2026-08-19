import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { searchOFF, lookupBarcode } from "../lib/off";
import { searchFoods, recentFoods, saveFood, findFoodByBarcode } from "../lib/store";
import { FoodRow, stripUi } from "./AddSheet";

// el lector pesa 300 kB; solo se carga si abres su pestaña
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));

const TABS = [
  { key: "buscar", label: "Buscar", jp: "探" },
  { key: "escanear", label: "Escanear", jp: "码" },
  { key: "manual", label: "A mano", jp: "手" },
];

/* ============================================================
   Alta manual: para lo que no está ni en la despensa ni en
   Open Food Facts. Se guarda en `foods`, así que queda para
   siempre y lo encuentran todos en la casa.
   ============================================================ */
export function ManualFood({ barcode = "", onSaved, onCancel }) {
  const [f, setF] = useState({
    name: "", brand: "", kcal_100: "", protein_100: "", carbs_100: "", fat_100: "",
    fiber_100: "", sugars_100: "", sat_fat_100: "", sodium_100: "", default_serving_g: 100,
  });
  const [detalle, setDetalle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const n = (v) => (v === "" || v == null ? null : Number(v));

  const kcalAuto = Math.round(
    (Number(f.protein_100) || 0) * 4 + (Number(f.carbs_100) || 0) * 4 + (Number(f.fat_100) || 0) * 9
  );
  const ok = f.name.trim() && (Number(f.kcal_100) > 0 || kcalAuto > 0);

  async function guardar() {
    setBusy(true);
    setErr("");
    try {
      const saved = await saveFood({
        name: f.name.trim(),
        brand: f.brand.trim() || null,
        barcode: barcode || null,
        source: "manual",
        kcal_100: Number(f.kcal_100) || kcalAuto,
        protein_100: Number(f.protein_100) || 0,
        carbs_100: Number(f.carbs_100) || 0,
        fat_100: Number(f.fat_100) || 0,
        fiber_100: n(f.fiber_100),
        sugars_100: n(f.sugars_100),
        sat_fat_100: n(f.sat_fat_100),
        sodium_100: n(f.sodium_100),
        default_serving_g: Number(f.default_serving_g) || 100,
      });
      onSaved(saved);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar el alimento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p className="tiny dim" style={{ margin: 0 }}>
        Los valores son <strong>por 100 g</strong>, como vienen en la etiqueta. Queda guardado
        para toda la casa.
      </p>

      {barcode && (
        <div className="px" style={{ padding: 8 }}>
          <span className="eyebrow">Código escaneado</span>
          <div className="num tiny">{barcode}</div>
        </div>
      )}

      <div className="field">
        <label>Nombre</label>
        <input className="input" value={f.name} onChange={set("name")} placeholder="Tofu firme" autoFocus />
      </div>
      <div className="field">
        <label>Marca <span className="dim">— opcional</span></label>
        <input className="input" value={f.brand} onChange={set("brand")} placeholder="Casa Ricardo" />
      </div>

      <div className="row">
        <div className="field grow"><label>Proteína</label><input className="input num" inputMode="decimal" value={f.protein_100} onChange={set("protein_100")} /></div>
        <div className="field grow"><label>Carbos</label><input className="input num" inputMode="decimal" value={f.carbs_100} onChange={set("carbs_100")} /></div>
        <div className="field grow"><label>Grasa</label><input className="input num" inputMode="decimal" value={f.fat_100} onChange={set("fat_100")} /></div>
      </div>

      <div className="field">
        <label>Kcal por 100 g {kcalAuto > 0 && <span className="dim">— calculadas: {kcalAuto}</span>}</label>
        <input className="input num" inputMode="decimal" value={f.kcal_100} onChange={set("kcal_100")} placeholder={kcalAuto || "0"} />
      </div>

      <button className="btn btn-sm btn-ghost btn-block" onClick={() => setDetalle((d) => !d)}>
        {detalle ? "▴ Menos detalle" : "▾ Fibra, azúcares, saturadas y sodio"}
      </button>

      {detalle && (
        <>
          <div className="row">
            <div className="field grow"><label>Fibra</label><input className="input num" inputMode="decimal" value={f.fiber_100} onChange={set("fiber_100")} /></div>
            <div className="field grow"><label>Azúcares</label><input className="input num" inputMode="decimal" value={f.sugars_100} onChange={set("sugars_100")} /></div>
          </div>
          <div className="row">
            <div className="field grow"><label>Saturadas</label><input className="input num" inputMode="decimal" value={f.sat_fat_100} onChange={set("sat_fat_100")} /></div>
            <div className="field grow"><label>Sodio (mg)</label><input className="input num" inputMode="decimal" value={f.sodium_100} onChange={set("sodium_100")} /></div>
          </div>
        </>
      )}

      <div className="field">
        <label>Ración habitual (g)</label>
        <input className="input num" inputMode="decimal" value={f.default_serving_g} onChange={set("default_serving_g")} />
      </div>

      {err && <p className="tiny" style={{ color: "var(--kaki)" }}>{err}</p>}

      <div className="row">
        {onCancel && <button className="btn btn-ghost" onClick={onCancel}>Volver</button>}
        <button className="btn btn-primary grow" disabled={!ok || busy} onClick={guardar}>
          {busy ? "Guardando…" : "Guardar alimento"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Buscador completo: pestañas de buscar, escanear y crear.
   Devuelve el alimento elegido por onPick; quien lo use decide
   qué hacer con él (ración, ingrediente, lista de la compra).
   ============================================================ */
export default function FoodFinder({ onPick, placeholder = "Busca un alimento…" }) {
  const [tab, setTab] = useState("buscar");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState([]);
  const [off, setOff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");

  useEffect(() => {
    recentFoods(8).then(setMine).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== "buscar") return;
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
          searchFoods(term, 8).catch(() => []),
          searchOFF(term, { signal: ctrl.signal }).catch(() => []),
        ]);
        setMine(local);
        const codes = new Set(local.map((f) => f.barcode).filter(Boolean));
        setOff(remote.filter((r) => !codes.has(r.barcode)));
      } finally {
        setLoading(false);
      }
    }, 420);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, tab]);

  const onScan = useCallback(async (code) => {
    if (!code) return;
    setScanMsg(`Buscando ${code}…`);
    try {
      const local = await findFoodByBarcode(code);
      if (local) { onPick(local); return; }
      const found = await lookupBarcode(code);
      if (found) { onPick(found); return; }
      setScanBarcode(code);
      setScanMsg("");
      setTab("manual");
    } catch {
      setScanMsg("Fallo al consultar el código. Prueba otra vez.");
    }
  }, [onPick]);

  return (
    <div className="stack">
      <div className="chips">
        {TABS.map((t) => (
          <button key={t.key} className="chip" data-on={tab === t.key}
            onClick={() => { setTab(t.key); setScanMsg(""); }}>
            {t.jp} {t.label}
          </button>
        ))}
      </div>

      {tab === "buscar" && (
        <>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
          {loading && <div className="tiny dim center blink">buscando…</div>}

          <div style={{ maxHeight: "42vh", overflowY: "auto" }}>
            {mine.length > 0 && (
              <>
                <div className="eyebrow">{q.trim().length < 2 ? "Lo que más usáis" : "En vuestra despensa"}</div>
                {mine.map((f) => <FoodRow key={f.id} food={f} onPick={onPick} />)}
              </>
            )}
            {off.length > 0 && (
              <>
                <div className="eyebrow">Open Food Facts</div>
                {off.map((f, i) => <FoodRow key={f.barcode || i} food={f} badge="nuevo" onPick={onPick} />)}
              </>
            )}
          </div>

          {!loading && q.trim().length >= 2 && !mine.length && !off.length && (
            <div className="empty tiny">
              Sin resultados.
              <button className="btn btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => setTab("manual")}>
                Crearlo a mano
              </button>
            </div>
          )}
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

      {tab === "manual" && (
        <ManualFood
          barcode={scanBarcode}
          onSaved={(food) => { setScanBarcode(""); onPick(food); }}
        />
      )}
    </div>
  );
}

export { stripUi };
