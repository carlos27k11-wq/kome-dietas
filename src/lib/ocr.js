/* ============================================================
   Lector de etiquetas.

   Haces una foto a la tabla de "información nutricional" y aquí
   se limpia la imagen, se pasa por OCR y se sacan los valores
   por 100 g. El OCR lo pone tesseract.js, que se descarga de
   internet la primera vez que se usa (y se queda en la caché del
   navegador). Nada de esto sale del móvil: reconoce en local.

   Lo que devuelve siempre hay que repasarlo a mano: una foto
   torcida o una etiqueta con brillos se lee regular.
   ============================================================ */

const TESSERACT_SRC = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

let cargando = null;   // promesa de la librería
let workerP = null;    // promesa del worker (se reutiliza entre fotos)
let avisar = null;     // a quién le contamos el progreso ahora mismo

/* ---------- la librería, bajo demanda ---------- */
function cargarTesseract() {
  if (typeof window !== "undefined" && window.Tesseract) return Promise.resolve(window.Tesseract);
  if (cargando) return cargando;
  cargando = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TESSERACT_SRC;
    s.async = true;
    s.onload = () =>
      window.Tesseract ? resolve(window.Tesseract) : reject(new Error("El lector no arrancó"));
    s.onerror = () => {
      cargando = null;
      reject(new Error("No se pudo descargar el lector. ¿Hay internet?"));
    };
    document.head.appendChild(s);
  });
  return cargando;
}

const PASOS = {
  "loading tesseract core": "preparando el lector…",
  "initializing tesseract": "preparando el lector…",
  "loading language traineddata": "descargando el idioma…",
  "initializing api": "casi…",
  "recognizing text": "leyendo la etiqueta…",
};

async function getWorker() {
  if (workerP) return workerP;
  workerP = (async () => {
    const T = await cargarTesseract();
    return T.createWorker("spa", 1, {
      logger: (m) => {
        if (!avisar) return;
        avisar({
          msg: PASOS[m.status] || "trabajando…",
          pct: Math.max(0, Math.min(100, Math.round((m.progress || 0) * 100))),
        });
      },
    });
  })().catch((e) => { workerP = null; throw e; });
  return workerP;
}

/* ============================================================
   Preparar la foto: recortar, encoger y subir el contraste.
   Cuanto más limpia va la imagen, menos se inventa el OCR.
   ============================================================ */
function dibujable(src) {
  if (src instanceof Blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(src);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo abrir la foto")); };
      img.src = url;
    });
  }
  return Promise.resolve(src);
}

function medidas(el) {
  if (el.videoWidth) return [el.videoWidth, el.videoHeight];
  return [el.naturalWidth || el.width, el.naturalHeight || el.height];
}

/** Deja la imagen en blanco y negro, estirando el contraste. */
function contrastar(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // percentiles 2 % y 98 %, para que un brillo o una sombra no manden
  const total = w * h;
  const corte = Math.max(1, Math.round(total * 0.02));
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= corte) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= corte) { hi = i; break; } }
  if (hi - lo > 20) {
    const escala = 255 / (hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, (d[i] - lo) * escala));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Devuelve un canvas listo para el OCR.
 * @param src     vídeo en marcha, imagen o el archivo de una foto
 * @param crop    recuadro relativo { w, h } centrado (el marco de la cámara)
 */
export async function prepararImagen(src, { crop = null, objetivo = 1800 } = {}) {
  const el = await dibujable(src);
  const [W, H] = medidas(el);
  if (!W || !H) throw new Error("La foto salió vacía");

  const cw = crop ? Math.round(W * crop.w) : W;
  const ch = crop ? Math.round(H * crop.h) : H;
  const cx = Math.round((W - cw) / 2);
  const cy = Math.round((H - ch) / 2);

  // el OCR lee mucho mejor con las letras grandes: encogemos las fotos
  // enormes y agrandamos (hasta el doble) las que vienen pequeñas
  const escala = Math.min(2, Math.max(0.2, objetivo / Math.max(cw, ch)));
  const dw = Math.round(cw * escala);
  const dh = Math.round(ch * escala);

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(el, cx, cy, cw, ch, 0, 0, dw, dh);
  contrastar(ctx, dw, dh);
  return canvas;
}

