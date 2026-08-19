import React, { useEffect, useRef } from "react";

/* -------- hoja modal -------- */
export function Sheet({ open, onClose, title, jp, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head row-b">
          <div>
            {jp && <div className="kanji">{jp}</div>}
            <h2 style={{ fontSize: 19 }}>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* -------- barra segmentada -------- */
export function PixelBar({ value, max, color = "var(--washi)", height }) {
  const ratio = max > 0 ? value / max : 0;
  const over = ratio > 1.02;
  return (
    <div className="pxbar" data-over={over} style={{ "--fill": `${Math.min(100, ratio * 100)}%`, "--c": color, height }}>
      <i />
    </div>
  );
}

/* -------- macro con barra -------- */
export function MacroBar({ label, value, target, unit = "g", color }) {
  const left = Math.round((target || 0) - value);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="row-b" style={{ marginBottom: 4 }}>
        <span className="eyebrow" style={{ color }}>{label}</span>
        <span className="num tiny">
          {Math.round(value)}<span className="dim">/{Math.round(target || 0)}{unit}</span>
        </span>
      </div>
      <PixelBar value={value} max={target} color={color} />
      <div className="num" style={{ fontSize: 9, color: "var(--muted-2)", marginTop: 3 }}>
        {left >= 0 ? `faltan ${left}${unit}` : `+${Math.abs(left)}${unit}`}
      </div>
    </div>
  );
}

/* -------- aviso / consejo -------- */
export function Insight({ tone, text }) {
  const c = tone === "good" ? "var(--matcha)" : tone === "warn" ? "var(--kaki)" : "var(--mizu)";
  return (
    <div className="row" style={{ alignItems: "flex-start", gap: 8, padding: "6px 0" }}>
      <span style={{ color: c, fontFamily: "var(--font-num)", fontSize: 11, marginTop: 2 }}>
        {tone === "good" ? "◆" : "▲"}
      </span>
      <span className="tiny" style={{ color: "var(--muted)" }}>{text}</span>
    </div>
  );
}

/* -------- toast -------- */
export function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

/* -------- gráfico de barras de píxeles -------- */
export function PixelChart({ data, target, height = 96, colorFor }) {
  const max = Math.max(target * 1.25, ...data.map((d) => d.value), 1);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, position: "relative" }}>
        {target > 0 && (
          <div
            aria-hidden
            style={{
              position: "absolute", left: 0, right: 0, bottom: `${(target / max) * 100}%`,
              borderTop: "2px dashed var(--line)", pointerEvents: "none",
            }}
          />
        )}
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * 100);
          return (
            <div key={i} className="grow" style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }} title={`${d.label}: ${Math.round(d.value)}`}>
              <div
                style={{
                  height: `${h}%`,
                  background: colorFor ? colorFor(d) : "var(--sakura)",
                  backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 6px)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
        {data.map((d, i) => (
          <div key={i} className="grow num center" style={{ fontSize: 9, color: "var(--muted-2)" }}>{d.short}</div>
        ))}
      </div>
    </div>
  );
}

/* -------- línea de peso -------- */
export function PixelLine({ points, height = 100 }) {
  if (points.length < 2) return <div className="empty tiny">Apunta tu peso al menos dos veces para ver la tendencia.</div>;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys) - 0.5, max = Math.max(...ys) + 0.5;
  const W = 100, H = 40;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - ((p.y - min) / (max - min || 1)) * H,
  ]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" shapeRendering="crispEdges" role="img" aria-label="Evolución del peso">
      <polyline
        points={coords.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none" stroke="var(--matcha)" strokeWidth="1.5"
      />
      {coords.map(([x, y], i) => (
        <rect key={i} x={x - 1} y={y - 1} width="2.4" height="2.4" fill="var(--washi)" />
      ))}
    </svg>
  );
}
