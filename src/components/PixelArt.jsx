import React, { useMemo } from "react";

/* ============================================================
   Motor de píxeles: un "mapa" es una lista de cadenas, un
   carácter por píxel. La paleta traduce carácter -> color.
   Se agrupan píxeles contiguos en un solo <rect> para no
   generar miles de nodos.
   ============================================================ */

export function pixelRects(map, palette, ox = 0, oy = 0, key = "s") {
  const out = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (!palette[ch]) { x++; continue; }
      let len = 1;
      while (x + len < row.length && row[x + len] === ch) len++;
      out.push(
        <rect key={`${key}-${x}-${y}`} x={ox + x} y={oy + y} width={len} height={1} fill={palette[ch]} />
      );
      x += len;
    }
  });
  return out;
}

export function Sprite({ map, palette, scale = 4, className, style, title }) {
  const w = Math.max(...map.map((r) => r.length));
  const h = map.length;
  const rects = useMemo(() => pixelRects(map, palette), [map, palette]);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * scale}
      height={h * scale}
      shapeRendering="crispEdges"
      className={className}
      style={style}
      role={title ? "img" : "presentation"}
      aria-label={title}
    >
      {rects}
    </svg>
  );
}

/* ---------------- sprites ---------------- */

const P = {
  k: "#1a1526", b: "#3f3757", B: "#544a75", w: "#ede4d3", p: "#f09bb6",
  g: "#9cc97f", G: "#6f9c58", t: "#7b5b3f", T: "#5c4230", y: "#f0c069",
  m: "#79b0dc", r: "#e5875e", n: "#2a2340", v: "#b98ce0",
};

export const CAT = [
  "................",
  "..kk........kk..",
  ".kbbk......kbbk.",
  ".kbBbkkkkkkbBbk.",
  "kbBBbbbbbbbbBBbk",
  "kbbkbbbbbbbbkbbk",
  "kbbbbbwwwwbbbbbk",
  ".kbbbwwwwwwbbbk.",
  "..kkkkkkkkkkkk..",
];

export const PLANT = [
  "..g...g..",
  ".gGg.gGg.",
  "..gGgGg..",
  "...gGg...",
  "....g....",
  ".ttttttt.",
  ".tTTTTTt.",
  "..tTTTt..",
  "..ttttt..",
];

export const TEACUP = [
  "..........",
  "..w....w..",
  "...w..w...",
  "..........",
  ".wwwwwww..",
  ".wmmmmmw.w",
  ".wmmmmmwww",
  "..wwwww.w.",
  "...www....",
];

export const ONIGIRI = [
  "....ww....",
  "...wwww...",
  "..wwwwww..",
  ".wwwwwwww.",
  ".wwkkkkww.",
  "wwwkkkkwww",
  "wwwkkkkwww",
  "wwwwwwwwww",
  ".kkkkkkkk.",
];

export const BOWL = [
  "..............",
  ".wwwwwwwwwwww.",
  "wwwwwwwwwwwwww",
  ".wwwwwwwwwwww.",
  "..wwwwwwwwww..",
  "...wwwwwwww...",
  "....wwwwww....",
  ".....wwww.....",
];

export const spritePalette = P;

export const Cat = (p) => <Sprite map={CAT} palette={P} {...p} />;
export const Plant = (p) => <Sprite map={PLANT} palette={P} {...p} />;
export const Teacup = (p) => <Sprite map={TEACUP} palette={P} {...p} />;
export const Onigiri = (p) => <Sprite map={ONIGIRI} palette={P} {...p} />;

/* ============================================================
   La ventana — el elemento firma de la app.
   Cambia con la hora del día, llueve por la noche y el gato
   aparece cuando cumples la proteína.
   ============================================================ */

