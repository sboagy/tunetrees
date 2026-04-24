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

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  args.push(
    "--var",
    `SUPABASE_SERVICE_ROLE_KEY:${process.env.SUPABASE_SERVICE_ROLE_KEY}`
  );
}

args.push(...process.argv.slice(2));

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
