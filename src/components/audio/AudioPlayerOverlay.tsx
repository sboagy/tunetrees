import { X } from "lucide-solid";
import {
  type Component,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { useAudioPlayer } from "./AudioPlayerContext";

const WaveformAudioPlayer = lazy(() => import("./WaveformAudioPlayer"));

export const AudioPlayerOverlay: Component = () => {
  const { currentTrack, closeTrack } = useAudioPlayer();
  let persistBeforeClose: (() => Promise<void>) | null = null;
  let isClosing = false;

  const handleClose = async () => {
    if (isClosing) {
      return;
    }

    isClosing = true;

    try {
      await persistBeforeClose?.();
      closeTrack();
    } catch {
      return;
    } finally {
      isClosing = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && currentTrack()) {
      void handleClose();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <Show keyed when={currentTrack()}>
      {(track) => (
        <div
          class="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-[2px] md:items-start md:p-6"
          data-testid="audio-player-overlay"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close audio player overlay"
            onClick={() => {
              void handleClose();
            }}
            class="absolute inset-0 h-full w-full bg-transparent"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Audio player"
            class="relative z-10 flex h-[min(44rem,calc(100dvh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div class="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Audio Reference
                </p>
                <h3
                  class="truncate text-lg font-semibold text-slate-900 dark:text-slate-50"
                  data-testid="audio-player-title"
                >
                  {track.referenceTitle}
                </h3>
                <Show
                  when={
                    track.originalFilename &&
                    track.originalFilename !== track.referenceTitle
                  }
                >
                  <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                    {track.originalFilename}
                  </p>
                </Show>
              </div>

              <button
                type="button"
                onClick={() => {
                  void handleClose();
                }}
                class="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                data-testid="audio-player-close-button"
              >
                Close
                <X class="h-4 w-4" />
              </button>
            </div>

            <div class="min-h-0 flex-1 overflow-hidden p-4">
              <Suspense
                fallback={
                  <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                    Loading waveform...
                  </div>
                }
              >
                <WaveformAudioPlayer
                  track={track}
                  onPersistRequestChange={(handler) => {
                    persistBeforeClose = handler;
                  }}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default AudioPlayerOverlay;
