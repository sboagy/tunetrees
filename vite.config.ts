import { execSync } from "node:child_process";
import type { IncomingMessage } from "node:http";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solid from "vite-plugin-solid";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(() => {
  // Determine if we should show Workbox debug logs
  const showWorkboxLogs = process.env.VITE_WORKBOX_DEBUG === "true";
  const disableHmrForE2E = process.env.VITE_DISABLE_HMR_FOR_E2E === "true";

  // Get build-time constants
  const getGitCommit = () => {
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "unknown";
    }
  };

  const getGitBranch = () => {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    } catch {
      return "unknown";
    }
  };

  return {
    // Development server configuration
    server: {
      hmr: disableHmrForE2E ? false : undefined,
      proxy: {
        // Proxy TheSession.org API requests to bypass CORS in development
        // This matches the pattern used by the import utils
        "/api/proxy/thesession": {
          target: "https://thesession.org",
          changeOrigin: true,
          rewrite: (path: string) => {
            // Extract the URL from query parameter and return just the path
            try {
              const url = new URL(path, "http://localhost");
              const targetUrl = url.searchParams.get("url");
              if (targetUrl) {
                const targetUrlObj = new URL(targetUrl);
                return targetUrlObj.pathname + targetUrlObj.search;
              }
            } catch (error) {
              console.error("[Vite Proxy] Error parsing URL:", error);
            }
            return path;
          },
          configure: (proxy) => {
            proxy.on("error", (err) => {
              console.log("[Vite Proxy] Error:", err);
            });
            proxy.on("proxyReq", (proxyReq, req) => {
              console.log(`[Vite Proxy] Proxying: ${req.method} ${req.url}`);
              proxyReq.setHeader("Accept", "application/json");
              proxyReq.setHeader("User-Agent", "TuneTrees-PWA-Dev/1.0");
            });
          },
        },
        "/api/proxy": {
          target: "http://localhost",
          changeOrigin: true,
          router: (req: IncomingMessage) => {
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const targetUrl = url.searchParams.get("url");
              if (targetUrl) {
                return new URL(targetUrl).origin;
              }
            } catch (error) {
              console.error("[Vite Proxy] Invalid proxy URL:", error);
            }
            return "http://localhost";
          },
          rewrite: (path: string) => {
            try {
              const url = new URL(path, "http://localhost");
              const targetUrl = url.searchParams.get("url");
              if (targetUrl) {
                const targetUrlObj = new URL(targetUrl);
                return targetUrlObj.pathname + targetUrlObj.search;
              }
            } catch (error) {
              console.error("[Vite Proxy] Error parsing URL:", error);
            }
            return path;
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              console.log(`[Vite Proxy] Proxying: ${req.method} ${req.url}`);
              proxyReq.setHeader("User-Agent", "TuneTrees-PWA-Dev/1.0");
            });
          },
        },
      },
    },
    worker: {
      format: "es",
    },
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
        registerType: "prompt",
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
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
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
          // Ensure SPA navigations work offline (including URLs with query params like `/?tab=practice`).
          // Workbox expects a precached URL here; using a relative path avoids cache-key mismatches.
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/^\/api/, /^\/assets/],
          // Treat our query-string navigation URLs as equivalent app-shell navigations.
          ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^tab$/],

          // 3. Ensure the SW starts controlling the page immediately
          clientsClaim: true,
          skipWaiting: true,
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
        "@oosync": path.resolve(__dirname, "./node_modules/oosync/src"),
        "@sync-schema": path.resolve(__dirname, "./shared/sync-schema"),
        "@shared-generated": path.resolve(__dirname, "./shared/generated"),
        "solid-sonner": path.resolve(__dirname, "./node_modules/solid-sonner"),
      },
    },
    // Build optimizations
    build: {
      // Increase chunk size warning limit (we'll optimize later)
      chunkSizeWarningLimit: 1000,
      // Enable source maps for production debugging
      sourcemap: true,
      // Rollup options for code splitting
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks
            "vendor-solid": ["solid-js", "@solidjs/router"],
            "vendor-ui": [
              "@kobalte/core",
              "solid-sonner",
              "class-variance-authority",
              "clsx",
              "tailwind-merge",
            ],
            "vendor-data": ["@tanstack/solid-table", "@tanstack/solid-virtual"],
            "vendor-supabase": ["@supabase/supabase-js"],
            // Large libraries that should be separate
            "vendor-drizzle": ["drizzle-orm"],
            "vendor-sql": ["sql.js"],
            // Heavy features loaded on-demand
            // Note: abcjs and jodit should be lazy-loaded in components
          },
        },
      },
    },
    // Define global constants
    define: {
      __WB_DISABLE_DEV_LOGS: !showWorkboxLogs,
      __APP_VERSION__: JSON.stringify(
        process.env.npm_package_version || "0.1.0"
      ),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __GIT_COMMIT__: JSON.stringify(getGitCommit()),
      __GIT_BRANCH__: JSON.stringify(getGitBranch()),
    },
  };
});
