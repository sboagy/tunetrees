import type { Page, TestInfo } from "@playwright/test";

/**
 * Logs test start with timestamp and test details
 */
export function logTestStart(testInfo: TestInfo) {
  const timestamp = new Date().toISOString();
  console.log(`🧪 [${timestamp}] Starting test: "${testInfo.title}"`);
  console.log(`📁 Test file: ${testInfo.file}`);
  console.log(`🎯 Project: ${testInfo.project.name}`);
  console.log(`⚙️  Worker index: ${testInfo.workerIndex}`);
  console.log("─".repeat(80));
}

/**
 * Logs test completion with timestamp and result
 */
export function logTestEnd(testInfo: TestInfo) {
  const timestamp = new Date().toISOString();
  const status = testInfo.status;
  const statusEmoji =
    status === "passed" ? "✅" : status === "failed" ? "❌" : "⚠️";

  console.log("─".repeat(80));
  console.log(
    `${statusEmoji} [${timestamp}] Completed test: "${testInfo.title}"`,
  );
  console.log(`📊 Status: ${status}`);
  console.log(`⏱️  Duration: ${testInfo.duration}ms`);
  console.log(`🔄 Retry: ${testInfo.retry}`);
  console.log("");
}

/**
 * Logs browser context creation
 */
export function logBrowserContextStart() {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] Creating new browser context`);
}

/**
 * Logs browser context cleanup
 */
export function logBrowserContextEnd() {
  const timestamp = new Date().toISOString();
  console.log(`🗑️  [${timestamp}] Cleaning up browser context`);
}

/**
 * Attach console/network/error logs from the browser page to stdout and test artifacts.
 * Call this in test.beforeEach with the current page and testInfo.
 */
export function attachPageConsoleLogging(page: Page, testInfo: TestInfo) {
  const lines: string[] = [];
  const push = (s: string) => {
    lines.push(s);
    // Also mirror to test output for live visibility
    console.log(s);
  };
  page.on("console", async (msg) => {
    try {
      const type = msg.type();
      const text = msg.text();
      const loc = msg.location();
      let args: unknown[] = [];
      try {
        args = await Promise.all(
          msg.args().map((a) => a.jsonValue().catch(() => "[unserializable]")),
        );
      } catch {
        // ignore
      }
      const argStr = args.length > 0 ? JSON.stringify(args) : "";
      push(
        `[browser:${type}] ${text} ${argStr} @ ${loc.url}:${loc.lineNumber}:${loc.columnNumber}`,
      );
    } catch {
      // ignore
    }
  });
  page.on("pageerror", (err) => {
    push(`[pageerror] ${err.name}: ${err.message}\n${err.stack ?? ""}`);
  });
  page.on("requestfailed", (req) => {
    const f = req.failure();
    push(
      `[requestfailed] ${req.method()} ${req.url()} -> ${f?.errorText ?? "unknown"}`,
    );
  });
  page.context().on("page", (p) => {
    p.on("console", (msg) => push(`[popup:${msg.type()}] ${msg.text()}`));
  });

  // Stash a disposer on testInfo to attach at the end
  (testInfo as unknown as { __browserLogs?: string[] }).__browserLogs = lines;
}

/**
 * Attach collected browser logs to the Playwright report. Call in afterEach.
 */
export async function attachCollectedBrowserLogs(testInfo: TestInfo) {
  const logs =
    (testInfo as unknown as { __browserLogs?: string[] }).__browserLogs ?? [];
  if (logs.length > 0) {
    await testInfo.attach("browser-console", {
      body: logs.join("\n"),
      contentType: "text/plain",
    });
  }
}
