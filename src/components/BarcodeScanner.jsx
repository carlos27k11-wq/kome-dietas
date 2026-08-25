import React, { useCallback, useEffect, useRef, useState } from "react";

/* ============================================================
   Lector de códigos de barras.

   Tres caminos, de mejor a peor:
   1. El lector que trae el propio móvil (BarcodeDetector). Es el
      que mejor va, pero solo lo tienen Chrome y Android.
   2. html5-qrcode con la cámara a tope de resolución y enfoque
      continuo — el fallo de antes era pedir la cámara sin exigir
      tamaño: salía a 640×480 y un EAN-13 se queda sin píxeles.
   3. Una foto al código: la cámara del móvil dispara a 12 MP con
      autoenfoque y se lee sobre esa imagen. Va bien siempre.

   Y si nada funciona, se escribe el número a mano: son 13 dígitos
   y con el catálogo cargado se encuentra igual.
   ============================================================ */

const FORMATOS_NATIVOS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

const CAMARA = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: "continuous" }],
};

const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

async function detectorNativo() {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) return null;
  try {
    const soportados = await window.BarcodeDetector.getSupportedFormats();
    const formats = FORMATOS_NATIVOS.filter((f) => soportados.includes(f));
    if (!formats.length) return null;
    return new window.BarcodeDetector({ formats });
  } catch {
    return null;
  }
}

export default function BarcodeScanner({ onDetected, onError }) {
  const boxId = useRef(`scan-${Math.random().toString(36).slice(2)}`);
  const fotoId = useRef(`foto-${Math.random().toString(36).slice(2)}`);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const qrRef = useRef(null);
  const fileRef = useRef(null);
  const done = useRef(false);
  const vivo = useRef(true);

  const [modo, setModo] = useState("cargando"); // cargando | nativo | libreria | manual
  const [estado, setEstado] = useState("Pidiendo acceso a la cámara…");
  const [aMano, setAMano] = useState("");
  const insegura = typeof window !== "undefined" && !window.isSecureContext;

  const cantar = useCallback((texto) => {
    const code = soloDigitos(texto);
    if (!code || done.current) return;
    done.current = true;
    if (navigator.vibrate) navigator.vibrate(35);
    onDetected?.(code);
  }, [onDetected]);

  const soltar = useCallback(() => {
    const s = streamRef.current;
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    const q = qrRef.current;
    qrRef.current = null;
    if (q) { try { q.stop().then(() => q.clear()).catch(() => {}); } catch { /* ya estaba */ } }
  }, []);

  useEffect(() => () => { vivo.current = false; soltar(); }, [soltar]);

  /* ---------------- arranque ---------------- */
  useEffect(() => {
    if (insegura) { setModo("manual"); return; }
    let cancelado = false;

    (async () => {
      const det = await detectorNativo();

      /* --- 1. el lector del móvil --- */
      if (det && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: CAMARA });
          if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
          streamRef.current = stream;
          setModo("nativo");
          setEstado("Acerca el código hasta llenar el recuadro");
          const v = videoRef.current;
          if (v) { v.srcObject = stream; await v.play().catch(() => {}); }

          const mirar = async () => {
            if (cancelado || done.current || !vivo.current) return;
            const vid = videoRef.current;
            if (vid && vid.readyState >= 2) {
              try {
                const codigos = await det.detect(vid);
                if (codigos?.length) { cantar(codigos[0].rawValue); return; }
              } catch { /* fotograma malo, seguimos */ }
            }
            setTimeout(mirar, 120);
          };
          mirar();
          return;
        } catch (e) {
          if (cancelado) return;
          onError?.(e);
        }
      }

      /* --- 2. la librería, pidiendo la cámara en condiciones --- */
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (cancelado) return;
        const scanner = new Html5Qrcode(boxId.current, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
          ],
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          verbose: false,
        });
        qrRef.current = scanner;
        setModo("libreria");
        await scanner.start(
          // el primer argumento solo admite una clave; las condiciones de
          // verdad (resolución y enfoque) van en videoConstraints
          { facingMode: "environment" },
          {
            fps: 12,
            // un recuadro grande: cuanto más ancho, más píxeles por barra
            qrbox: (w, h) => ({ width: Math.floor(w * 0.92), height: Math.floor(h * 0.55) }),
            disableFlip: true,
            videoConstraints: CAMARA,
          },
          (texto) => cantar(texto),
          () => {}
        );
        if (!cancelado) setEstado("Acerca el código hasta llenar el recuadro");
      } catch (e) {
        if (cancelado) return;
        setModo("manual");
        const porque = String(e?.message || e || "").slice(0, 90);
        setEstado(
          "No se pudo abrir la cámara" + (porque ? ` (${porque})` : "") +
          ". Hazle una foto al código o escríbelo."
        );
        onError?.(e);
      }
    })();

    return () => { cancelado = true; soltar(); };
  }, [cantar, insegura, onError, soltar]);

  /* --- 3. leer el código de una foto --- */
  const desdeFoto = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEstado("Mirando la foto…");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      // un lector aparte, en su propio hueco: el de la cámara puede estar en marcha
      const lector = new Html5Qrcode(fotoId.current, { verbose: false });
      const texto =
        typeof lector.scanFileV2 === "function"
          ? (await lector.scanFileV2(file, false)).decodedText
          : await lector.scanFile(file, false);
      lector.clear();
      cantar(texto);
    } catch {
      setEstado("En esa foto no se ve el código. Prueba más cerca y con luz.");
    }
  }, [cantar]);

  const marco = {
    position: "absolute", left: "4%", top: "22%", width: "92%", height: "56%",
    border: "2px dashed var(--sakura)", pointerEvents: "none",
  };

  return (
    <div>
      {modo === "nativo" ? (
        <div style={{ position: "relative", background: "#000", lineHeight: 0 }}>
          <video ref={videoRef} playsInline muted autoPlay
            style={{ width: "100%", display: "block", maxHeight: "46vh", objectFit: "cover" }} />
          <div aria-hidden style={marco} />
        </div>
      ) : (
        <div
          id={boxId.current}
          style={{
            width: "100%", background: "#000", border: "var(--px) solid var(--line)",
            overflow: "hidden", minHeight: modo === "manual" ? 0 : 200,
          }}
        />
      )}

      {estado && <p className="tiny dim center" style={{ margin: "10px 0" }}>{estado}</p>}

      <div className="row">
        <button className="btn btn-sm grow" onClick={() => fileRef.current?.click()}>
          📸 Foto al código
        </button>
        <button className="btn btn-sm grow" onClick={() => { soltar(); setModo("manual"); setEstado(""); }}>
          ⌨ Escribirlo
        </button>
      </div>

      {modo === "manual" && (
        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input num grow"
            inputMode="numeric"
            placeholder="8480000123456"
            value={aMano}
            onChange={(ev) => setAMano(soloDigitos(ev.target.value).slice(0, 14))}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={aMano.length < 8}
            onClick={() => cantar(aMano)}
          >
            Buscar
          </button>
        </div>
      )}

      <div id={fotoId.current} style={{ display: "none" }} />
      <input ref={fileRef} type="file" accept="image/*" onChange={desdeFoto} style={{ display: "none" }} />
    </div>
  );
}
