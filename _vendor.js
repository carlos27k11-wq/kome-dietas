import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
window.React = React.default || React;
window.__vendor = {
  "react": React.default ? Object.assign(React.default, React) : React,
  "react-dom/client": ReactDOMClient,
  "@supabase/supabase-js": { createClient },
};
window.require = (name) => {
  const m = window.__vendor[name];
  if (!m) throw new Error("Módulo no encontrado: " + name);
  return m;
};
