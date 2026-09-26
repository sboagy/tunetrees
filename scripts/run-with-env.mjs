import { spawn } from "node:child_process";
import { resolve } from "node:path";

const [template, separator, command, ...args] = process.argv.slice(2);
if (!template || separator !== "--" || !command) {
  throw new Error("Usage: run-with-env.mjs <template> -- <command> [args...]");
}

// Use the full path so nested commands in worker/ share the same environment,
// while switching between local, staging, and production still reloads secrets.
const environment = resolve(template);
const loaded = process.env.TUNETREES_LOADED_ENV === environment;
if (process.env.CI && !loaded) {
  throw new Error(`CI environment was not bootstrapped for ${environment}`);
}
const child = spawn(
  loaded ? command : "op",
  loaded ? args : ["run", `--env-file=${environment}`, "--", command, ...args],
  {
    stdio: "inherit",
    env: { ...process.env, TUNETREES_LOADED_ENV: environment },
  }
);

// Preserve graceful shutdown for Playwright's long-running web servers.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  console.error(`Environment command failed: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
});
