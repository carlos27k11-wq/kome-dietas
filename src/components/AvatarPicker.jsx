import React, { useState } from "react";
import { AVATAR_GROUPS } from "../lib/avatars";

/* ============================================================
   Elegir icono de perfil. Los emojis están agrupados por temas
   y se navega con las pestañas de arriba, así caben muchos sin
   convertirse en una pared de dibujos.
   ============================================================ */
export default function AvatarPicker({ value, onChange }) {
  const initial = Math.max(
    0,
    AVATAR_GROUPS.findIndex((g) => g.emojis.includes(value))
  );
  const [group, setGroup] = useState(initial);
  const g = AVATAR_GROUPS[group] || AVATAR_GROUPS[0];

  return (
    <div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {AVATAR_GROUPS.map((x, i) => (
          <button key={x.label} className="chip" data-on={group === i} onClick={() => setGroup(i)}>
            {x.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {g.emojis.map((e) => (
          <button
            key={e}
            className="chip center"
            data-on={value === e}
            aria-label={`Icono ${e}`}
            style={{ fontSize: 22, padding: "8px 0", lineHeight: 1.1 }}
            onClick={() => onChange(e)}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
