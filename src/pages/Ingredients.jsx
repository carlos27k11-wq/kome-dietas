import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { Sheet } from "../components/ui";
import { ManualFood } from "../components/FoodFinder";
import { useTheme } from "../components/theme";
import { lookupBarcode } from "../lib/off";
import { listFoods, findFoodByBarcode, updateFood, deleteFood, saveFood } from "../lib/store";

// el lector de códigos pesa; solo se descarga cuando se abre la cámara
const BarcodeScanner = lazy(() => import("../components/BarcodeScanner"));

/* ============================================================
   La despensa: los ingredientes que hay en casa. Se meten
   escaneando el código de barras (o a mano cuando no tienen
   etiqueta) y luego se usan para montar las recetas.
   ============================================================ */

/* --- ficha para revisar o corregir un ingrediente ya guardado --- */
function EditFood({ food, onClose, onSaved, toast }) {
  const [f, setF] = useState(food);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const n = (v) => (v === "" || v == null ? null : Number(v));

  async function save() {
    setBusy(true);
    try {
      const saved = await updateFood(food.id, {
        name: f.name.trim(),
        brand: (f.brand || "").trim() || null,
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

        <div className="row">
          <div className="field grow"><label>Proteína</label><input className="input num" inputMode="decimal" value={f.protein_100 ?? ""} onChange={set("protein_100")} /></div>
          <div className="field grow"><label>Carbos</label><input className="input num" inputMode="decimal" value={f.carbs_100 ?? ""} onChange={set("carbs_100")} /></div>
          <div className="field grow"><label>Grasa</label><input className="input num" inputMode="decimal" value={f.fat_100 ?? ""} onChange={set("fat_100")} /></div>
        </div>
        <div className="row">
          <div className="field grow"><label>Kcal por 100 g</label><input className="input num" inputMode="decimal" value={f.kcal_100 ?? ""} onChange={set("kcal_100")} /></div>
          <div className="field grow"><label>Ración habitual (g)</label><input className="input num" inputMode="decimal" value={f.default_serving_g ?? ""} onChange={set("default_serving_g")} /></div>
        </div>
        <div className="row">
          <div className="field grow"><label>Fibra</label><input className="input num" inputMode="decimal" value={f.fiber_100 ?? ""} onChange={set("fiber_100")} /></div>
          <div className="field grow"><label>Azúcares</label><input className="input num" inputMode="decimal" value={f.sugars_100 ?? ""} onChange={set("sugars_100")} /></div>
        </div>
        <div className="row">
          <div className="field grow"><label>Saturadas</label><input className="input num" inputMode="decimal" value={f.sat_fat_100 ?? ""} onChange={set("sat_fat_100")} /></div>
          <div className="field grow"><label>Sodio (mg)</label><input className="input num" inputMode="decimal" value={f.sodium_100 ?? ""} onChange={set("sodium_100")} /></div>
        </div>

        {food.barcode && (
          <p className="tiny dim" style={{ margin: 0 }}>Código de barras: <span className="num">{food.barcode}</span></p>
        )}

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