const SKIES = {
  amanecer: { bands: ["#3b3157", "#6b5a86", "#c98aa0", "#f0b487"], orb: "#fce7bd", orbY: 20, glow: "#f0c069", city: "#241f3b", lit: "#f0c069", rain: false },
  dia:      { bands: ["#4e7fae", "#6ea3c9", "#9ccbe0", "#cfe7ee"], orb: "#fff4d0", orbY: 10, glow: "#ffffff", city: "#3a4a66", lit: "#cfe7ee", rain: false },
  atardecer:{ bands: ["#2c2547", "#6a4a77", "#c26a86", "#f09b6b"], orb: "#ffd9a0", orbY: 26, glow: "#e5875e", city: "#1f1b33", lit: "#f0c069", rain: false },
  noche:    { bands: ["#0f0d1c", "#171530", "#231f45", "#312a5c"], orb: "#e8e3ff", orbY: 12, glow: "#79b0dc", city: "#0b0917", lit: "#f0c069", rain: true },
};

export function dayPhase(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 9) return "amanecer";
  if (h >= 9 && h < 17) return "dia";
  if (h >= 17 && h < 20) return "atardecer";
  return "noche";
}

/* skyline determinista: mismas torres siempre */
const TOWERS = [
  [1, 22, 9], [10, 26, 7], [17, 18, 11], [28, 24, 8],
  [36, 15, 9], [45, 21, 7], [52, 27, 10],
];

export function WindowScene({ phase = "noche", showCat = false, kcalRatio = 0 }) {
  const s = SKIES[phase] || SKIES.noche;
  const W = 64, H = 44;

  const windows = [];
  TOWERS.forEach(([x, top, w], ti) => {
    for (let wy = top + 2; wy < 34; wy += 3) {
      for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        // patrón fijo pero irregular
        if ((wx * 7 + wy * 13 + ti * 5) % 4 === 0) {
          windows.push(<rect key={`w${wx}-${wy}`} x={wx} y={wy} width={1} height={1} fill={s.lit} opacity={phase === "dia" ? 0.25 : 0.9} />);
        }
      }
    }
  });

  const drops = [];
  if (s.rain) {
    for (let i = 0; i < 22; i++) {
      const x = (i * 11 + 3) % 60 + 2;
      const delay = ((i * 37) % 20) / 10;
      drops.push(
        <rect key={`d${i}`} x={x} y={-3} width={1} height={3} fill="#79b0dc" opacity={0.5}>
          <animate attributeName="y" from="-3" to="36" dur="1.1s" begin={`${delay}s`} repeatCount="indefinite" />
        </rect>
      );
    }
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" shapeRendering="crispEdges" style={{ display: "block" }} role="img" aria-label={`Ventana al ${phase}`}>
      {/* pared interior */}
      <rect x="0" y="0" width={W} height={H} fill="#1b1830" />

      {/* cielo por bandas */}
      <g clipPath="url(#winclip)">
        <rect x="4" y="3" width="56" height="9" fill={s.bands[0]} />
        <rect x="4" y="12" width="56" height="8" fill={s.bands[1]} />
        <rect x="4" y="20" width="56" height="7" fill={s.bands[2]} />
        <rect x="4" y="27" width="56" height="8" fill={s.bands[3]} />

        {/* astro */}
        <g>
          <rect x="45" y={s.orbY} width="6" height="6" fill={s.orb} />
          <rect x="44" y={s.orbY + 1} width="8" height="4" fill={s.orb} />
          <rect x="46" y={s.orbY - 1} width="4" height="8" fill={s.orb} />
          {phase === "noche" && <rect x="47" y={s.orbY + 1} width="3" height="3" fill="#c9c3e8" />}
        </g>

        {/* estrellas */}
        {phase === "noche" &&
          [[9, 7], [16, 5], [27, 9], [34, 6], [56, 8], [22, 14]].map(([x, y], i) => (
            <rect key={`st${i}`} x={x} y={y} width="1" height="1" fill="#ede4d3" opacity="0.8">
              <animate attributeName="opacity" values="0.25;0.9;0.25" dur={`${2 + (i % 3)}s`} repeatCount="indefinite" />
            </rect>
          ))}

        {/* skyline */}
        {TOWERS.map(([x, top, w], i) => (
          <rect key={`t${i}`} x={x} y={top} width={w} height={35 - top} fill={s.city} />
        ))}
        {windows}
        <rect x="4" y="33" width="56" height="2" fill={phase === "dia" ? "#2c3a52" : "#0e0c1c"} />
        {drops}
      </g>

      <defs>
        <clipPath id="winclip"><rect x="4" y="3" width="56" height="32" /></clipPath>
      </defs>

      {/* cristal: brillo diagonal */}
      <g opacity="0.10">
        <rect x="8" y="3" width="3" height="32" fill="#ffffff" />
        <rect x="14" y="3" width="1" height="32" fill="#ffffff" />
      </g>

      {/* marco de madera + travesaños (shoji) */}
      <g fill="#5c4230">
        <rect x="2" y="1" width="60" height="2" />
        <rect x="2" y="34" width="60" height="3" />
        <rect x="2" y="1" width="2" height="36" />
        <rect x="60" y="1" width="2" height="36" />
        <rect x="31" y="3" width="2" height="31" />
        <rect x="4" y="18" width="56" height="1" />
      </g>
      <g fill="#7b5b3f">
        <rect x="2" y="1" width="60" height="1" />
        <rect x="2" y="34" width="60" height="1" />
      </g>

      {/* alféizar */}
      <rect x="0" y="37" width={W} height="3" fill="#7b5b3f" />
      <rect x="0" y="37" width={W} height="1" fill="#96714f" />
      <rect x="0" y="40" width={W} height="4" fill="#241f3b" />

      {/* planta */}
      <g transform="translate(4,28)">{pixelRects(PLANT, P, 0, 0, "pl")}</g>

      {/* taza humeante */}
      <g transform="translate(52,28)">{pixelRects(TEACUP, P, 0, 0, "tc")}</g>

      {/* gato: aparece al cumplir proteína */}
      {showCat && (
        <g transform="translate(22,29)" opacity="0.98">
          {pixelRects(CAT, P, 0, 0, "ct")}
          <rect x="6" y="6" width="4" height="1" fill="#f09bb6" />
        </g>
      )}

      {/* farolillo colgante que se enciende según kcal consumidas */}
      <g>
        <rect x="18" y="0" width="1" height="4" fill="#5c4230" />
        <rect x="15" y="4" width="7" height="5" fill={kcalRatio > 0.15 ? "#e5875e" : "#4a3550"} />
        <rect x="16" y="3" width="5" height="1" fill="#3a2b1f" />
        <rect x="16" y="9" width="5" height="1" fill="#3a2b1f" />
        {kcalRatio > 0.15 && <rect x="16" y="5" width="5" height="3" fill="#f0c069" opacity={Math.min(1, 0.35 + kcalRatio)} />}
      </g>
    </svg>
  );
}

