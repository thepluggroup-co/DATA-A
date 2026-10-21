import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Application } from "./App";
import "./styles.css";

if ("serviceWorker" in navigator && location.pathname === "/terrain") {
  window.addEventListener("load", () => { void navigator.serviceWorker.register("/service-worker.js"); });
}

createRoot(document.getElementById("racine")!).render(
  <StrictMode>
    <BrowserRouter>
      <Application />
    </BrowserRouter>
  </StrictMode>,
);
