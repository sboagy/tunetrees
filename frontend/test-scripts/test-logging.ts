import type { TestInfo } from "@playwright/test";

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
 * Logs server health check
 */
export async function logServerHealth(baseURL: string) {
  const timestamp = new Date().toISOString();
  try {
    const response = await fetch(`${baseURL}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    console.log(
      `🏥 [${timestamp}] Server health check: ${response.status} ${response.statusText}`,
    );
    return response.ok;
  } catch (error) {
    console.log(`🏥 [${timestamp}] Server health check failed:`, error);
    return false;
  }
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
