/* ============================================================
   El peso lo lleva la app del gimnasio.

   gym-web vive en otra cuenta de Supabase (la de la cartera) y
   guarda los pesajes en `gym_bodylog`, con una persona por cada
   uno de casa. Aquí solo se leen: se enlaza por el nombre del
   perfil, que es el mismo en las dos apps.

   Si el gimnasio no contesta o esa persona no está, kome sigue
   con sus propios pesajes de siempre.
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const GYM_URL = "https://sjebkqsaqdhliyszaiag.supabase.co";
const GYM_KEY = "sb_publishable_eLMLnuUVLfZRGzMq8pgLFA_LLPg39pp";

let cliente = null;
function gym() {
  if (!cliente) {
    cliente = createClient(GYM_URL, GYM_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storageKey: "kome-gym" },
    });
  }
  return cliente;
}

const limpia = (s) =>
  String(s || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

let personas = null;   // se piden una vez por sesión

async function listaPersonas() {
  if (personas) return personas;
  const { data, error } = await gym().from("gym_people").select("id, name");
  if (error) throw error;
  personas = data || [];
  return personas;
}

/** La persona del gimnasio que se llama igual que este perfil. */
export async function personaDelGimnasio(nombre) {
  const buscado = limpia(nombre);
  if (!buscado) return null;
  const lista = await listaPersonas();
  return lista.find((p) => limpia(p.name) === buscado) || null;
}

/**
 * Los pesajes de esa persona, del más reciente al más antiguo,
 * con la misma forma que usa kome en su gráfica.
 */
export async function pesosDelGimnasio(nombre, limite = 120) {
  const persona = await personaDelGimnasio(nombre);
  if (!persona) return null;                       // null = no hay enlace
  const { data, error } = await gym()
    .from("gym_bodylog").select("id, date, weight")
    .eq("person_id", persona.id).not("weight", "is", null)
    .order("date", { ascending: false }).limit(limite);
  if (error) throw error;
  return (data || []).map((x) => ({
    id: `gym-${x.id}`,
    date: x.date,
    weight_kg: Number(x.weight),
    delGimnasio: true,
  }));
}

/** El último peso, que es el que usan los cálculos de kome. */
export async function ultimoPesoDelGimnasio(nombre) {
  const pesos = await pesosDelGimnasio(nombre, 1);
  return pesos && pesos.length ? pesos[0].weight_kg : null;
}