/* Cuenco que se llena: indicador de kcal del día */
export function RiceBowl({ ratio = 0, size = 3 }) {
  const level = Math.max(0, Math.min(1.15, ratio));
  const fillRows = Math.round(level * 5);
  const bowl = [];
  for (let y = 0; y < 8; y++) bowl.push("");
  return (
    <svg viewBox="0 0 16 12" width={16 * size} height={12 * size} shapeRendering="crispEdges" role="img" aria-label={`Cuenco al ${Math.round(level * 100)}%`}>
      {/* arroz */}
      {Array.from({ length: fillRows }).map((_, i) => {
        const y = 5 - i;
        const inset = Math.max(0, i - 1);
        return <rect key={i} x={3 + inset} y={y} width={10 - inset * 2} height={1} fill={level > 1 ? "#e5875e" : "#ede4d3"} />;
      })}
      {/* cuenco */}
      <g fill="#79b0dc">
        <rect x="1" y="6" width="14" height="1" />
        <rect x="2" y="7" width="12" height="1" />
        <rect x="3" y="8" width="10" height="1" />
        <rect x="4" y="9" width="8" height="1" />
        <rect x="6" y="10" width="4" height="1" />
      </g>
      <rect x="1" y="6" width="14" height="1" fill="#a8d0ec" />
    </svg>
  );
}
