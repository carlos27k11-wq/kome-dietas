/* ============================================================
   Temas de la app.

   - "kome"  : el original, lofi japonés, oscuro y con píxeles.
   - "claro" : pensado para leerse fácil. Fondo claro, letras
               casi negras, tipografía más grande, sin palabras
               en japonés y sin adornos que estorben.

   El tema se guarda en el perfil (columna `theme` de la tabla
   `profiles`), así que cada persona de la casa entra y ve el
   suyo. Se copia también a localStorage para que la pantalla de
   arranque y la de elegir perfil no den un fogonazo del tema
   que no toca.
   ============================================================ */

import React, { createContext, useContext } from "react";

export const THEMES = [
  {
    key: "kome",
    label: "Kome",
    hint: "El original: oscuro, con píxeles y detalles japoneses.",
    swatch: ["#14121f", "#f09bb6", "#ede4d3"],
  },
  {
    key: "claro",
    label: "Claro y grande",
    hint: "Fondo blanco, letras grandes y muy contrastadas. Sin japonés.",
    swatch: ["#f4f3f0", "#a3145a", "#15171b"],
  },
];

export const DEFAULT_THEME = "kome";
export const THEME_KEY = "kome:theme";

export function normalizeTheme(t) {
  return THEMES.some((x) => x.key === t) ? t : DEFAULT_THEME;
}

/** Lo que guardamos en el navegador para arrancar sin parpadeo */
export function readStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, normalizeTheme(theme));
  } catch {
    /* modo incógnito o almacenamiento bloqueado: da igual */
  }
}

/** Pinta el tema en el <html> para que el CSS haga el resto */
export function applyTheme(theme) {
  const t = normalizeTheme(theme);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "claro" ? "#f4f3f0" : "#14121f");
  }
  return t;
}

const ThemeCtx = createContext(DEFAULT_THEME);

export function ThemeProvider({ theme, children }) {
  return <ThemeCtx.Provider value={normalizeTheme(theme)}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeCtx);
  const claro = theme === "claro";
  return {
    theme,
    claro,
    /** Texto japonés: desaparece en el tema claro */
    jp: (s) => (claro ? "" : s),
    /** Etiqueta de pestaña o chip: "全 Todas" o solo "Todas" */
    jpLabel: (jpText, label) => (claro ? label : `${jpText} ${label}`),
  };
}

/** Línea decorativa en japonés; en el tema claro no se pinta */
export function Jp({ children, style }) {
  const { claro } = useTheme();
  if (claro || !children) return null;
  return <div className="kanji" style={style}>{children}</div>;
}
