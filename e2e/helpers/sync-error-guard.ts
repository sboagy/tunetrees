import { inspect } from "node:util";
import type {
  BrowserContext,
  ConsoleMessage,
  Page,
  Request,
  Response,
} from "@playwright/test";
import { SyncErrorLedger } from "./sync-error-ledger";

const COMPLETE = "[E2ESyncGuard] completed";
const FAILED = "[E2ESyncGuard] failed:";
const BACKEND_PATHS = ["/api/sync", "/rest/v1/", "/auth/v1/"];
function matchesPath(path: string, prefix: string): boolean {
  return path === prefix || (prefix.endsWith("/") && path.startsWith(prefix));
}
const scopes = new WeakMap<
  BrowserContext,
  Set<{ paths: readonly string[]; reason: string }>
>();
type TrackedRequest = {
  key: string;
  path: string;
  started: number;
  finished?: number;
  validResponse?: boolean;
  expected: boolean;
  page: Page;
};
const activeRequests = new WeakMap<BrowserContext, Set<TrackedRequest>>();
const offlineScopes = new WeakMap<BrowserContext, () => void>();

/** Declare only the endpoints deliberately broken during this phase; call the returned end function afterwards. */
export function expectSyncFailures(
  context: BrowserContext,
  reason: string,
  paths: readonly string[]
): () => void {
  if (
    !reason.trim() ||
    paths.length === 0 ||
    paths.some(
      (path) => !BACKEND_PATHS.some((prefix) => matchesPath(path, prefix))
    )
  )
    throw new Error(
      "Expected sync failures require a reason and endpoint paths"
    );
  const scope = { paths, reason };
  const active = scopes.get(context) ?? new Set();
  scopes.set(context, active);
  active.add(scope);
  // Include requests interrupted by entering the phase, not just requests begun inside it.
  // Ownership remains on the request when reporting is delayed until after reconnect.
  for (const request of activeRequests.get(context) ?? []) {
    if (paths.some((prefix) => matchesPath(request.path, prefix)))
      request.expected = true;
  }
  return () => {
    active.delete(scope);
  };
}

/** Explicit offline phase: backend failures are expected only until connectivity is restored. */
export async function setOfflineForTest(
  context: BrowserContext,
  offline: boolean
): Promise<void> {
  if (offline && !offlineScopes.has(context)) {
    offlineScopes.set(
      context,
      expectSyncFailures(context, "Deliberate offline test/setup phase", [
        "/api/sync",
        "/rest/v1/",
        "/auth/v1/",
      ])
    );
  }
  await context.setOffline(offline);
  if (!offline) {
    offlineScopes.get(context)?.();
    offlineScopes.delete(context);
  }
}

function backendKey(request: Request): string | undefined {
  const url = new URL(request.url());
  if (!BACKEND_PATHS.some((path) => matchesPath(url.pathname, path))) return;
  return `${request.method()} ${url.origin}${url.pathname}${url.search}`;
}

function expected(context: BrowserContext, request: Request): boolean {
  const path = new URL(request.url()).pathname;
  return [...(scopes.get(context) ?? [])].some((scope) =>
    scope.paths.some((prefix) => matchesPath(path, prefix))
  );
}