/* ============================================================
   Del texto que suelta el OCR a los valores por 100 g.
   ============================================================ */
const sinTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const limpiaLinea = (l) => sinTildes(l).toLowerCase().replace(/\s+/g, " ").trim();

/** Arregla los fallos típicos del OCR dentro de un número: O→0, l→1. */
function repara(tok) {
  if (!/\d/.test(tok)) return tok;
  return tok.replace(/[oO]/g, "0").replace(/[lI|]/g, "1");
}

/** Unidades como las lee la cámara: "kcaI", "9", "kJ"… */
function unidadDe(tok) {
  const s = tok.toLowerCase().replace(/[^a-z%]/g, "");
  if (tok.includes("%")) return "%";
  if (s.startsWith("kc")) return "kcal";
  if (s.startsWith("kj") || s === "kl") return "kj";
  if (s === "mg") return "mg";
  if (s === "g" || s === "gr" || s === "grs") return "g";
  return null;
}

const letrasDe = (t) => (t.match(/[a-z]/g) || []).length;

/** Versión de la línea para reconocer el rótulo: los dígitos que
    se han colado dentro de una palabra vuelven a ser letras. */
function lineaPalabras(linea) {
  return linea.split(/\s+/).map((t) =>
    letrasDe(t) >= 2 && /\d/.test(t)
      ? t.replace(/0/g, "o").replace(/1/g, "l").replace(/5/g, "s").replace(/8/g, "b")
      : t
  ).join(" ");
}

/** Versión de la línea para sacar los números: fuera las palabras. */
function lineaNumeros(linea) {
  const toks = linea.split(/\s+/);
  return toks.map((t, i) => {
    const u = unidadDe(t);
    if (u && !/\d/.test(t)) return u;
    if (letrasDe(t) >= 2) {
      let m = t.match(/^([\d.,]+)([a-z%]+)$/);   // "295kcal", "12,5g"
      if (m) { const uu = unidadDe(m[2]); return uu ? `${m[1]} ${uu}` : m[1]; }
      m = t.match(/^([a-z%]+)([\d.,]+)$/);       // "kca468": dos columnas pegadas
      if (m) { const uu = unidadDe(m[1]); return uu ? `${uu} ${m[2]}` : m[2]; }
      return " ";                                // es una palabra
    }
    // la "g" de la etiqueta sale muchas veces como un 9 pegado: "2,19" es 2,1 g
    const g = t.match(/^(\d+[.,]\d{1,2})9$/);
    if (g) return `${g[1]} g`;
    // ...o suelta detrás del número: "0,38 9"
    if (t === "9" && i > 0 && /\d$/.test(toks[i - 1])) return "g";
    return repara(t);
  }).join(" ");
}

/** Números de una línea, con su unidad si la llevan al lado. */
function numeros(linea) {
  const re = /(\d{1,4}(?:[.,]\d{1,3})?)\s*(kcal|kj|mg|g|%)?/gi;
  const out = [];
  let m;
  while ((m = re.exec(lineaNumeros(linea)))) {
    const bruto = m[1];
    out.push({
      valor: parseFloat(bruto.replace(",", ".")),
      bruto,
      unidad: (m[2] || "").toLowerCase(),
    });
  }
  return out;
}

/* el orden manda: "saturadas" y "azúcares" van antes que "grasas" e "hidratos" */
const CAMPOS = [
  { key: "sat_fat_100", re: /satura|saturate|gesatt/ },
  { key: "sugars_100", re: /azucar|sugar|sucre|zucker/ },
  { key: "fat_100", re: /grasa|lipid|\bfat\b|materia grasa|matieres grasses/ },
  { key: "carbs_100", re: /hidratos|carbohidrat|carbohydrat|glucid/ },
  { key: "fiber_100", re: /fibra|fibre|fiber|ballaststoffe/ },
  { key: "protein_100", re: /proteina|proteinas|protein|eiweiss/ },
  { key: "sal", re: /\bsal\b|\bsai\b|\bsalt\b|\bsel\b|\bsalz\b/ },
  { key: "sodium_100", re: /sodio|sodium/ },
  { key: "kcal_100", re: /valor energetico|energia|energy|energie|caloria/ },
];

