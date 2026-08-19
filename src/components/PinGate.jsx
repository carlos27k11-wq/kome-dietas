import React, { useCallback, useEffect, useState } from "react";

/* Candado de la casa.
   Guardamos el hash y no el PIN, porque el repositorio es público: así el
   número no se lee de un vistazo en el código. No es un secreto de verdad
   (seis cifras se prueban en un suspiro), solo evita que entre quien pase
   por delante de la dirección. La puerta de verdad son las políticas de
   Supabase. */
const PIN_SHA256 = "cd789026f212d705f94071aab10c947378f800b59ef4d414541588439b8461ed";
const PIN_LEN = 6;
const STORE_KEY = "kome:desbloqueado";

export function lock() {
  localStorage.removeItem(STORE_KEY);
  location.reload();
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* Farolillo apagado que se enciende al acertar */
function Lock({ open }) {
  return (
    <svg viewBox="0 0 16 20" width="80" height="100" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="4" y={open ? 1 : 3} width="1" height="6" fill="#6f6693" />
      <rect x="4" y={open ? 1 : 3} width="7" height="1" fill="#6f6693" />
      <rect x={open ? 11 : 10} y={open ? 2 : 4} width="1" height={open ? 5 : 4} fill="#6f6693" />
      <rect x="2" y="8" width="12" height="10" fill={open ? "#f0c069" : "#2e2749"} />
      <rect x="3" y="9" width="10" height="8" fill={open ? "#ffe6ad" : "#241f3b"} />
      <rect x="7" y="11" width="2" height="3" fill={open ? "#5c4230" : "#453c6b"} />
      <rect x="7" y="13" width="2" height="2" fill={open ? "#5c4230" : "#453c6b"} />
    </svg>
  );
}

export default function PinGate({ children }) {
  const [ok, setOk] = useState(() => localStorage.getItem(STORE_KEY) === PIN_SHA256);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [abriendo, setAbriendo] = useState(false);

  const push = useCallback((d) => {
    setError(false);
    setPin((p) => (p.length >= PIN_LEN ? p : p + d));
  }, []);

  const back = useCallback(() => {
    setError(false);
    setPin((p) => p.slice(0, -1));
  }, []);

  useEffect(() => {
    if (ok || pin.length < PIN_LEN) return;
    let vivo = true;
    sha256(pin).then((h) => {
      if (!vivo) return;
      if (h === PIN_SHA256) {
        localStorage.setItem(STORE_KEY, h);
        setAbriendo(true);
        setTimeout(() => setOk(true), 420);
      } else {
        setError(true);
        setTimeout(() => setPin(""), 500);
      }
    });
    return () => { vivo = false; };
  }, [pin, ok]);

  useEffect(() => {
    if (ok) return;
    const onKey = (e) => {
      if (/^[0-9]$/.test(e.key)) push(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ok, push, back]);

  if (ok) return children;

  return (
    <div className="gate">
      <div className="center">
        <Lock open={abriendo} />
        <div className="kanji" style={{ marginTop: 10 }}>合言葉</div>
        <h1 style={{ fontSize: 24, marginTop: 6 }}>La casa está cerrada</h1>
        <p className="tiny" style={{ color: "var(--muted-2)", marginTop: 6 }}>
          Marca el número de la familia
        </p>
      </div>

      <div className="pin-dots" data-error={error}>
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <span key={i} className="pin-dot" data-on={i < pin.length} />
        ))}
      </div>

      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} className="pin-key" onClick={() => push(d)}>{d}</button>
        ))}
        <span />
        <button className="pin-key" onClick={() => push("0")}>0</button>
        <button className="pin-key pin-key-ghost" onClick={back} aria-label="Borrar">←</button>
      </div>

      <p className="tiny" style={{ color: error ? "var(--kaki)" : "var(--muted-2)", minHeight: 18 }}>
        {error ? "No es ese. Prueba otra vez." : "Este aparato lo recordará."}
      </p>
    </div>
  );
}
