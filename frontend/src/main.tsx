import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DEMO, installerDemo } from "./demo";
import "./styles.css";

if (DEMO) installerDemo();

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