const TOPES = {
  kcal_100: [0, 900],
  protein_100: [0, 100],
  carbs_100: [0, 105],
  fat_100: [0, 100],
  fiber_100: [0, 95],
  sugars_100: [0, 105],
  sat_fat_100: [0, 100],
  sodium_100: [0, 45000],
  default_serving_g: [1, 2000],
};

const dentro = (k, v) =>
  v != null && isFinite(v) && v >= TOPES[k][0] && v <= TOPES[k][1];

/** Muchas etiquetas traen dos columnas: por 100 g y por ración. */
function columnaDe100(lineas) {
  for (const l of lineas) {
    const p = lineaPalabras(l);
    const cien = p.search(/100\s*(g|ml)/);
    const racion = p.search(/racion|porcion|serving|portion|unidad/);
    if (cien >= 0 && racion >= 0) return racion < cien ? 1 : 0;
  }
  return 0;
}

function kcalDe(nums, col) {
  const kcals = nums.filter((n) => n.unidad === "kcal");
  if (kcals.length) return kcals[Math.min(col, kcals.length - 1)].valor;
  const kjs = nums.filter((n) => n.unidad === "kj");
  const kj = kjs[Math.min(col, kjs.length - 1)];
  if (kj) {
    // "1.234 kJ" suele ser mil doscientos treinta y cuatro, no uno coma dos
    let v = kj.valor;
    if (v < 100 && /[.,]/.test(kj.bruto)) v = parseFloat(kj.bruto.replace(/[.,]/g, ""));
    return v / 4.184;
  }
  // sin unidades: en una etiqueta la primera suele ser kJ y la segunda kcal
  if (nums.length >= 2 && nums[0].valor > nums[1].valor * 3) return nums[1].valor;
  return nums.length ? nums[0].valor : null;
}

/* Un repaso de sentido común: cuando el OCR se come la coma, un
   2,1 se convierte en 21. Si los números no cuadran entre ellos,
   probamos a dividir por diez el que se sale. */
function repasarCoherencia(out) {
  const kcalDeMacros = (o) =>
    (o.protein_100 || 0) * 4 + (o.carbs_100 || 0) * 4 + (o.fat_100 || 0) * 9;
  const diez = (v) => +(v / 10).toFixed(1);

  const k = out.kcal_100;
  if (k > 0) {
    let fallo = Math.abs(kcalDeMacros(out) - k);
    if (fallo > k * 0.25) {
      for (const key of ["protein_100", "carbs_100", "fat_100"]) {
        if (out[key] == null) continue;
        const prueba = { ...out, [key]: diez(out[key]) };
        const nuevo = Math.abs(kcalDeMacros(prueba) - k);
        if (nuevo < fallo * 0.5) { out[key] = prueba[key]; fallo = nuevo; }
      }
    }
  }
  // las saturadas no pueden pasar de la grasa, ni los azúcares de los carbos
  const menor = (hijo, padre) => {
    if (out[hijo] != null && out[padre] != null && out[hijo] > out[padre] && diez(out[hijo]) <= out[padre]) {
      out[hijo] = diez(out[hijo]);
    }
  };
  menor("sat_fat_100", "fat_100");
  menor("sugars_100", "carbs_100");

  // y entre todo no pueden sumar más de 100 g por cada 100 g
  const suma = (o) =>
    (o.protein_100 || 0) + (o.carbs_100 || 0) + (o.fat_100 || 0) + (o.fiber_100 || 0);
  if (suma(out) > 100 && out.fiber_100 != null) {
    const prueba = { ...out, fiber_100: diez(out.fiber_100) };
    if (suma(prueba) <= 100) out.fiber_100 = prueba.fiber_100;
  }
}

