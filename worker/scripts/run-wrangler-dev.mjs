import { spawn } from "node:child_process";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error(
    "Missing SUPABASE_URL/VITE_SUPABASE_URL for worker dev. The worker must target the same Supabase project as the app."
  );
}

const args = ["wrangler", "dev", "--var", `SUPABASE_URL:${supabaseUrl}`];

if (process.env.SUPABASE_JWT_SECRET) {
  args.push("--var", `SUPABASE_JWT_SECRET:${process.env.SUPABASE_JWT_SECRET}`);
}

if (process.env.OOSYNC_CURSOR_SECRET) {
  args.push(
    "--var",
    `OOSYNC_CURSOR_SECRET:${process.env.OOSYNC_CURSOR_SECRET}`
  );
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  args.push(
    "--var",
    `SUPABASE_SERVICE_ROLE_KEY:${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  );
}

args.push(...process.argv.slice(2));

const command = process.platform === "win32" ? "npx.cmd" : "npx";
// A local Wrangler proxy disconnect can exit the entire dev server mid-shard.
// Recover only in local CI, with a lifetime limit so persistent failures remain
// failures. Keep the original exit records in the uploaded diagnostic logs.
const maxRestarts = process.env.CI && args.includes("--local") ? 2 : 0;
const useProcessGroup = process.platform !== "win32";
let restarts = 0;
let stopping = false;
let child;
let restartTimer;
let shutdownTimer;

function stopChild(signal) {
  if (!child?.pid) return;
  try {
    // Include npx's Wrangler/workerd descendants, which otherwise can retain
    // the listening port after their immediate parent exits.
    if (useProcessGroup) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    clearTimeout(restartTimer);
    stopChild(signal);
    shutdownTimer ??= setTimeout(() => {
      stopChild("SIGKILL");
      process.exit(1);
    }, 5000);
    shutdownTimer.unref();
  });
}

function startWorker() {
  child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    detached: useProcessGroup,
  });

  // Arguments contain secrets; lifecycle records include only metadata.
  child.on("spawn", () => {
    console.error(
      `[worker-launcher] ${new Date().toISOString()} started pid=${child.pid}`
    );
  });
  child.on("error", (error) => {
    console.error(
      `[worker-launcher] ${new Date().toISOString()} spawn failed code=${error.code ?? "unknown"}`
    );
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    console.error(
      `[worker-launcher] ${new Date().toISOString()} exited pid=${child.pid} code=${code} signal=${signal}`
    );
    stopChild("SIGKILL");
    if (!stopping && !signal && code !== 0 && restarts < maxRestarts) {
      restarts += 1;
      console.error(
        `[worker-launcher] restarting local CI worker (${restarts}/${maxRestarts}) in 1000ms`
      );
      restartTimer = setTimeout(startWorker, 1000);
      return;
    }
    clearTimeout(shutdownTimer);
    process.exit(code ?? 1);
  });
}

startWorker();
