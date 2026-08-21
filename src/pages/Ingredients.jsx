import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Sheet } from "../components/ui";
import { ManualFood } from "../components/FoodFinder";
import { useTheme } from "../components/theme";
import { lookupBarcode } from "../lib/off";
import { listFoods, findFoodByBarcode, updateFood, deleteFood, saveFood } from "../lib/store";

// el lector de códigos pesa; solo se descarga cuando se abre la cámara
const BarcodeScanner = lazy(() => import("../components/BarcodeScanner"));
// el lector de etiquetas se baja tesseract de internet; solo cuando se abre
const LabelScanner = lazy(() => import("../components/LabelScanner"));

/* ============================================================
   La despensa: los ingredientes que hay en casa. Se meten
   escaneando el código de barras (o a mano cuando no tienen
   etiqueta) y luego se usan para montar las recetas.
   ============================================================ */

/* --- ficha para revisar o corregir un ingrediente ya guardado --- */
const DEL_LECTOR = [
  "kcal_100", "protein_100", "carbs_100", "fat_100",
  "fiber_100", "sugars_100", "sat_fat_100", "sodium_100", "default_serving_g",
];

function EditFood({ food, onClose, onSaved, toast }) {
  const [f, setF] = useState(food);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(food.barcode || "");
  const [cam, setCam] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [lector, setLector] = useState(false);
  const [leidos, setLeidos] = useState([]);
  const [aviso, setAviso] = useState("");

  const set = (k) => (e) => {
    setF((p) => ({ ...p, [k]: e.target.value }));
    setLeidos((l) => l.filter((x) => x !== k));
  };
  const n = (v) => (v === "" || v == null ? null : Number(v));

  const num = (k, label) => (
    <div className="field grow">
      <label>{label}</label>
      <input
        className={"input num" + (leidos.includes(k) ? " ocr" : "")}
        inputMode="decimal"
        value={f[k] ?? ""}
        onChange={set(k)}
      />
    </div>
  );

  const aplicarLectura = useCallback((vals) => {
    const puestos = DEL_LECTOR.filter((k) => vals[k] != null);
    setF((p) => {
      const nuevo = { ...p };
      for (const k of puestos) nuevo[k] = String(vals[k]);
      return nuevo;
    });
    setLeidos(puestos);
    setLector(false);
    setAviso("Valores leídos de la etiqueta. Repásalos antes de guardar.");
  }, []);

  const onCode = useCallback(async (c) => {
    if (!c) return;
    setCam(false);
    try {
      const otro = await findFoodByBarcode(c);
      if (otro && otro.id !== food.id) {
        setAviso(`Ese código ya es de "${otro.name}".`);
        return;
      }
    } catch { /* seguimos */ }
    setCode(c);
    setAviso(`Código ${c} listo. Guarda los cambios para dejarlo puesto.`);
  }, [food.id]);

  async function save() {
    setBusy(true);
    try {
      const saved = await updateFood(food.id, {
        name: f.name.trim(),
        brand: (f.brand || "").trim() || null,
        barcode: code || null,
        kcal_100: Number(f.kcal_100) || 0,
        protein_100: Number(f.protein_100) || 0,
        carbs_100: Number(f.carbs_100) || 0,
        fat_100: Number(f.fat_100) || 0,
        fiber_100: n(f.fiber_100),
        sugars_100: n(f.sugars_100),
        sat_fat_100: n(f.sat_fat_100),
        sodium_100: n(f.sodium_100),
        default_serving_g: Number(f.default_serving_g) || 100,
      });
      toast("Ingrediente actualizado");
      onSaved(saved);
    } catch {
      toast("No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={food.name} jp="材料">
      <div className="stack">
        <p className="tiny dim" style={{ margin: 0 }}>Los valores son por 100 g, como en la etiqueta.</p>

        <div className="field">
          <label>Nombre</label>
          <input className="input" value={f.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label>Marca</label>
          <input className="input" value={f.brand || ""} onChange={set("brand")} />
        </div>

        {/* volver a leer la etiqueta con la cámara */}
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

        <div className="row">
          {num("protein_100", "Proteína")}
          {num("carbs_100", "Carbos")}
          {num("fat_100", "Grasa")}
        </div>
        <div className="row">
          {num("kcal_100", "Kcal por 100 g")}
          {num("default_serving_g", "Ración habitual (g)")}
        </div>
        <div className="row">
          {num("fiber_100", "Fibra")}
          {num("sugars_100", "Azúcares")}
        </div>
        <div className="row">
          {num("sat_fat_100", "Saturadas")}
          {num("sodium_100", "Sodio (mg)")}
        </div>

        {/* código de barras: para encontrarlo con la cámara */}
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

        <button className="btn btn-primary btn-block" disabled={busy || !f.name.trim()} onClick={save}>
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          className="btn btn-ghost btn-block btn-sm"
          onClick={async () => {
            if (!confirm(`¿Quitar "${food.name}" de la despensa? Las recetas que lo lleven mantienen sus valores.`)) return;
            try {
              await deleteFood(food.id);
              toast("Ingrediente borrado");
              onSaved(null);
            } catch {
              toast("No se pudo borrar");
            }
          }}
        >
          Borrar ingrediente
        </button>
      </div>
    </Sheet>
  );
}

/* --- alta escaneando el código de barras --- */
function ScanNew({ open, onClose, onSaved, toast }) {
  const [phase, setPhase] = useState("camara"); // camara | manual
  const [barcode, setBarcode] = useState("");
  const [msg, setMsg] = useState("");
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setPhase("camara"); setBarcode(""); setMsg(""); setScanKey((k) => k + 1); }
  }, [open]);

  const onDetected = useCallback(async (code) => {
    if (!code || busy) return;
    setBusy(true);
    setMsg(`Leyendo el código ${code}…`);
    try {
      const yaEsta = await findFoodByBarcode(code);
      if (yaEsta) {
        setMsg(`"${yaEsta.name}" ya está en la despensa.`);
        setBusy(false);
        return;
      }
      const found = await lookupBarcode(code);
      if (found) {
        const { nutriscore, nova, ...limpio } = found;
        const saved = await saveFood(limpio);
        toast(`Añadido: ${saved.name}`);
        onSaved(saved);
        return;
      }
      // no está en ninguna base: se rellena a mano con el código ya puesto
      setBarcode(code);
      setMsg("");
      setPhase("manual");
    } catch {
      setMsg("Fallo al consultar el código. Prueba otra vez.");
    } finally {
      setBusy(false);
    }
  }, [busy, onSaved, toast]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={phase === "manual" ? "Rellena la etiqueta" : "Escanear ingrediente"}
      jp="材料"
    >
      {phase === "manual" ? (
        <ManualFood
          barcode={barcode}
          onCancel={() => { setPhase("camara"); setScanKey((k) => k + 1); }}
          onSaved={(food) => { toast(`Añadido: ${food.name}`); onSaved(food); }}
        />
      ) : (
        <div className="stack">
          <p className="tiny dim" style={{ margin: 0 }}>
            Apunta con la cámara al código de barras del producto. Si está en Open Food Facts se
            guarda solo con todos sus valores; si no, te dejo rellenar la etiqueta a mano.
          </p>
          <Suspense fallback={<div className="empty tiny blink">abriendo la cámara…</div>}>
            <BarcodeScanner key={scanKey} onDetected={onDetected} />
          </Suspense>
          {msg && <p className="tiny" style={{ color: "var(--kaki)", margin: 0 }}>{msg}</p>}
          <div className="row">
            <button className="btn grow" onClick={() => { setScanKey((k) => k + 1); setMsg(""); }}>
              Volver a escanear
            </button>
            <button className="btn grow" onClick={() => { setBarcode(""); setPhase("manual"); }}>
              Meterlo a mano
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ---------------- pestaña ---------------- */
export default function IngredientsTab({ toast }) {
  const { jp } = useTheme();
  const [q, setQ] = useState("");
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async (term = "") => {
    setLoading(true);
    try { setFoods(await listFoods(term)); }
    catch { toast("No se pudo cargar la despensa"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => load(q), q ? 320 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary grow" onClick={() => setScanning(true)}>
          📷 Escanear código
        </button>
        <button className="btn grow" onClick={() => setManual(true)}>
          ✎ A mano
        </button>
      </div>

      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en la despensa…"
      />

      {!loading && !foods.length && (
        <div className="empty">
          <div style={{ fontSize: 34 }}>🥫</div>
          <p className="tiny">
            {q.trim()
              ? "Ningún ingrediente con ese nombre."
              : "La despensa está vacía. Escanea el código de barras de lo que tengas en casa y quedará guardado para las recetas."}
          </p>
        </div>
      )}

      {foods.length > 0 && (
        <div className="eyebrow">{foods.length} ingredientes {jp("材料")}</div>
      )}

      {foods.map((f) => (
        <button
          key={f.id}
          className="px"
          onClick={() => setEditing(f)}
          style={{
            display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left",
            padding: 10, marginBottom: 8, cursor: "pointer", color: "inherit",
          }}
        >
          {f.image_url ? (
            <img src={f.image_url} alt="" width={44} height={44} style={{ objectFit: "cover", background: "var(--night)" }} loading="lazy" />
          ) : (
            <div style={{ width: 44, height: 44, background: "var(--night)", display: "grid", placeItems: "center", fontSize: 20 }}>🥄</div>
          )}
          <div className="grow">
            <div style={{ fontSize: 15, lineHeight: 1.25 }}>{f.name}</div>
            <div className="tiny dim">
              {f.brand ? `${f.brand} · ` : ""}
              <span className="num">{Math.round(f.kcal_100)} kcal/100 g</span>
              {" · "}
              <span className="num">P{Math.round(f.protein_100)} C{Math.round(f.carbs_100)} G{Math.round(f.fat_100)}</span>
            </div>
          </div>
          <span className="dim">›</span>
        </button>
      ))}

      {loading && <div className="center tiny dim blink">cargando…</div>}

      <ScanNew
        open={scanning}
        onClose={() => setScanning(false)}
        toast={toast}
        onSaved={() => { setScanning(false); load(q); }}
      />

      <Sheet open={manual} onClose={() => setManual(false)} title="Nuevo ingrediente" jp="材料">
        <ManualFood
          onCancel={() => setManual(false)}
          onSaved={(food) => { toast(`Añadido: ${food.name}`); setManual(false); load(q); }}
        />
      </Sheet>

      {editing && (
        <EditFood
          food={editing}
          toast={toast}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(q); }}
        />
      )}
    </div>
  );
}
