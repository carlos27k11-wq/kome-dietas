import React, { useCallback, useEffect, useRef, useState } from "react";
import { leerCodigo, bandaDelVideo, detectorDelMovil, cargarLector } from "../lib/codigos";

/* ============================================================
   Escáner de códigos de barras.

   Se pide la cámara a máxima resolución y se descifra el
   fotograma TAL CUAL sale de ella, no la miniatura que se ve en
   pantalla: así basta con que el código ocupe una quinta parte
   del encuadre, en vez de más de media pantalla.

   Si el móvil trae su propio lector (Chrome y Android) se usa
   ese, que va aún mejor. Y siempre quedan dos salidas: hacerle
   una foto al código o escribir el número a mano.
   ============================================================ */

const CAMARA = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: "continuous" }],
};

const soloDigitos = (t) => String(t || "").replace(/\D/g, "");

export default function BarcodeScanner({ onDetected, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const done = useRef(false);
  const vivo = useRef(true);

  const [medios, setMedios] = useState(null);   // el vídeo en marcha
  const [estado, setEstado] = useState("Pidiendo acceso a la cámara…");
  const [aMano, setAMano] = useState("");
  const [manual, setManual] = useState(false);
  const [zoom, setZoom] = useState(null);   // {min,max,step,valor} si la cámara deja

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
  }, []);

  useEffect(() => () => { vivo.current = false; soltar(); }, [soltar]);

  /* ---------------- cámara y bucle de lectura ---------------- */
  useEffect(() => {
    if (insegura || !navigator.mediaDevices?.getUserMedia) {
      setEstado("Aquí no puedo abrir la cámara. Hazle una foto al código o escríbelo.");
      setManual(true);
      return;
    }
    let cancelado = false;
    let temporizador = null;

    (async () => {
      // el lector se va bajando mientras se pide la cámara
      const conMovil = detectorDelMovil();
      cargarLector().catch(() => {});

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: CAMARA });
      } catch (e) {
        if (cancelado) return;
        setEstado(`No se pudo abrir la cámara (${String(e?.name || e).slice(0, 40)}). Hazle una foto al código o escríbelo.`);
        setManual(true);
        onError?.(e);
        return;
      }
      if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }

      streamRef.current = stream;
      // el <video> todavía no existe: se pinta con este cambio de estado y
      // el efecto de abajo es el que le engancha la imagen
      setMedios(stream);
      setEstado("Enfoca el código dentro de la franja");

      // zoom, si la cámara lo permite: acercar ayuda más que nada
      const track = stream.getVideoTracks()[0];
      try {
        const cap = track.getCapabilities?.();
        if (cap?.zoom && cap.zoom.max > cap.zoom.min) {
          setZoom({
            min: cap.zoom.min, max: Math.min(cap.zoom.max, cap.zoom.min * 5),
            step: cap.zoom.step || 0.1, valor: track.getSettings?.().zoom ?? cap.zoom.min,
          });
        }
      } catch { /* sin zoom, no pasa nada */ }

      const detector = await conMovil;
      let avisado = false;

      const mirar = async () => {
        if (cancelado || done.current || !vivo.current) return;
        const vid = videoRef.current;
        if (vid && vid.readyState >= 2) {
          try {
            if (detector) {
              const codigos = await detector.detect(vid);
              if (codigos?.length) return cantar(codigos[0].rawValue);
            } else {
              const banda = bandaDelVideo(vid, 0.5);
              if (banda) {
                const code = await leerCodigo(banda);
                if (code) return cantar(code);
              }
            }
            if (!avisado) { avisado = true; setEstado("Enfoca el código dentro de la franja"); }
          } catch (e) {
            if (!avisado) {
              avisado = true;
              setEstado(`El lector se ha atascado (${String(e?.message || e).slice(0, 60)}). Prueba con la foto.`);
            }
          }
        }
        temporizador = setTimeout(mirar, 100);
      };
      mirar();
    })();

    return () => { cancelado = true; clearTimeout(temporizador); soltar(); };
  }, [cantar, insegura, onError, soltar]);

  /* la imagen se engancha cuando el <video> ya está pintado */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !medios) return;
    v.srcObject = medios;
    const arrancar = () => v.play().catch(() => {});
    arrancar();
    v.addEventListener("loadedmetadata", arrancar);
    return () => v.removeEventListener("loadedmetadata", arrancar);
  }, [medios]);

  const cambiarZoom = useCallback((valor) => {
    setZoom((z) => (z ? { ...z, valor } : z));
    const track = streamRef.current?.getVideoTracks?.()[0];
    track?.applyConstraints?.({ advanced: [{ zoom: valor }] }).catch(() => {});
  }, []);

  /* --- foto al código: la cámara del móvil enfoca de verdad --- */
  const desdeFoto = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setEstado("Mirando la foto…");
    try {
      const code = await leerCodigo(file);
      if (code) cantar(code);
      else setEstado("En esa foto no se ve el código. Prueba más cerca, con luz y sin torcerlo.");
    } catch (err) {
      setEstado(String(err?.message || "No se pudo leer la foto"));
    }
  }, [cantar]);

  return (
    <div>
      {medios && (
        <div style={{ position: "relative", background: "#000", lineHeight: 0 }}>
          <video ref={videoRef} playsInline muted autoPlay
            style={{ width: "100%", display: "block", maxHeight: "44vh", objectFit: "cover" }} />
          {/* la franja marca lo que se está mirando de verdad */}
          <div aria-hidden style={{
            position: "absolute", left: 0, top: "25%", width: "100%", height: "50%",
            borderTop: "2px dashed var(--sakura)", borderBottom: "2px dashed var(--sakura)",
            pointerEvents: "none",
          }} />
        </div>
      )}

      {estado && <p className="tiny dim center" style={{ margin: "10px 0" }}>{estado}</p>}

      {zoom && (
        <div className="row" style={{ margin: "0 0 8px" }}>
          <span className="tiny dim">Zoom</span>
          <input
            type="range" className="grow"
            min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.valor}
            onChange={(e) => cambiarZoom(Number(e.target.value))}
          />
          <span className="tiny num dim">{Number(zoom.valor).toFixed(1)}×</span>
        </div>
      )}

      <div className="row">
        <button className="btn btn-sm grow" onClick={() => fileRef.current?.click()}>
          📸 Foto al código
        </button>
        <button className="btn btn-sm grow" onClick={() => setManual(true)}>
          ⌨ Escribirlo
        </button>
      </div>

      {manual && (
        <div className="row" style={{ marginTop: 8 }}>
          <input
            className="input num grow" inputMode="numeric" placeholder="8480000123456"
            value={aMano}
            onChange={(ev) => setAMano(soloDigitos(ev.target.value).slice(0, 14))}
          />
          <button className="btn btn-primary btn-sm" disabled={aMano.length < 8} onClick={() => cantar(aMano)}>
            Buscar
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={desdeFoto} style={{ display: "none" }} />
    </div>
  );
}