export function parseEtiqueta(texto) {
  const lineas = (texto || "")
    .split(/\n+/)
    .map(limpiaLinea)
    .filter((l) => l.trim().length > 1);

  const col = columnaDe100(lineas);
  const out = {};
  let sal = null;

  const gramosDe = (nums) => {
    const buenos = nums.filter((n) => n.unidad !== "%" && n.unidad !== "kj" && n.unidad !== "kcal");
    const lista = buenos.length ? buenos : nums;
    if (!lista.length) return null;
    return lista[Math.min(col, lista.length - 1)];
  };

  lineas.forEach((linea, i) => {
    const campo = CAMPOS.find((c) => c.re.test(lineaPalabras(linea)));
    if (!campo) return;
    // si la línea es solo el rótulo, los números vienen en la siguiente
    let nums = numeros(linea.replace(/100\s*(g|ml)/g, " "));
    if (!nums.length && lineas[i + 1]) nums = numeros(lineas[i + 1]);
    if (!nums.length) return;

    if (campo.key === "kcal_100") {
      const v = kcalDe(nums, col);
      if (dentro("kcal_100", v) && out.kcal_100 == null) out.kcal_100 = Math.round(v);
      return;
    }
    const n = gramosDe(nums);
    if (!n) return;

    if (campo.key === "sal") {
      if (sal == null && n.valor <= 30) sal = n.unidad === "mg" ? n.valor / 1000 : n.valor;
      return;
    }
    if (campo.key === "sodium_100") {
      const mg = n.unidad === "mg" ? n.valor : n.valor * 1000;
      if (dentro("sodium_100", mg) && out.sodium_100 == null) out.sodium_100 = Math.round(mg);
      return;
    }
    if (out[campo.key] != null) return;
    if (dentro(campo.key, n.valor)) {
      out[campo.key] = +n.valor.toFixed(1);
    } else if (dentro(campo.key, n.valor / 10)) {
      // un 125 en la casilla de la grasa es un 12,5 al que se le comió la coma
      out[campo.key] = +(n.valor / 10).toFixed(1);
    }
  });

  // la sal de la etiqueta vale como sodio (sal ≈ sodio × 2,5)
  if (out.sodium_100 == null && sal != null) {
    const mg = Math.round(sal * 400);
    if (dentro("sodium_100", mg)) out.sodium_100 = mg;
  }

  // ¿pone de cuánto es la ración?
  for (const l of lineas) {
    if (!/racion|porcion|serving|portion/.test(lineaPalabras(l))) continue;
    const n = numeros(l.replace(/100\s*(g|ml)/g, " ")).find((x) => x.unidad === "g" || !x.unidad);
    if (n && dentro("default_serving_g", n.valor) && n.valor !== 100) {
      out.default_serving_g = Math.round(n.valor);
      break;
    }
  }

  repasarCoherencia(out);

  // si no hay kcal pero sí macros, se calculan
  if (out.kcal_100 == null && (out.protein_100 != null || out.carbs_100 != null || out.fat_100 != null)) {
    const k = Math.round(
      (out.protein_100 || 0) * 4 + (out.carbs_100 || 0) * 4 + (out.fat_100 || 0) * 9
    );
    if (k > 0) { out.kcal_100 = k; out.kcal_calculada = true; }
  }

  const cuenta = ["kcal_100", "protein_100", "carbs_100", "fat_100", "fiber_100",
    "sugars_100", "sat_fat_100", "sodium_100"].filter((k) => out[k] != null).length;

  return { valores: out, cuenta, texto: texto || "" };
}

/* ============================================================
   El paso completo: canvas → texto → valores.
   Primero se prueba tratando la foto como un bloque de tabla y,
   si sale poca cosa, se repite dejando que tesseract busque las
   columnas por su cuenta.
   ============================================================ */
export async function leerEtiqueta(canvas, onProgress) {
  avisar = onProgress || null;
  try {
    const worker = await getWorker();

    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    let mejor = parseEtiqueta((await worker.recognize(canvas)).data.text);

    if (mejor.cuenta < 3) {
      avisar?.({ msg: "probando otra vez…", pct: 0 });
      await worker.setParameters({ tessedit_pageseg_mode: "3" });
      const otro = parseEtiqueta((await worker.recognize(canvas)).data.text);
      if (otro.cuenta > mejor.cuenta) mejor = otro;
    }
    return mejor;
  } finally {
    avisar = null;
  }
}

/** Para soltar la memoria del worker cuando ya no hace falta. */
export async function cerrarLector() {
  const p = workerP;
  workerP = null;
  try { (await p)?.terminate(); } catch { /* daba igual */ }
}
