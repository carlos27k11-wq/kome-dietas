import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet, FullScreen } from "../components/ui";
import { useTheme, Jp } from "../components/theme";
import {
  getPlan, addPlanItem, deletePlanItem, copyWeek, addEntries,
  listShopping, addShoppingItem, toggleShoppingItem, deleteShoppingItem,
  clearDoneShopping,
} from "../lib/store";
import { isoDate, shiftDate, mondayOf, WEEKDAYS, WEEKDAYS_JP } from "../lib/nutrition";

const SLOTS = [
  { key: "comida", label: "Comida", jp: "昼" },
  { key: "cena", label: "Cena", jp: "夜" },
];

/* Selector de plato para una casilla del calendario */
function PickDish({ open, onClose, recipes, profiles, slot, onPick }) {
  const [q, setQ] = useState("");
  const [who, setWho] = useState("todos");
  const [free, setFree] = useState("");

  useEffect(() => { if (!open) { setQ(""); setFree(""); } }, [open]);

  const list = useMemo(() => {
    let l = recipes;
    if (who !== "todos") l = l.filter((r) => !r.liked_by?.length || r.liked_by.includes(who));
    if (q.trim()) l = l.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));
    // primero las del momento del día que toca
    return [...l].sort((a, b) => (b.category === slot?.key) - (a.category === slot?.key));
  }, [recipes, q, who, slot]);

  return (
    <Sheet open={open} onClose={onClose} title={slot ? `${slot.label} del ${slot.dayLabel}` : "Elegir plato"} jp="選択">
      <div className="stack">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar receta…" />

        {profiles.length > 0 && (
          <div className="chips">
            <button className="chip" data-on={who === "todos"} onClick={() => setWho("todos")}>Sin filtrar</button>
            {profiles.map((p) => (
              <button key={p.id} className="chip" data-on={who === p.id} onClick={() => setWho(p.id)}>
                {p.avatar_emoji} {p.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ maxHeight: "45vh", overflowY: "auto" }}>
          {list.map((r) => (
            <button key={r.id} className="px"
              onClick={() => onPick({ recipe_id: r.id })}
              style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", padding: 8, marginBottom: 7, cursor: "pointer", border: "var(--px) solid var(--line-soft)" }}>
              {r.photo_url
                ? <img src={r.photo_url} alt="" width={40} height={40} style={{ objectFit: "cover" }} loading="lazy" />
                : <div style={{ width: 40, height: 40, background: "var(--night)", display: "grid", placeItems: "center" }}>🍚</div>}
              <div className="grow">
                <div style={{ fontSize: 15 }}>{r.name}</div>
                <div className="tiny num dim">
                  {Math.round(r.kcal)} kcal
                  {r.liked_by?.length ? " · " + profiles.filter((p) => r.liked_by.includes(p.id)).map((p) => p.avatar_emoji).join("") : ""}
                </div>
              </div>
            </button>
          ))}
          {!list.length && <div className="empty tiny">No hay recetas que encajen.</div>}
        </div>

        <hr className="divider" />
        <div className="field">
          <label>O apúntalo a mano</label>
          <div className="row">
            <input className="input grow" value={free} onChange={(e) => setFree(e.target.value)} placeholder="Cenar fuera, sobras…" />
            <button className="btn" disabled={!free.trim()} onClick={() => onPick({ note: free.trim() })}>Poner</button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/* --- casilla de verificación --- */
function PixelCheck({ on }) {
  return (
    <svg viewBox="0 0 12 12" width="26" height="26" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="0" y="0" width="12" height="12" fill={on ? "var(--matcha)" : "var(--night)"} />
      <g fill="var(--line)">
        <rect x="0" y="0" width="12" height="1" /><rect x="0" y="11" width="12" height="1" />
        <rect x="0" y="0" width="1" height="12" /><rect x="11" y="0" width="1" height="12" />
      </g>
      {on && (
        <g fill="var(--night)">
          <rect x="2" y="6" width="2" height="2" />
          <rect x="4" y="8" width="2" height="2" />
          <rect x="6" y="6" width="2" height="2" />
          <rect x="8" y="4" width="2" height="2" />
        </g>
      )}
    </svg>
  );
}

/* ============================================================
   Lista de la compra de la casa. Ocupa toda la pantalla y solo
   hace una cosa: apuntar lo que falta y tacharlo al comprarlo.
   El teclado no se abre solo: hay que tocar el campo.
   ============================================================ */
function ShoppingList({ open, onClose, profileId, toast }) {
  const [items, setItems] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await listShopping()); }
    catch { toast("No se pudo cargar la lista"); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => { if (!open) setText(""); }, [open]);

  async function add() {
    const t = text.trim();
    if (!t) return;
    setText("");
    // varias cosas de golpe separadas por coma
    const parts = t.split(",").map((x) => x.trim()).filter(Boolean);
    setItems((prev) => [...prev, ...parts.map((p, i) => ({ id: `tmp${Date.now()}${i}`, text: p, done: false }))]);
    try {
      for (const p of parts) await addShoppingItem(p, profileId);
    } catch { toast("No se pudo guardar"); }
    load();
  }

  async function toggle(item) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)));
    try { await toggleShoppingItem(item.id, !item.done); } catch { load(); }
  }

  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);

  return (
    <FullScreen
      open={open}
      onClose={onClose}
      title="Lista de la compra"
      subtitle={pending.length ? `${pending.length} cosas por comprar` : "Todo comprado"}
    >
      <div className="stack">
        <div className="row">
          <input
            className="input grow" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Tomates, pan, huevos…"
            enterKeyHint="done"
          />
          <button className="btn btn-primary" disabled={!text.trim()} onClick={add}>＋</button>
        </div>
        <p className="tiny dim" style={{ margin: 0 }}>
          Separa por comas para meter varias cosas de una vez. La lista es de toda la casa.
        </p>

        {loading && !items.length && <div className="center tiny dim blink">cargando…</div>}

        {pending.length > 0 && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Por comprar · {pending.length}</div>
            {pending.map((it) => (
              <div key={it.id} className="entry">
                <button onClick={() => toggle(it)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }} aria-label="Marcar">
                  <PixelCheck on={false} />
                </button>
                <span className="grow" style={{ fontSize: 16 }}>{it.text}</span>
                {it.qty && <span className="num tiny dim">{it.qty}</span>}
                <button className="icon-btn tiny" aria-label="Quitar"
                  onClick={async () => { setItems((p) => p.filter((x) => x.id !== it.id)); await deleteShoppingItem(it.id); }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div>
            <div className="row-b" style={{ marginBottom: 4 }}>
              <span className="eyebrow">En el carro · {done.length}</span>
              <button className="btn btn-sm btn-ghost"
                onClick={async () => { await clearDoneShopping(); toast("Lista limpia"); load(); }}>
                Vaciar
              </button>
            </div>
            {done.map((it) => (
              <div key={it.id} className="entry" style={{ opacity: 0.55 }}>
                <button onClick={() => toggle(it)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", lineHeight: 0 }} aria-label="Desmarcar">
                  <PixelCheck on={true} />
                </button>
                <span className="grow" style={{ fontSize: 16, textDecoration: "line-through" }}>{it.text}</span>
                <button className="icon-btn tiny" aria-label="Quitar"
                  onClick={async () => { setItems((p) => p.filter((x) => x.id !== it.id)); await deleteShoppingItem(it.id); }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {!loading && !items.length && (
          <div className="empty">
            <div style={{ fontSize: 30 }}>🧺</div>
            <p className="tiny">La lista está vacía. Ve apuntando lo que falte en casa.</p>
          </div>
        )}

        {pending.length > 0 && (
          <button className="btn btn-block btn-sm"
            onClick={() => {
              const txt = pending.map((x) => `- ${x.text}${x.qty ? ` (${x.qty})` : ""}`).join("\n");
              if (navigator.share) navigator.share({ title: "Lista de la compra", text: txt }).catch(() => {});
              else navigator.clipboard?.writeText(txt).then(() => toast("Copiada al portapapeles"));
            }}>
            Compartir lo que falta
          </button>
        )}
      </div>
    </FullScreen>
  );
}

export default function Plan({ profile, recipes, profiles, toast }) {
  const { claro, jpLabel } = useTheme();
  const [monday, setMonday] = useState(mondayOf(isoDate()));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(null);
  const [shopping, setShopping] = useState(false);

  const sunday = shiftDate(monday, 6);
  const byId = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getPlan(monday, sunday)); }
    catch { toast("No se pudo cargar la planificación"); }
    finally { setLoading(false); }
  }, [monday, sunday, toast]);

  useEffect(() => { load(); }, [load]);

  const cell = (date, meal) => items.filter((i) => i.date === date && i.meal === meal);

  const weekLabel = () => {
    const a = new Date(monday + "T12:00:00"), b = new Date(sunday + "T12:00:00");
    const f = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `${f(a)} – ${f(b)}`;
  };

  const weekKcal = items.reduce((a, i) => a + (byId[i.recipe_id]?.kcal || 0), 0);

  return (
    <div className="wrap stack" style={{ paddingTop: 12 }}>
      <div className="row-b">
        <button className="icon-btn num" onClick={() => setMonday(shiftDate(monday, -7))} aria-label="Semana anterior">◀</button>
        <div className="center">
          <Jp>献立表</Jp>
          <h2 style={{ fontSize: 19 }}>{weekLabel()}</h2>
          {monday === mondayOf(isoDate()) && <div className="tiny" style={{ color: "var(--matcha)" }}>esta semana</div>}
        </div>
        <button className="icon-btn num" onClick={() => setMonday(shiftDate(monday, 7))} aria-label="Semana siguiente">▶</button>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm grow"
          onClick={async () => {
            const rows = await copyWeek(shiftDate(monday, -7), monday);
            toast(rows.length ? `Copiada la semana anterior (${rows.length} platos)` : "La semana anterior está vacía");
            load();
          }}>
          Copiar semana anterior
        </button>
        <button className="btn btn-sm grow" onClick={() => setShopping(true)}>
          🧺 Lista de la compra
        </button>
      </div>

      {WEEKDAYS.map((dayName, idx) => {
        const date = shiftDate(monday, idx);
        const isToday = date === isoDate();
        return (
          <div key={date} className="px" style={{ padding: 12, borderColor: isToday ? "var(--sakura)" : undefined }}>
            <div className="row-b" style={{ marginBottom: 8 }}>
              <div className="row" style={{ gap: 8 }}>
                {!claro && (
                  <span className="kanji" style={{ fontSize: 15, color: isToday ? "var(--sakura)" : "var(--muted-2)" }}>
                    {WEEKDAYS_JP[idx]}
                  </span>
                )}
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: claro ? 18 : 15, fontWeight: claro ? 700 : 400 }}>{dayName}</div>
                  <div className="tiny num" style={{ color: "var(--muted-2)" }}>
                    {new Date(date + "T12:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </div>
                </div>
              </div>
              {isToday && <span className="tag" style={{ color: "var(--sakura)" }}>hoy</span>}
            </div>

            {SLOTS.map((slot) => {
              const rows = cell(date, slot.key);
              return (
                <div key={slot.key} style={{ marginTop: 6 }}>
                  <div className="row-b">
                    <span className="eyebrow">{jpLabel(slot.jp, slot.label)}</span>
                    <button className="btn btn-sm btn-ghost"
                      onClick={() => setPicking({ date, meal: slot.key, label: slot.label, dayLabel: dayName.toLowerCase(), key: slot.key })}>
                      ＋
                    </button>
                  </div>

                  {rows.length === 0 && <div className="tiny" style={{ color: "var(--muted-2)" }}>— sin planificar —</div>}

                  {rows.map((it) => {
                    const r = it.recipe_id ? byId[it.recipe_id] : null;
                    return (
                      <div key={it.id} className="entry">
                        {r?.photo_url && (
                          <img src={r.photo_url} alt="" width={34} height={34} style={{ objectFit: "cover" }} loading="lazy" />
                        )}
                        <div className="grow">
                          <div style={{ fontSize: 15 }}>{r ? r.name : it.note}</div>
                          {r && (
                            <div className="tiny num" style={{ color: "var(--muted-2)" }}>
                              {Math.round(r.kcal)} kcal · P{Math.round(r.protein)} C{Math.round(r.carbs)} G{Math.round(r.fat)}
                              {r.liked_by?.length ? " · " + profiles.filter((p) => r.liked_by.includes(p.id)).map((p) => p.avatar_emoji).join("") : ""}
                            </div>
                          )}
                        </div>
                        {r && (
                          <button className="icon-btn tiny" title="Apuntar en mi diario"
                            onClick={async () => {
                              await addEntries([{
                                profile_id: profile.id, date: it.date, meal: it.meal,
                                source_type: "recipe", recipe_id: r.id, name: r.name, servings: 1,
                                kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat,
                                fiber: r.fiber, sugars: r.sugars, sat_fat: r.sat_fat, sodium: r.sodium,
                              }]);
                              toast("Apuntado en tu diario");
                            }}>
                            ⤓
                          </button>
                        )}
                        <button className="icon-btn tiny" aria-label="Quitar"
                          onClick={async () => { await deletePlanItem(it.id); load(); }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      {weekKcal > 0 && (
        <p className="tiny dim center">
          {items.length} platos planificados esta semana · {Math.round(weekKcal)} kcal en total por ración
        </p>
      )}
      {loading && <div className="center tiny dim blink">cargando…</div>}

      <PickDish
        open={!!picking} slot={picking} recipes={recipes} profiles={profiles}
        onClose={() => setPicking(null)}
        onPick={async (payload) => {
          await addPlanItem({ date: picking.date, meal: picking.meal, ...payload });
          setPicking(null);
          load();
        }}
      />

      <ShoppingList
        open={shopping} onClose={() => setShopping(false)}
        profileId={profile.id} toast={toast}
      />

    </div>
  );
}
