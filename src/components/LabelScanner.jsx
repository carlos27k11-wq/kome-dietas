import React, { useCallback, useEffect, useRef, useState } from "react";
import { PixelBar } from "./ui";
import { prepararImagen, leerEtiqueta } from "../lib/ocr";

/* ============================================================
   Lector de etiquetas: apuntas a la tabla de información
   nutricional, se hace una foto y se rellenan los valores solos.
   Lo que salga hay que repasarlo: el lector se equivoca.
   ============================================================ */

// el recuadro que se ve en pantalla; la foto se recorta igual
const MARCO = { w: 0.9, h: 0.7 };

const NOMBRES = {
  kcal_100: "Kcal / 100 g",
  protein_100: "Proteína",
  carbs_100: "Carbos",
  fat_100: "Grasa",
  fiber_100: "Fibra",
  sugars_100: "Azúcares",
  sat_fat_100: "Saturadas",
  sodium_100: "Sodio (mg)",
  default_serving_g: "Ración (g)",
};
const ORDEN = Object.keys(NOMBRES);

export default function LabelScanner({ onValues, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const vivo = useRef(true);

  const hayCamara =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia;

  const [fase, setFase] = useState("camara"); // camara | leyendo | revisar
  const [estado, setEstado] = useState(hayCamara ? "Abriendo la cámara…" : "");
  const [prog, setProg] = useState({ msg: "", pct: 0 });
  const [err, setErr] = useState("");
  const [res, setRes] = useState(null);
  const [verTexto, setVerTexto] = useState(false);

  const soltarCamara = useCallback(() => {
    const s = streamRef.current;
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }, []);

  useEffect(() => () => { vivo.current = false; soltarCamara(); }, [soltarCamara]);

  /* --- cámara en marcha mientras estemos encuadrando --- */
  useEffect(() => {
    if (fase !== "camara" || !hayCamara) return;
    let cancelado = false;
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
      })
      .then((stream) => {
        if (cancelado) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; v.play().catch(() => {}); }
        setEstado("Encaja la tabla dentro del marco y dispara");
      })
      .catch(() => setEstado("No se pudo abrir la cámara. Puedes elegir una foto de la galería."));
    return () => { cancelado = true; soltarCamara(); };
  }, [fase, hayCamara, soltarCamara]);

  /* --- de la imagen a los valores --- */
  const leer = useCallback(async (canvas) => {
    setFase("leyendo");
    setErr("");
    setProg({ msg: "preparando el lector…", pct: 0 });
    soltarCamara();
    try {
      const r = await leerEtiqueta(canvas, (p) => vivo.current && setProg(p));
      if (!vivo.current) return;
      setRes(r);
      setVerTexto(false);
      setFase("revisar");
    } catch (e) {
      if (!vivo.current) return;
      setErr(e?.message || "No se pudo leer la etiqueta");
      setFase("camara");
    }
  }, [soltarCamara]);

  const disparar = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) { setErr("La cámara todavía no está lista"); return; }
    try {
      leer(await prepararImagen(v, { crop: MARCO }));
    } catch (e) {
      setErr(e?.message || "No se pudo hacer la foto");
    }
  }, [leer]);

  const desdeArchivo = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      leer(await prepararImagen(file));
    } catch (er) {
      setErr(er?.message || "No se pudo abrir la foto");
    }
  }, [leer]);

  /* ---------------- leyendo ---------------- */
  if (fase === "leyendo") {
    return (
      <div className="px" style={{ padding: 14 }}>
        <div className="eyebrow">Leyendo la etiqueta</div>
        <p className="tiny dim blink" style={{ margin: "6px 0 10px" }}>{prog.msg || "trabajando…"}</p>
        <PixelBar value={prog.pct} max={100} color="var(--sakura)" />
        <p className="tiny dim" style={{ marginTop: 10 }}>
          La primera vez se descarga el lector (unos megas). Después va más rápido.
        </p>
      </div>
    );
  }

  /* ---------------- repasar lo leído ---------------- */
  if (fase === "revisar") {
    const v = res?.valores || {};
    const encontrados = ORDEN.filter((k) => v[k] != null);
    return (
      <div className="px" style={{ padding: 14 }}>
        <div className="eyebrow">Lo que he leído</div>

        {encontrados.length === 0 ? (
          <p className="tiny" style={{ color: "var(--kaki)", margin: "8px 0" }}>
            No he sacado nada en claro. Prueba con más luz, más cerca y con la tabla recta.
          </p>
        ) : (
          <div style={{ margin: "8px 0 12px" }}>
            {encontrados.map((k) => (
              <div key={k} className="row-b tiny" style={{ padding: "4px 0" }}>
                <span className="dim">{NOMBRES[k]}</span>
                <span className="num">
                  {v[k]}
                  {k === "kcal_100" && v.kcal_calculada ? " (calculadas)" : ""}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="tiny dim" style={{ margin: "0 0 10px" }}>
          Repásalos: si algún número no cuadra, se cambia a mano en el formulario.
        </p>

        {encontrados.length > 0 && (
          <button className="btn btn-primary btn-block" onClick={() => onValues(v)}>
            Usar estos valores
          </button>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-sm grow" onClick={() => { setRes(null); setFase("camara"); }}>
            Repetir la foto
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setVerTexto((t) => !t)}>
            {verTexto ? "Ocultar texto" : "Ver texto"}
          </button>
        </div>

        {verTexto && (
          <pre className="tiny dim" style={{ whiteSpace: "pre-wrap", marginTop: 10, maxHeight: 160, overflow: "auto" }}>
            {res?.texto || ""}
          </pre>
        )}
      </div>
    );
  }

  /* ---------------- encuadrando ---------------- */
  return (
    <div className="px" style={{ padding: 10 }}>
      {hayCamara ? (
        <div style={{ position: "relative", background: "#000", lineHeight: 0 }}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{ width: "100%", display: "block", maxHeight: "46vh", objectFit: "contain" }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: `${((1 - MARCO.w) / 2) * 100}%`,
              top: `${((1 - MARCO.h) / 2) * 100}%`,
              width: `${MARCO.w * 100}%`,
              height: `${MARCO.h * 100}%`,
              border: "2px dashed var(--sakura)",
              pointerEvents: "none",
            }}
          />
        </div>
      ) : (
        <p className="tiny dim" style={{ margin: 0 }}>
          {typeof window !== "undefined" && !window.isSecureContext
            ? "Aquí no puedo abrir la cámara: hace falta una página segura (un servidor local o la versión publicada)."
            : "Este navegador no me deja abrir la cámara."}{" "}
          Haz la foto con el móvil, elígela abajo y la leo igual.
        </p>
      )}

      {estado && <p className="tiny dim center" style={{ margin: "8px 0" }}>{estado}</p>}
      {err && <p className="tiny center" style={{ color: "var(--kaki)", margin: "0 0 8px" }}>{err}</p>}

      <div className="row">
        {hayCamara && (
          <button className="btn btn-primary grow" onClick={disparar}>📸 Hacer la foto</button>
        )}
        <button className="btn grow" onClick={() => fileRef.current?.click()}>🖼 Elegir foto</button>
      </div>
      {onClose && (
        <button className="btn btn-sm btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onClose}>
          Cerrar el lector
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={desdeArchivo}
        style={{ display: "none" }}
      />
    </div>
  );
}
