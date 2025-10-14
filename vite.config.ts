import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => {
  // Determine if we should show Workbox debug logs
  const showWorkboxLogs = process.env.VITE_WORKBOX_DEBUG === "true";

  return {
    test: {
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/e2e/**", // Exclude Playwright E2E tests
        "**/legacy/**", // Exclude legacy code
        "**/*.spec.ts", // Exclude Playwright test files (use .test.ts for Vitest)
      ],
    },
    plugins: [
      solid(),
      tailwindcss(),
      // Copy SQL migration files to dist
      viteStaticCopy({
        targets: [
          {
            src: "drizzle/migrations/sqlite/*.sql",
            dest: "drizzle/migrations/sqlite",
          },
        ],
      }),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
        manifest: {
          name: "TuneTrees - Music Practice Manager",
          short_name: "TuneTrees",
          description:
            "Spaced repetition practice system for musicians. Learn tunes faster with intelligent scheduling.",
          theme_color: "#1e3a8a",
          background_color: "#ffffff",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          // Cache all static assets INCLUDING WASM and SQL files for offline
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,wasm,sql}"],
          // Runtime caching strategies
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: "CacheFirst",
              options: {
                cacheName: "images-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
          // Clean up old caches
          cleanupOutdatedCaches: true,
          // Inject code to suppress Workbox logs (unless VITE_WORKBOX_DEBUG=true)
          ...(!showWorkboxLogs && {
            additionalManifestEntries: undefined,
            navigateFallbackDenylist: [/^\/api\//],
          }),
        },
        // Inject script to disable Workbox dev logs at runtime
        injectRegister: "inline",
        devOptions: {
          enabled: false, // Disable PWA in development (causes caching issues)
          type: "module",
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Define global constant to suppress Workbox logs at build time
    define: {
      __WB_DISABLE_DEV_LOGS: !showWorkboxLogs,
    },
  };
});
