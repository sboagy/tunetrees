import { A } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import type { GoalPracticeRecoveryError } from "../../lib/goals/commit";
import { Button } from "../ui/button";

/** Explicit recovery preserves text and never retries submission automatically. */
export function PracticeSubmitRecovery(props: {
  recovery: GoalPracticeRecoveryError;
  pending: boolean;
  onClearNotes: () => Promise<void>;
}) {
  const [savedElsewhere, setSavedElsewhere] = createSignal(false);
  const [copyStatus, setCopyStatus] = createSignal("");
  const copyNotes = async () => {
    try {
      await navigator.clipboard.writeText(
        `Private draft note:\n${props.recovery.draft.notePrivate ?? ""}\n\nPublic draft note:\n${props.recovery.draft.notePublic ?? ""}`
      );
      setCopyStatus(
        "Copied. Save the text somewhere safe before clearing these draft notes."
      );
    } catch {
      setCopyStatus("Could not copy. Select and copy the text below manually.");
    }
  };
  return (
    <div
      class="space-y-3 text-foreground"
      data-testid="practice-submit-recovery"
    >
      <Show
        when={props.recovery.kind === "conflict"}
        fallback={
          <>
            <p>
              These saved draft notes cannot be submitted with the evaluation.
              Copy or save them elsewhere before explicitly clearing them here.
            </p>
            <label class="block">
              <span>Private draft note</span>
              <textarea
                readOnly
                class="block w-full rounded-md border border-input bg-background p-2"
                value={props.recovery.draft.notePrivate ?? ""}
                data-testid="recovery-private-note"
              />
            </label>
            <label class="block">
              <span>Public draft note</span>
              <textarea
                readOnly
                class="block w-full rounded-md border border-input bg-background p-2"
                value={props.recovery.draft.notePublic ?? ""}
                data-testid="recovery-public-note"
              />
            </label>
            <Button
              variant="outline"
              onClick={copyNotes}
              data-testid="recovery-copy-notes"
            >
              Copy notes
            </Button>
            <output class="block">{copyStatus()}</output>
            <label class="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={savedElsewhere()}
                onChange={(event) =>
                  setSavedElsewhere(event.currentTarget.checked)
                }
                data-testid="recovery-notes-saved"
              />
              <span>
                I saved these notes elsewhere and want to clear these draft
                copies.
              </span>
            </label>
            <Button
              variant="outline"
              disabled={!savedElsewhere() || props.pending}
              onClick={props.onClearNotes}
              data-testid="recovery-clear-notes"
            >
              Clear these draft notes
            </Button>
          </>
        }
      >
        <p>
          This evaluation conflicts with recorded practice. Your draft is
          preserved. Inspect this tune’s Practice History first. If this is a
          new practice, return to the queue, choose (Not Set), then select its
          evaluation again. Do not resubmit an already recorded practice.
        </p>
      </Show>
      <A
        class="inline-block underline min-h-11 py-2"
        href={`/tunes/${props.recovery.draft.tuneId}/practice-history`}
        data-testid="recovery-practice-history"
      >
        Open this tune’s Practice History
      </A>
    </div>
  );
}
