import React, { useCallback, useEffect, useState } from "react";
import ProfileGate from "./components/ProfileGate";
import Today from "./pages/Today";
import RecipesPage from "./pages/Recipes";
import Progress from "./pages/Progress";
import Plan from "./pages/Plan";
import ProfilePage from "./pages/Profile";
import { Toast } from "./components/ui";
import { ThemeProvider, applyTheme, readStoredTheme, storeTheme, normalizeTheme } from "./components/theme";
import { listProfiles, listRecipes } from "./lib/store";

const TABS = [
  { key: "hoy", label: "Hoy", jp: "今日" },
  { key: "recetas", label: "Recetas", jp: "献立" },
  { key: "plan", label: "Plan", jp: "予定" },
  { key: "registro", label: "Registro", jp: "記録" },
  { key: "perfil", label: "Perfil", jp: "設定" },
];

const STORE_KEY = "kome:profile";

export default function App() {
  const [profiles, setProfiles] = useState([]);
  const [profile, setProfile] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [tab, setTab] = useState("hoy");
  const [msg, setMsg] = useState("");
  const [boot, setBoot] = useState("cargando");
  const [bootError, setBootError] = useState(null);
  // el tema vive en el perfil; hasta que se elige uno, el último que se usó
  const [theme, setTheme] = useState(readStoredTheme);

  // El tema del perfil manda; se guarda también en el navegador para
  // que la próxima vez arranque directamente con el correcto.
  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  const toast = useCallback((text) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  }, []);

  const loadRecipes = useCallback(() => {
    listRecipes().then(setRecipes).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ps = await listProfiles();
        setProfiles(ps);
        const saved = localStorage.getItem(STORE_KEY);
        const found = ps.find((p) => p.id === saved);
        if (found) { setProfile(found); setTheme(normalizeTheme(found.theme)); }
        setBoot("listo");
      } catch (e) {
        console.error(e);
        setBootError(e);
        setBoot("error");
      }
    })();
    loadRecipes();
  }, [loadRecipes]);

  const pick = (p) => {
    setProfile(p);
    setTheme(normalizeTheme(p.theme));
    localStorage.setItem(STORE_KEY, p.id);
    setTab("hoy");
  };

  const refreshProfiles = async () => {
    const ps = await listProfiles();
    setProfiles(ps);
    return ps;
  };

  const claro = theme === "claro";

  if (boot === "cargando") {
    return (
      <ThemeProvider theme={theme}>
        <div className="gate">
          {claro
            ? <div className="dim blink" style={{ fontSize: 18 }}>Cargando…</div>
            : <div className="kanji blink">読み込み中…</div>}
        </div>
      </ThemeProvider>
    );
  }

  if (boot === "error") {
    const isFile = typeof location !== "undefined" && location.protocol === "file:";
    const detail = bootError?.message || bootError?.error_description || String(bootError || "");
    const isNetwork = /load failed|failed to fetch|networkerror|network request/i.test(detail);
    return (
      <ThemeProvider theme={theme}>
        <div className="gate">
          <div className="px" style={{ padding: 18, maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>No se pudo conectar</h2>

            {isFile && isNetwork ? (
              <>
                <p className="tiny dim">
                  Estás abriendo el archivo directamente desde el móvil. El navegador bloquea las
                  conexiones a internet cuando la página viene de un archivo local, así que la app
                  no puede llegar a la base de datos.
                </p>
                <p className="tiny dim">Para usarla de verdad, sirve el archivo desde una dirección web:</p>
                <ul className="tiny dim" style={{ paddingLeft: 18, marginTop: 4 }}>
                  <li>En el ordenador: <code>npx serve</code> y entra por <code>http://localhost:3000</code>.</li>
                  <li>Desde el móvil en casa: entra a la IP del ordenador, por ejemplo <code>http://192.168.1.40:3000</code>.</li>
                  <li>O súbela a Netlify, GitHub Pages o Cloudflare Pages.</li>
                </ul>
              </>
            ) : (
              <p className="tiny dim">
                Comprueba que tienes internet. Si sigue igual, revisa la configuración de Supabase
                (arriba del archivo, en <code>window.KOME_CONFIG</code>).
              </p>
            )}

            <hr className="divider" />
            <div className="eyebrow" style={{ marginBottom: 4 }}>Detalle técnico</div>
            <p className="tiny num" style={{ color: "var(--kaki)", wordBreak: "break-word" }}>
              {detail || "sin mensaje"}
              {bootError?.code ? ` · código ${bootError.code}` : ""}
              {bootError?.hint ? ` · ${bootError.hint}` : ""}
            </p>
            <p className="tiny" style={{ color: "var(--muted-2)" }}>
              origen: {typeof location !== "undefined" ? location.protocol : "?"}
            </p>
            <button className="btn btn-sm btn-block" style={{ marginTop: 10 }} onClick={() => location.reload()}>
              Reintentar
            </button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!profile) {
    return (
      <ThemeProvider theme={theme}>
        <ProfileGate
          profiles={profiles}
          onPick={pick}
          onCreated={async (p) => { await refreshProfiles(); pick(p); }}
        />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <div className="app">
        {tab === "hoy" && <Today profile={profile} recipes={recipes} toast={toast} />}
        {tab === "recetas" && <RecipesPage recipes={recipes} reload={loadRecipes} toast={toast} profiles={profiles} />}
        {tab === "plan" && <Plan profile={profile} recipes={recipes} profiles={profiles} toast={toast} />}
        {tab === "registro" && <Progress profile={profile} toast={toast} />}
        {tab === "perfil" && (
          <ProfilePage
            profile={profile}
            toast={toast}
            onUpdate={(p) => { setProfile(p); setTheme(normalizeTheme(p.theme)); refreshProfiles(); }}
            onPreviewTheme={(t) => setTheme(normalizeTheme(t))}
            onSwitch={() => { setProfile(null); localStorage.removeItem(STORE_KEY); refreshProfiles(); }}
            onDeleted={async () => { setProfile(null); localStorage.removeItem(STORE_KEY); await refreshProfiles(); }}
          />
        )}

        <nav className="nav">
          <div className="nav-inner drop">
            {TABS.map((t) => (
              <button key={t.key} className="nav-btn" data-on={tab === t.key} onClick={() => setTab(t.key)}>
                <span className="dotmark" />
                {!claro && <span style={{ fontSize: 13 }}>{t.jp}</span>}
                <span style={{ fontSize: claro ? 13 : 10, letterSpacing: claro ? 0 : ".05em" }}>{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <Toast msg={msg} />
      </div>
    </ThemeProvider>
  );
}
