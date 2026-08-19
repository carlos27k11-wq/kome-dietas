import { createClient } from "@supabase/supabase-js";

// Funciona en los dos formatos: proyecto Vite (variables de entorno)
// y archivo HTML suelto (objeto window.KOME_CONFIG).
const cfg = (typeof window !== "undefined" && window.KOME_CONFIG) || {};
const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL || cfg.SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Falta la configuración de Supabase (URL y clave pública).");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export const PHOTO_BUCKET = "recipe-photos";

export async function uploadRecipePhoto(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
