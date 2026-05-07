import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppPreferencesProvider } from "./appPreferences";
import App from "./App";
import "./style/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element was not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppPreferencesProvider>
      <App />
    </AppPreferencesProvider>
  </StrictMode>,
);
