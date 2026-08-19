import React, { useState } from "react";
import { Sheet } from "./ui";
import { createProfile } from "../lib/store";

const EMOJIS = ["🍙", "🍣", "🐱", "🌸", "🍵", "🦊", "🌙", "🍜", "🐼", "🍡", "🐟", "🌿", "⛩️", "🍥", "🐧", "🍄"];
const COLORS = ["#f09bb6", "#f0c069", "#79b0dc", "#9cc97f", "#b98ce0", "#e5875e"];

/* Farolillos de píxel: fila decorativa sobre el título */
function Lanterns() {
  const items = [0, 1, 2, 3, 4];
  return (
    <svg viewBox="0 0 96 22" width="240" height="55" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="3" width="96" height="1" fill="#453c6b" />
      {items.map((i) => {
        const x = 6 + i * 20;
        const on = i % 2 === 0;
        return (
          <g key={i}>
            <rect x={x + 4} y="4" width="1" height="3" fill="#5c4230" />
            <rect x={x + 1} y="7" width="8" height="1" fill="#3a2b1f" />
            <rect x={x} y="8" width="10" height="8" fill={on ? "#e5875e" : "#4a3550"} />
            <rect x={x + 1} y="9" width="8" height="6" fill={on ? "#f0c069" : "#3a2f52"} />
            <rect x={x + 3} y="10" width="4" height="4" fill={on ? "#ffe6ad" : "#2f2647"} />
            <rect x={x + 1} y="16" width="8" height="1" fill="#3a2b1f" />
            <rect x={x + 4} y="17" width="2" height="2" fill={on ? "#e5875e" : "#4a3550"} />
          </g>
        );
      })}
    </svg>
  );
}

export default function ProfileGate({ profiles, onPick, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🍙");
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const p = await createProfile({
        name: name.trim(), avatar_emoji: emoji, color,
        sort_order: profiles.length,
      });
      setOpen(false); setName(""); setEmoji("🍙");
      onCreated(p);
    } finally { setBusy(false); }
  }

  return (
    <div className="gate">
      <div className="center">
        <Lanterns />
        <div className="kanji" style={{ marginTop: 6 }}>今日は誰が食べる</div>
        <h1 style={{ fontSize: 26, marginTop: 6 }}>¿Quién come hoy?</h1>
      </div>

      <div className="gate-grid">
        {profiles.map((p) => (
          <button key={p.id} className="gate-card" onClick={() => onPick(p)}>
            <div className="avatar drop" style={{ borderColor: p.color, background: "var(--panel)" }}>
              <span style={{ filter: "saturate(1.1)" }}>{p.avatar_emoji}</span>
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{p.name}</span>
          </button>
        ))}

        <button className="gate-card" onClick={() => setOpen(true)}>
          <div className="avatar" style={{ borderStyle: "dashed", fontSize: 30, color: "var(--muted-2)" }}>＋</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Nuevo</span>
        </button>
      </div>

      <p className="tiny" style={{ color: "var(--muted-2)", maxWidth: 340, textAlign: "center" }}>
        Cada perfil lleva su propio diario, sus objetivos y su peso. Las recetas son de toda la casa.
      </p>

      <Sheet open={open} onClose={() => setOpen(false)} title="Nuevo perfil" jp="新規">
        <div className="stack">
          <div className="row" style={{ justifyContent: "center" }}>
            <div className="avatar" style={{ borderColor: color }}>{emoji}</div>
          </div>
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Marta" autoFocus />
          </div>
          <div className="field">
            <label>Icono</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
              {EMOJIS.map((e) => (
                <button key={e} className="chip center" data-on={emoji === e} onClick={() => setEmoji(e)} style={{ fontSize: 18, padding: 6 }}>{e}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Color</label>
            <div className="row">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} aria-label={`Color ${c}`}
                  style={{ width: 34, height: 34, background: c, border: color === c ? "3px solid var(--washi)" : "3px solid var(--line)", cursor: "pointer" }} />
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-block" disabled={!name.trim() || busy} onClick={create}>
            {busy ? "Creando…" : "Crear perfil"}
          </button>
          <p className="tiny dim center">Después podrás poner altura, peso y objetivo para que calcule tus calorías.</p>
        </div>
      </Sheet>
    </div>
  );
}
