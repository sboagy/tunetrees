// Centralized extended logging utility.
// Enables dynamic toggle without reload via window.__TT_LOGGING__ object.
// Precedence order (highest first):
// 1. window.__TT_LOGGING__.enabled (runtime override)
// 2. localStorage key 'tt_extended_logging'
// 3. process.env.NEXT_PUBLIC_EXTENDED_LOGGING (baked at build time)
// Default: false

// Provide global type augmentation
export type IExtendedLoggingController = {
  enabled: boolean;
  set: (value: boolean) => void;
  toggle: () => boolean;
  info: () => void;
};

// Runtime cached state (for SSR safety we lazily resolve on first call)
let cachedEnabled: boolean | null = null;

function readEnvDefault(): boolean {
  if (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_EXTENDED_LOGGING
  ) {
    return (
      process.env.NEXT_PUBLIC_EXTENDED_LOGGING === "1" ||
      process.env.NEXT_PUBLIC_EXTENDED_LOGGING?.toLowerCase() === "true"
    );
  }
  return false;
}

function readLocalStorage(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem("tt_extended_logging");
    if (v === null) return null;
    return v === "1" || v.toLowerCase() === "true";
  } catch {
    return null;
  }
}

function writeLocalStorage(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("tt_extended_logging", value ? "1" : "0");
  } catch {
    // ignore
  }
}

function readWindowOverride(): boolean | null {
  if (typeof window === "undefined") return null;
  const anyWin = window as unknown as {
    __TT_LOGGING__?: { enabled?: boolean };
  };
  if (
    anyWin.__TT_LOGGING__ &&
    typeof anyWin.__TT_LOGGING__.enabled === "boolean"
  ) {
    return anyWin.__TT_LOGGING__.enabled;
  }
  return null;
}

function ensureController(): IExtendedLoggingController | null {
  if (typeof window === "undefined") return null;
  const anyWin = window as unknown as {
    __TT_LOGGING__?: IExtendedLoggingController;
  };
  if (!anyWin.__TT_LOGGING__) {
    anyWin.__TT_LOGGING__ = {
      enabled: isExtendedLoggingEnabled(),
      set: (value: boolean) => {
        cachedEnabled = value;
        writeLocalStorage(value);
        if (anyWin.__TT_LOGGING__) {
          anyWin.__TT_LOGGING__.enabled = value;
        }
        console.info(`[TT_LOGGING] Extended logging set -> ${value}`);
      },
      toggle: () => {
        const next = !isExtendedLoggingEnabled();
        anyWin.__TT_LOGGING__?.set(next);
        return next;
      },
      info: () => {
        console.info("[TT_LOGGING] status=", isExtendedLoggingEnabled());
        console.info(
          "Usage: window.__TT_LOGGING__.toggle(); window.__TT_LOGGING__.set(true|false);",
        );
      },
    };
  }
  return anyWin.__TT_LOGGING__;
}

export function isExtendedLoggingEnabled(): boolean {
  // Window override wins
  const w = readWindowOverride();
  if (w !== null) {
    cachedEnabled = w;
    return w;
  }
  const ls = readLocalStorage();
  if (ls !== null) {
    cachedEnabled = ls;
    return ls;
  }
  if (cachedEnabled === null) {
    cachedEnabled = readEnvDefault();
  }
  return cachedEnabled ?? false;
}

export function setExtendedLogging(value: boolean): void {
  cachedEnabled = value;
  writeLocalStorage(value);
  if (typeof window !== "undefined") {
    ensureController();
    const anyWin = window as unknown as {
      __TT_LOGGING__?: IExtendedLoggingController;
    };
    if (anyWin.__TT_LOGGING__) anyWin.__TT_LOGGING__.enabled = value;
  }
}

export function logVerbose(...args: unknown[]): void {
  if (!isExtendedLoggingEnabled()) return;
  console.log(...args);
}

// Helper to attach controller early (call in a small client bootstrap component)
export function attachLoggingController(): void {
  if (typeof window === "undefined") return;
  ensureController();
}
