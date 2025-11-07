/* @refresh reload */
import { render } from "solid-js/web";
import "./App.css";
import "./index.css";
import App from "./App.tsx";
// Attach test API in all environments (safe no-op in production)
import "./test/test-api";

const root = document.getElementById("root");

render(() => <App />, root!);

// Register service worker for PWA support (only in production)
if ("serviceWorker" in navigator) {
  // In development mode, unregister any existing service workers to prevent caching issues
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then(() => {
          console.log("[PWA] Unregistered service worker in dev mode");
        });
      }
    });
  } else {
    // In production, register the service worker
    import("virtual:pwa-register").then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          // Service worker update detected
          console.log("[PWA] New version available. Reload to update.");
        },
        onOfflineReady() {
          // App is ready to work offline
          console.log("[PWA] App is ready to work offline!");
        },
        onRegistered(registration: ServiceWorkerRegistration | undefined) {
          // Service worker registered successfully
          console.log("[PWA] Service Worker registered:", registration);
          // Check for updates every hour
          setInterval(
            () => {
              registration?.update();
            },
            60 * 60 * 1000
          );
        },
        onRegisterError(error: unknown) {
          console.error("[PWA] Service Worker registration failed:", error);
        },
      });
    });
  }
}
