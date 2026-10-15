import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

/** Keep migration URLs identical in development and production builds. */
export function sqliteMigrations(): Plugin {
  let directory: string;
  let base: string;
  const migrationNames = async () =>
    (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
      .map((entry) => entry.name)
      .sort();

  return {
    name: "tunetrees-sqlite-migrations",
    configResolved(config) {
      directory = path.resolve(config.root, "drizzle/migrations/sqlite");
      base = config.base;
    },
    async generateBundle() {
      for (const name of await migrationNames()) {
        this.emitFile({
          type: "asset",
          fileName: name,
          source: await readFile(path.join(directory, name)),
        });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const pathname = (req.url ?? "").split("?")[0];
        if (!pathname.startsWith(base)) return next();
        const name = pathname.slice(base.length);
        // Only serve a direct child from the migration directory, never a path.
        if (!/^[^/\\]+\.sql$/.test(name)) return next();
        void (async () => {
          if (!(await migrationNames()).includes(name)) return next();
          const source = await readFile(path.join(directory, name));
          res.setHeader("Content-Type", "application/sql");
          res.setHeader("Content-Length", source.byteLength);
          res.setHeader("Cache-Control", "no-cache");
          res.end(req.method === "HEAD" ? undefined : source);
        })().catch(next);
      });
    },
  };
}
