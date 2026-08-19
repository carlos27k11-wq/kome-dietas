import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
];

export default function BarcodeScanner({ onDetected, onError }) {
  const boxId = useRef(`scan-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const [status, setStatus] = useState("Pidiendo acceso a la cámara…");
  const done = useRef(false);
  const insecure = typeof window !== "undefined" && !window.isSecureContext;

  useEffect(() => {
    if (insecure) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(boxId.current, { formatsToSupport: FORMATS, verbose: false });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 150 }, aspectRatio: 1.4 },
        (text) => {
          if (done.current) return;
          done.current = true;
          if (navigator.vibrate) navigator.vibrate(35);
          onDetected?.(text.replace(/\D/g, ""));
        },
        () => {}
      )
      .then(() => !cancelled && setStatus("Enfoca el código de barras"))
      .catch((e) => {
        setStatus("No se pudo abrir la cámara. Revisa los permisos del navegador.");
        onError?.(e);
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [onDetected, onError, insecure]);

  if (insecure) {
    return (
      <div className="empty">
        <p className="tiny">
          La cámara solo funciona en páginas seguras. Estás abriendo el archivo directamente
          desde el disco.
        </p>
        <p className="tiny dim">
          Arranca un servidor local (<code>npx serve</code> o <code>python3 -m http.server</code>)
          y entra por <code>http://localhost</code>, o usa la versión publicada. Mientras tanto,
          busca el alimento por su nombre.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        id={boxId.current}
        style={{ width: "100%", background: "#000", border: "var(--px) solid var(--line)", overflow: "hidden", minHeight: 200 }}
      />
      <p className="tiny dim center" style={{ marginTop: 10 }}>{status}</p>
    </div>
  );
}
