import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Schriften lokal ausliefern statt von Google Fonts (keine Datenübertragung an Dritte)
import "@fontsource/archivo/latin-400.css";
import "@fontsource/archivo/latin-500.css";
import "@fontsource/archivo/latin-600.css";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/big-shoulders-display/latin-800";
import "@fontsource/big-shoulders-display/latin-900";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