export async function installSyncErrorGuard(
  context: BrowserContext,
  recoveryMs = 30000
): Promise<{ finish: () => Promise<void> }> {
  const ledgers = new Map<Page, SyncErrorLedger>();
  const requests = new WeakMap<Request, TrackedRequest>();
  const active = new Set<TrackedRequest>();
  activeRequests.set(context, active);
  const expectedErrors = new Map<Page, Set<string>>();
  const consoleErrors = new Map<Page, Set<string>>();
  const isExpectedConsole = (page: Page, text: string) => {
    const details = expectedErrors.get(page) ?? new Set<string>();
    return [...details].some((detail) => {
      const status = /HTTP (\d{3})/.exec(detail)?.[1];
      if (status && new RegExp(String.raw`\b${status}\b`).test(text))
        return true;
      if (
        /net::|Failed to fetch|NetworkError/.test(detail) &&
        /Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/.test(text)
      )
        return true;
      // oosync emits this exact wrapper after a failed pending-change upload;
      // it omits the transport cause. Do not exempt arbitrary "upload failed" logs.
      return (
        detail.startsWith("/api/sync:") &&
        text
          .split("\n", 1)[0]
          .endsWith(
            "Cannot syncDown while pending changes exist - upload failed. Local data preserved."
          )
      );
    });
  };
  const tasks = new Set<Promise<void>>();
  const listeners = new Map<Page, (message: ConsoleMessage) => void>();
  let finished = false;
  const ledgerFor = (page: Page) => {
    let ledger = ledgers.get(page);
    if (!ledger) {
      ledger = new SyncErrorLedger(recoveryMs);
      ledgers.set(page, ledger);
    }
    return ledger;
  };
  const attach = (page: Page) => {
    const ledger = ledgerFor(page);
    const onConsole = (message: ConsoleMessage) => {
      const text = message.text();
      if (text === COMPLETE) {
        ledger.completedSync();
        // Keep attribution for delayed summaries of expected transport failures.
      }
      // Restrict console enforcement to sync failures, not arbitrary application error tests.
      if (
        !text.startsWith(FAILED) &&
        (!/\[(SyncService|SyncEngine|TTAuthProvider|GenreFilter|SyncDiag)\]/.test(
          text
        ) ||
          !/failed|\berror\b/i.test(text))
      )
        return;
      // Match recorded expected transport failures, even when their status summary is delayed.
      // Other endpoint failures still have their own ledger entry and cannot be exempted here.
      if (isExpectedConsole(page, text)) return;
      const messages = consoleErrors.get(page) ?? new Set<string>();
      consoleErrors.set(page, messages);
      messages.add(text);
      ledger.fail(`console:${text}`, text);
    };
    page.on("console", onConsole);
    listeners.set(page, onConsole);
  };
  context.on("page", attach);
  for (const page of context.pages()) attach(page);

  // Observe the transport result version, independent of asynchronous UI refresh callbacks. Each document
  // reports only version transitions; reading the same successful status cannot recover an error.
  await context.addInitScript(() => {
    let previous = "";
    const checkStatus = () => {
      const marker = document.querySelector<HTMLElement>(
        "[data-sync-result-version]"
      );
      if (!marker) return;
      const version = marker.dataset.syncResultVersion ?? "";
      if (version === previous) return;
      previous = version;
      if (
        Number(version) > 0 &&
        marker.dataset.syncSuccess === "true" &&
        marker.dataset.syncErrorCount === "0"
      ) {
        console.debug("[E2ESyncGuard] completed");
      } else if (
        Number(version) > 0 &&
        (marker.dataset.syncSuccess === "false" ||
          Number(marker.dataset.syncErrorCount) > 0)
      ) {
        console.debug(
          `[E2ESyncGuard] failed: ${marker.dataset.syncErrorSummary || "Sync reported failure without an error summary"}`
        );
      }
    };
    const observer = new MutationObserver(checkStatus);
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-sync-result-version",
        "data-sync-success",
        "data-sync-error-count",
      ],
    });
  });

  const onRequest = (request: Request) => {
    const key = backendKey(request);
    if (!key || request.serviceWorker()) return;
    const page = request.frame().page();
    const entry: TrackedRequest = {
      key,
      path: new URL(request.url()).pathname,
      started: ledgerFor(page).startRequest(),
      expected: expected(context, request),
      page,
    };
    requests.set(request, entry);
    active.add(entry);
  };
  const failRequest = (request: Request, detail: string) => {
    const entry = requests.get(request);
    if (!entry) return;
    if (entry.expected || expected(context, request)) {
      const details = expectedErrors.get(entry.page) ?? new Set<string>();
      expectedErrors.set(entry.page, details);
      details.add(`${entry.path}: ${detail}`);
      // Browser status/console delivery may precede Playwright's request-failure event.
      for (const message of consoleErrors.get(entry.page) ?? []) {
        if (isExpectedConsole(entry.page, message))
          ledgerFor(entry.page).dismissExpected(`console:${message}`);
      }
      return;
    }
    ledgerFor(entry.page).fail(entry.key, `${entry.key}: ${detail}`);
  };
  const onFailed = (request: Request) => {
    const entry = requests.get(request);
    if (entry) active.delete(entry);
    const error = request.failure()?.errorText ?? "request failed";
    // Browser navigation cancels requests; it is not a failed backend response.
    if (error.includes("ERR_ABORTED")) return;
    failRequest(request, error);
  };
  const recordSuccess = (entry: TrackedRequest) => {
    if (entry.validResponse && entry.finished !== undefined) {
      ledgerFor(entry.page).requestSucceeded(
        entry.key,
        entry.started,
        entry.finished
      );
    }
  };
  const onFinished = (request: Request) => {
    const entry = requests.get(request);
    if (!entry) return;
    active.delete(entry);
    entry.finished = ledgerFor(entry.page).requestFinished();
    recordSuccess(entry);
  };
  const onResponse = (response: Response) => {
    const request = response.request();
    const entry = requests.get(request);
    if (!entry) return;
    if (
      response.status() >= 500 ||
      (new URL(request.url()).pathname === "/api/sync" &&
        response.status() >= 400)
    ) {
      failRequest(request, `HTTP ${response.status()}`);
    } else if (response.ok()) {
      const task = (async () => {
        if (
          new URL(request.url()).pathname === "/api/sync" &&
          request.method() === "POST"
        ) {
          const body: unknown = await response.json();
          if (
            body &&
            typeof body === "object" &&
            "errors" in body &&
            Array.isArray(body.errors) &&
            body.errors.length > 0
          ) {
            failRequest(
              request,
              `Sync response contains errors: ${JSON.stringify(body.errors)}`
            );
            return;
          }
        }
        entry.validResponse = true;
        recordSuccess(entry);
      })().catch((error: unknown) =>
        failRequest(
          request,
          `Unreadable sync response: ${error instanceof Error ? error.message : inspect(error)}`
        )
      );
      tasks.add(task);
      void task.finally(() => tasks.delete(task));
    }
  };
  context.on("request", onRequest);
  context.on("requestfailed", onFailed);
  context.on("requestfinished", onFinished);
  context.on("response", onResponse);

  return {
    finish: async () => {
      if (finished) return;
      finished = true;
      try {
        // Let application retries demonstrate recovery. Do not force a test-only sync.
        const deadline = Date.now() + recoveryMs + 1000;
        while (true) {
          const problems = [...ledgers.values()].flatMap((ledger) =>
            ledger.problems()
          );
          if (problems.length === 0 && active.size === 0 && tasks.size === 0)
            return;
          if (
            Date.now() >= deadline ||
            problems.some((problem) =>
              problem.startsWith("Recovery deadline exceeded:")
            )
          ) {
            throw new Error(
              `Unresolved backend/sync errors in this test:\n${problems.join("\n")}\nPending requests: ${[...active].map((entry) => entry.key).join(", ") || "none"}; response inspections: ${tasks.size}`
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } finally {
        context.off("page", attach);
        context.off("request", onRequest);
        context.off("requestfailed", onFailed);
        context.off("requestfinished", onFinished);
        activeRequests.delete(context);
        context.off("response", onResponse);
        for (const [page, listener] of listeners) page.off("console", listener);
      }
    },
  };
}
