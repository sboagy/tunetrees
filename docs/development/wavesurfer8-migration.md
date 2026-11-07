# WaveSurfer 8 migration (#902)

Upgrade `wavesurfer.js` from 7.12.11 to 8.0.5. The dependency and lockfile
change only WaveSurfer. Version 8.0.5 supersedes the issue's October 31
snapshot of 8.0.4.

## API and lifecycle review

`src/components/audio/WaveformAudioPlayer.tsx` is the sole runtime consumer.
It uses `WaveSurfer.create` with an external `HTMLAudioElement` and the Regions
plugin, public playback/time/rate/zoom methods, and public playback and region
events. The plugin import already includes the `.js` extension required by v8.
The player does not subclass WaveSurfer, access removed internal subscriptions,
use the renderer event emitter, or use the WebAudio backend.

- `destroy()` is terminal in v8. The keyed audio overlay creates a fresh player
  for each track; destroyed instances are never reused.
- The app owns the supplied audio element. After pausing and destroying
  WaveSurfer, cleanup removes its source and calls `load()` to release pending
  media activity, then revokes any vault object URL. This happens after
  WaveSurfer detaches its listeners, avoiding teardown events changing state.
- Vault lookup completion after unmount remains guarded. WaveSurfer owns its
  decoding/fetch lifecycle and Regions plugin teardown.
- The app does not call `load`/`loadBlob` directly, so v8's rejection of
  superseded loads requires no new application promise handling.
- Playback events and `play(start, end)` remain supported. Pitch-preserving
  tempo, zoom, loop regions, point marks, rename, selection and persistence
  retain their existing APIs. There is no custom volume control in this player;
  volume remains controlled by the device/browser.

The legacy annotation array and version-2 `regionsJson` format are unchanged.
No schema migration, generated contract, shared-library update, or marker-sync
redesign is involved. Old browser bundles can continue reading saved markers
and settings. `ARCHITECTURE.md` remains accurate.

References: [v8 migration notes](https://github.com/katspaugh/wavesurfer.js/releases/tag/8.0.0)
and [8.0.5 release](https://github.com/katspaugh/wavesurfer.js/releases/tag/8.0.5).

## Validation

Use Node 24 and `npm ci --ignore-scripts`. Restart an already-running Vite
server after the clean install if lazy imports return `504 Outdated Optimize
Dep`; these errors prevent the player from mounting at all.

- `npm run format:check`, `npm run lint`, `npm run typecheck`
- `npm run test:unit` (including audio teardown, persistence and transport tests)
- `npm run build` (production build and SQLite WASM asset verification)
- `npm run test:e2e -- e2e/tests/refs-003-audio-player-persistence.spec.ts --project=chromium --project='Mobile Chrome' --workers=1`
- `npm run test:e2e -- e2e/tests/byos-001-private-storage.spec.ts --grep 'reopens cached audio offline|plays legacy R2' --project=chromium --project='Mobile Chrome' --workers=1`

The waveform E2E uses real WaveSurfer with a deterministic WAV served through
mocked provider HTTP. It covers canvas rendering, playback/pause/seek/stop,
loop-boundary playback, annotation save/reopen and tempo/zoom persistence. The BYOS cases cover cached
offline audio and switching between remote legacy R2 and private provider
references. Provider credentials and live third-party services are not needed.

Verified on Node 24.22.2: clean script-free install, formatting, lint, typechecks,
all 818 unit tests, production build and WASM verification passed. The combined
focused browser run passed all six desktop/mobile cases plus auth setup. The
first browser run hit stale Vite optimized dependencies; the same checks passed
after the user restarted Vite.

Audit snapshot (2026-11-06): root full audit reports four moderate findings in
the existing Drizzle Kit/esbuild development chain. Root production-only and
both Worker audits report zero. Track remaining exposure and deferrals in #534.
