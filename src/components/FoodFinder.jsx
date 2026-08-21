import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useTheme } from "./theme";
import { searchOFF, lookupBarcode } from "../lib/off";
import { searchFoods, recentFoods, saveFood, findFoodByBarcode } from "../lib/store";
import { FoodRow, stripUi } from "./AddSheet";

// el lector pesa 300 kB; solo se carga si abres su pestaña
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));
// el lector de etiquetas se baja tesseract de internet; solo cuando se abre
const LabelScanner = lazy(() => import("./LabelScanner"));

const TABS = [
  { key: "buscar", label: "Buscar", jp: "探" },
  { key: "escanear", label: "Escanear", jp: "码" },
  { key: "manual", label: "A mano", jp: "手" },
];

/* ============================================================
   Alta manual: para lo que no está ni en la despensa ni en
   Open Food Facts. Se guarda en `foods`, así que queda para
   siempre y lo encuentran todos en la casa.

   Dos atajos para no teclear tanto:
   · escanear el código de barras — así el alimento queda
     guardado con su código y la próxima vez se encuentra
     apuntando con la cámara, sin buscarlo por el nombre;
   · leer la etiqueta con la cámara — saca los macros de la
     tabla de información nutricional. Todo queda editable,
     que el lector se equivoca.
   ============================================================ */
const DEL_LECTOR = [
  "kcal_100", "protein_100", "carbs_100", "fat_100",
  "fiber_100", "sugars_100", "sat_fat_100", "sodium_100", "default_serving_g",
];

