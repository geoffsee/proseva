import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { Provider } from "./components/ui/provider";
import App from "./App";
import "./index.css";

const isElectron = !!(window as { electronAPI?: unknown }).electronAPI;
const Router = isElectron ? HashRouter : BrowserRouter;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
  import("./sw-bridge");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider>
      <Router>
        <App />
      </Router>
    </Provider>
  </StrictMode>,
);
