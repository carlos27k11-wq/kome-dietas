import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PinGate from "./components/PinGate";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PinGate>
      <App />
    </PinGate>
  </React.StrictMode>
);