export function ManualFood({ barcode = "", onSaved, onCancel }) {
  const [f, setF] = useState({
    name: "", brand: "", kcal_100: "", protein_100: "", carbs_100: "", fat_100: "",
    fiber_100: "", sugars_100: "", sat_fat_100: "", sodium_100: "", default_serving_g: 100,
  });
  const [code, setCode] = useState(barcode);
  const [detalle, setDetalle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  const [cam, setCam] = useState(false);       // cámara del código de barras
  const [scanKey, setScanKey] = useState(0);
  const [lector, setLector] = useState(false); // lector de la etiqueta
  const [leidos, setLeidos] = useState([]);    // lo que ha puesto la cámara

  useEffect(() => { setCode(barcode); }, [barcode]);

  const set = (k) => (e) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
    setLeidos((l) => l.filter((x) => x !== k));   // lo tocas tú, deja de estar en duda
  };
  const n = (v) => (v === "" || v == null ? null : Number(v));

  const kcalAuto = Math.round(
    (Number(f.protein_100) || 0) * 4 + (Number(f.carbs_100) || 0) * 4 + (Number(f.fat_100) || 0) * 9
  );
  const ok = f.name.trim() && (Number(f.kcal_100) > 0 || kcalAuto > 0);

  /* --- código de barras: lo guardamos con el alimento --- */
  const onCode = useCallback(async (c) => {
    if (!c) return;
    setCode(c);
    setCam(false);
    setAviso(`Código ${c} guardado.`);
    try {
      const yaEsta = await findFoodByBarcode(c);
      if (yaEsta) {
        setAviso(`Ojo: "${yaEsta.name}" ya está en la despensa con este código.`);
        return;
      }
      const found = await lookupBarcode(c);
      if (!found) return;
      // si Open Food Facts lo conoce, rellenamos lo que esté en blanco
      setF((p) => {
        const nuevo = { ...p };
        if (!p.name.trim()) nuevo.name = found.name || "";
        if (!p.brand.trim() && found.brand) nuevo.brand = found.brand;
        for (const k of DEL_LECTOR) {
          if ((nuevo[k] === "" || nuevo[k] == null) && found[k] != null) nuevo[k] = String(found[k]);
        }
        return nuevo;
      });
      setAviso(`Encontrado en Open Food Facts: ${found.name}. Repasa los valores.`);
    } catch {
      /* sin conexión: nos quedamos con el código y ya está */
    }
  }, []);

  /* --- lo que saca el lector de la etiqueta --- */
  const aplicarLectura = useCallback((vals) => {
    const puestos = DEL_LECTOR.filter((k) => vals[k] != null);
    setF((p) => {
      const nuevo = { ...p };
      for (const k of puestos) nuevo[k] = String(vals[k]);
      return nuevo;
    });
    setLeidos(puestos);
    if (puestos.some((k) => ["fiber_100", "sugars_100", "sat_fat_100", "sodium_100"].includes(k))) {
      setDetalle(true);
    }
    setLector(false);
    setAviso("Valores leídos de la etiqueta. Repásalos antes de guardar.");
  }, []);

  const num = (k, label, extra = null) => (
    <div className="field grow">
      <label>{label} {extra}</label>
      <input
        className={"input num" + (leidos.includes(k) ? " ocr" : "")}
        inputMode="decimal"
        value={f[k] ?? ""}
        onChange={set(k)}
      />
    </div>
  );

  async function guardar() {
    setBusy(true);
    setErr("");
    try {
      const saved = await saveFood({
        name: f.name.trim(),
        brand: f.brand.trim() || null,
        barcode: code || null,
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

      {/* --- código de barras --- */}
      <div className="px" style={{ padding: 10 }}>
        <div className="row-b">
          <div className="grow">
            <span className="eyebrow">Código de barras</span>
            <div className="num tiny">
              {code || <span className="dim">sin código — se puede escanear</span>}
            </div>
          </div>
          <button
            className={"btn btn-sm" + (code ? "" : " btn-primary")}
            onClick={() => { setCam((v) => !v); setScanKey((k) => k + 1); }}
          >
            {cam ? "✕" : code ? "📷 Otro" : "📷 Escanear"}
          </button>
        </div>
        {code && !cam && (
          <p className="tiny dim" style={{ margin: "6px 0 0" }}>
            Con el código guardado, la próxima vez lo encuentras apuntando con la cámara.
          </p>
        )}
        {cam && (
          <div style={{ marginTop: 8 }}>
            <Suspense fallback={<div className="empty tiny blink">abriendo la cámara…</div>}>
              <BarcodeScanner key={scanKey} onDetected={onCode} />
            </Suspense>
            <button className="btn btn-sm btn-block" onClick={() => setScanKey((k) => k + 1)}>
              Volver a escanear
            </button>
          </div>
        )}
      </div>

      {/* --- lector de la etiqueta --- */}
      {lector ? (
        <Suspense fallback={<div className="empty tiny blink">abriendo el lector…</div>}>
          <LabelScanner onValues={aplicarLectura} onClose={() => setLector(false)} />
        </Suspense>
      ) : (
        <button className="btn btn-block" onClick={() => setLector(true)}>
          📸 Leer la tabla nutricional
        </button>
      )}

      {aviso && <p className="tiny" style={{ color: "var(--kaki)", margin: 0 }}>{aviso}</p>}

      <div className="field">
        <label>Nombre</label>
        <input className="input" value={f.name} onChange={set("name")} placeholder="Tofu firme" />
      </div>
      <div className="field">
        <label>Marca <span className="dim">— opcional</span></label>
        <input className="input" value={f.brand} onChange={set("brand")} placeholder="Casa Ricardo" />
      </div>

      <div className="row">
        {num("protein_100", "Proteína")}
        {num("carbs_100", "Carbos")}
        {num("fat_100", "Grasa")}
      </div>

      {num("kcal_100", "Kcal por 100 g", kcalAuto > 0 ? <span className="dim">— calculadas: {kcalAuto}</span> : null)}

      <button className="btn btn-sm btn-ghost btn-block" onClick={() => setDetalle((d) => !d)}>
        {detalle ? "▴ Menos detalle" : "▾ Fibra, azúcares, saturadas y sodio"}
      </button>

      {detalle && (
        <>
          <div className="row">
            {num("fiber_100", "Fibra")}
            {num("sugars_100", "Azúcares")}
          </div>
          <div className="row">
            {num("sat_fat_100", "Saturadas")}
            {num("sodium_100", "Sodio (mg)")}
          </div>
        </>
      )}

      {num("default_serving_g", "Ración habitual (g)")}

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
  const { jpLabel } = useTheme();
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
            {jpLabel(t.jp, t.label)}
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
