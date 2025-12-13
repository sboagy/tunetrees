/* @refresh reload */
import { render } from "solid-js/web";
import "./App.css";
import "./index.css";
import App from "./App.tsx";
// Attach test API in all environments (safe no-op in production)
import "./test/test-api";

const root = document.getElementById("root");

render(() => <App />, root!);

// In development mode, unregister any existing service workers to prevent caching issues
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then(() => {
        console.log("[PWA] Unregistered service worker in dev mode");
      });
    }
  });
}
// Note: Service worker registration is now handled by the UpdatePrompt component
