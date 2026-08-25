/* ============================================================
   Lector de códigos de barras.

   El truco está en la resolución: la librería que usábamos antes
   descifraba una copia del vídeo encogida al tamaño del recuadro
   que se ve en pantalla (unos 330 px), así que un código que no
   llenara media pantalla se quedaba sin barras que leer. Aquí se
   coge el fotograma tal cual sale de la cámara —1920 px— y se
   descifra a ese tamaño, que es lo que cambia las cosas.

   Lo descifra zxing (en WebAssembly), que se baja de internet la
   primera vez y se queda en la caché del navegador.
   ============================================================ */

const ZXING_SRC = "https://cdn.jsdelivr.net/npm/zxing-wasm@3/dist/iife/reader/index.js";

export const FORMATOS = ["EAN-13", "EAN-8", "UPC-A", "UPC-E", "Code128", "Code39", "ITF"];

const OPCIONES = {
  formats: FORMATOS,
  tryHarder: true,
  tryRotate: true,
  tryInvert: true,
  maxNumberOfSymbols: 1,
};

let cargando = null;

export function cargarLector() {
  if (typeof window !== "undefined" && window.ZXingWASM) return Promise.resolve(window.ZXingWASM);
  if (cargando) return cargando;
  cargando = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ZXING_SRC;
    s.async = true;
    s.onload = () =>
      window.ZXingWASM ? resolve(window.ZXingWASM) : reject(new Error("El lector no arrancó"));
    s.onerror = () => {
      cargando = null;
      reject(new Error("No se pudo descargar el lector de códigos. ¿Hay internet?"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

/** Descifra un código. Acepta lo que da la cámara o el archivo de una foto. */
export async function leerCodigo(fuente) {
  const zx = await cargarLector();
  const encontrados = await zx.readBarcodes(fuente, OPCIONES);
  const texto = encontrados?.[0]?.text;
  return texto ? String(texto).replace(/\D/g, "") : null;
}

/**
 * La banda central del vídeo, a la resolución de la cámara.
 * Ahí es donde apunta el usuario y es lo único que hay que mirar.
 */
export function bandaDelVideo(video, alto = 0.5) {
  const W = video.videoWidth;
  const H = video.videoHeight;
  if (!W || !H) return null;

  const bh = Math.max(80, Math.round(H * alto));
  const by = Math.round((H - bh) / 2);

  const canvas = bandaDelVideo.canvas || (bandaDelVideo.canvas = document.createElement("canvas"));
  canvas.width = W;
  canvas.height = bh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, by, W, bh, 0, 0, W, bh);
  return ctx.getImageData(0, 0, W, bh);
}

/** El lector que trae el propio móvil, cuando lo hay: es el más rápido. */
export async function detectorDelMovil() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
  try {
    const soportados = await window.BarcodeDetector.getSupportedFormats();
    const formats = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"]
      .filter((f) => soportados.includes(f));
    if (!formats.length) return null;
    return new window.BarcodeDetector({ formats });
  } catch {
    return null;
  }
}
