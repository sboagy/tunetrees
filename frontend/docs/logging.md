# Frontend Extended Logging

Extended (verbose) logging is now opt-in to reduce console noise and runtime overhead.

## Enabling / Disabling

Precedence (highest wins):
1. Runtime override: `window.__TT_LOGGING__.enabled`
2. `localStorage['tt_extended_logging']` ("1"/"0" or "true"/"false")
3. Build-time env: `NEXT_PUBLIC_EXTENDED_LOGGING` ("1" or "true")

Default: disabled.

### Quick Runtime Control (No Reload Needed)
Open DevTools console and use:
```js
// Show current status & usage help
window.__TT_LOGGING__.info();

// Toggle
window.__TT_LOGGING__.toggle();

// Explicit on/off
window.__TT_LOGGING__.set(true);  // enable
window.__TT_LOGGING__.set(false); // disable
```
These operations automatically persist to `localStorage` so the state survives reloads.

### Build-Time Enable
Add to `.env.local`:
```
NEXT_PUBLIC_EXTENDED_LOGGING=1
```
(Still can be turned off later at runtime.)

## Using in Code
Import helpers:
```ts
import { logVerbose, isExtendedLoggingEnabled } from "@/lib/logging";
```
Wrap inexpensive logs directly:
```ts
logVerbose("Component mounted", props.id);
```
For expensive serialization, defer work until enabled:
```ts
logVerbose(
  (() => {
    if (!isExtendedLoggingEnabled()) return "MyComponent: state"; // cheap path
    return `MyComponent: state = ${JSON.stringify(state)}`;
  })()
);
```

## Why This Pattern
- Avoids scattering `if (...) console.log` boilerplate.
- Prevents paying `JSON.stringify` cost when disabled.
- Allows dynamic activation in a running container (diagnostics / reproduction) without rebuild.

## Global Controller Shape
```ts
window.__TT_LOGGING__ = {
  enabled: boolean,
  set(value: boolean): void,
  toggle(): boolean,
  info(): void
}
```

## Migration Notes
Legacy `LF*` console.log statements have been wrapped in `logVerbose` (e.g., table state persistence, main panel renders). Add `logVerbose` for any future high-frequency instrumentation.

