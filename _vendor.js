import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import * as QR from "html5-qrcode";
window.React = React.default || React;
window.__vendor = {
  "react": React.default ? Object.assign(React.default, React) : React,
  "react-dom/client": ReactDOMClient,
  "@supabase/supabase-js": { createClient },
  "html5-qrcode": QR,
};
window.require = (name) => {
  const m = window.__vendor[name];
  if (!m) throw new Error("Módulo no encontrado: " + name);
  return m;
};
