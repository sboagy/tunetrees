import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const launcher = fileURLToPath(
  new URL("./run-wrangler-dev.mjs", import.meta.url)
);
const options = { skip: process.platform === "win32", timeout: 15000 };

async function launchFixture(
  t,
  { failures = 0, ci = "true", local = true, hold = false } = {}
) {
  const directory = await mkdtemp(join(tmpdir(), "worker-launcher-"));
  const counter = join(directory, "attempts");
  await writeFile(counter, "0");
  // Use real subprocesses to exercise exit codes and signal forwarding without
  // starting Wrangler, accessing credentials, or requiring a database.
  await writeFile(
    join(directory, "npx"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const count = Number(fs.readFileSync(process.env.LAUNCHER_TEST_COUNTER, 'utf8')) + 1;
fs.writeFileSync(process.env.LAUNCHER_TEST_COUNTER, String(count));
if (process.env.LAUNCHER_TEST_HOLD === 'true') {
  process.on('SIGTERM', () => process.exit(0));
  console.log('fixture-ready');
  setInterval(() => {}, 1000);
} else {
  process.exit(count <= Number(process.env.LAUNCHER_TEST_FAILURES) ? 1 : 0);
}
`,
    { mode: 0o755 }
  );
  const child = spawn(
    process.execPath,
    [launcher, ...(local ? ["--local"] : [])],
    {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CI: ci,
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_JWT_SECRET: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        OOSYNC_CURSOR_SECRET: "",
        LAUNCHER_TEST_COUNTER: counter,
        LAUNCHER_TEST_FAILURES: String(failures),
        LAUNCHER_TEST_HOLD: String(hold),
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let logs = "";
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const completed = once(child, "close");
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGTERM");
    await completed;
    await rm(directory, { recursive: true, force: true });
  });
  return {
    child,
    completed,
    attempts: async () => Number(await readFile(counter, "utf8")),
    logs: () => logs,
  };
}

test(
  "local CI recovers after a worker process exits unexpectedly",
  options,
  async (t) => {
    const run = await launchFixture(t, { failures: 1 });
    assert.deepEqual(await run.completed, [0, null]);
    assert.equal(await run.attempts(), 2);
    assert.match(run.logs(), /restarting local CI worker \(1\/2\)/);
  }
);

test(
  "persistent failures exhaust the restart budget and fail",
  options,
  async (t) => {
    const run = await launchFixture(t, { failures: 10 });
    assert.deepEqual(await run.completed, [1, null]);
    assert.equal(await run.attempts(), 3);
  }
);

test(
  "ordinary local development does not restart failed workers",
  options,
  async (t) => {
    const run = await launchFixture(t, { failures: 1, ci: "" });
    assert.deepEqual(await run.completed, [1, null]);
    assert.equal(await run.attempts(), 1);
  }
);

test(
  "CI without local mode does not restart failed workers",
  options,
  async (t) => {
    const run = await launchFixture(t, { failures: 1, local: false });
    assert.deepEqual(await run.completed, [1, null]);
    assert.equal(await run.attempts(), 1);
  }
);

test(
  "SIGTERM shuts down the child without restarting it",
  options,
  async (t) => {
    const run = await launchFixture(t, { hold: true });
    await once(run.child.stdout, "data");
    run.child.kill("SIGTERM");
    assert.deepEqual(await run.completed, [0, null]);
    assert.equal(await run.attempts(), 1);
    assert.doesNotMatch(run.logs(), /restarting/);
  }
);
