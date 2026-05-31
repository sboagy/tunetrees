import { type Component, Show } from "solid-js";
import type { SwingDescriptor } from "@/lib/rhythm/pattern-types";

export type SwingDescriptorDraft = {
  timeSignature: string;
  macroBeatDivision: string;
  defaultSwingFactor: string;
  balanceRemainingNotes: boolean;
  velocityPattern: string;
  humanizationDeltaMs: string;
};

export interface SwingDescriptorEditorProps {
  draft: SwingDescriptorDraft;
  useInheritedDefault: boolean;
  onDraftChange: (nextDraft: SwingDescriptorDraft) => void;
  onUseInheritedDefaultChange: (nextValue: boolean) => void;
}

function inferMacroBeatDivision(rhythmSignature?: string | null): number {
  const match = rhythmSignature?.trim().match(/^(\d+)\/(\d+)$/);
  const numerator = Number.parseInt(match?.[1] ?? "", 10);
  const denominator = Number.parseInt(match?.[2] ?? "", 10);

  return denominator === 8 && numerator % 3 === 0 ? 3 : 2;
}

function getDefaultSwingFactor(macroBeatDivision: number): number {
  return macroBeatDivision === 3 ? 1.15 : 1.33;
}

function getDefaultVelocityPattern(macroBeatDivision: number): string {
  return macroBeatDivision === 3 ? "100, 80, 60" : "110, 75";
}

function getDefaultHumanizationDeltaMs(macroBeatDivision: number): number {
  return macroBeatDivision === 3 ? 15 : 10;
}

function normalizeSwingDescriptorCandidate(
  candidate: Record<string, unknown> | null | undefined
): SwingDescriptor | null {
  if (!candidate) {
    return null;
  }

  const timeSignature =
    typeof candidate.timeSignature === "string"
      ? candidate.timeSignature.trim()
      : "";
  const macroBeatDivision =
    typeof candidate.macroBeatDivision === "number"
      ? candidate.macroBeatDivision
      : Number.NaN;
  const defaultSwingFactor =
    typeof candidate.defaultSwingFactor === "number"
      ? candidate.defaultSwingFactor
      : Number.NaN;
  const balanceRemainingNotes = candidate.balanceRemainingNotes;
  const velocityPattern = Array.isArray(candidate.velocityPattern)
    ? candidate.velocityPattern.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isFinite(entry)
      )
    : [];
  const humanizationDeltaMs =
    typeof candidate.humanizationDeltaMs === "number"
      ? candidate.humanizationDeltaMs
      : Number.NaN;

  if (
    !timeSignature ||
    !Number.isFinite(macroBeatDivision) ||
    !Number.isInteger(macroBeatDivision) ||
    macroBeatDivision <= 1 ||
    !Number.isFinite(defaultSwingFactor) ||
    defaultSwingFactor <= 0 ||
    typeof balanceRemainingNotes !== "boolean" ||
    velocityPattern.length === 0 ||
    !Number.isFinite(humanizationDeltaMs) ||
    humanizationDeltaMs < 0
  ) {
    return null;
  }

  return {
    timeSignature,
    macroBeatDivision,
    defaultSwingFactor,
    balanceRemainingNotes,
    velocityPattern,
    humanizationDeltaMs,
  };
}

export function parseStoredSwingDescriptor(
  value?: string | null
): SwingDescriptor | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return null;
  }

  try {
    return normalizeSwingDescriptorCandidate(
      JSON.parse(trimmedValue) as Record<string, unknown>
    );
  } catch {
    return null;
  }
}

export function createSwingDescriptorDraft(
  descriptor?: SwingDescriptor | null,
  rhythmSignature?: string | null
): SwingDescriptorDraft {
  const macroBeatDivision =
    descriptor?.macroBeatDivision ?? inferMacroBeatDivision(rhythmSignature);

  return {
    timeSignature:
      descriptor?.timeSignature ?? rhythmSignature?.trim() ?? "4/4",
    macroBeatDivision: String(macroBeatDivision),
    defaultSwingFactor: String(
      descriptor?.defaultSwingFactor ?? getDefaultSwingFactor(macroBeatDivision)
    ),
    balanceRemainingNotes:
      descriptor?.balanceRemainingNotes ?? macroBeatDivision === 3,
    velocityPattern:
      descriptor?.velocityPattern.join(", ") ??
      getDefaultVelocityPattern(macroBeatDivision),
    humanizationDeltaMs: String(
      descriptor?.humanizationDeltaMs ??
        getDefaultHumanizationDeltaMs(macroBeatDivision)
    ),
  };
}

export function parseSwingDescriptorDraft(draft: SwingDescriptorDraft): {
  descriptor: SwingDescriptor | null;
  error: string | null;
} {
  const timeSignature = draft.timeSignature.trim();
  if (!/^\d+\/\d+$/.test(timeSignature)) {
    return {
      descriptor: null,
      error: "Swing shape time signature must look like 6/8 or 4/4.",
    };
  }

  const macroBeatDivision = Number.parseInt(draft.macroBeatDivision.trim(), 10);
  if (!Number.isInteger(macroBeatDivision) || macroBeatDivision <= 1) {
    return {
      descriptor: null,
      error: "Macro beat division must be an integer greater than 1.",
    };
  }

  const defaultSwingFactor = Number.parseFloat(draft.defaultSwingFactor.trim());
  if (!Number.isFinite(defaultSwingFactor) || defaultSwingFactor <= 0) {
    return {
      descriptor: null,
      error: "Default swing factor must be a positive number.",
    };
  }

  const velocityPattern = draft.velocityPattern
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => Number.parseFloat(entry));
  if (
    velocityPattern.length < macroBeatDivision ||
    velocityPattern.some((entry) => !Number.isFinite(entry))
  ) {
    return {
      descriptor: null,
      error:
        "Velocity pattern must include at least one numeric value for each macro beat slot.",
    };
  }

  const humanizationDeltaMs = Number.parseFloat(
    draft.humanizationDeltaMs.trim()
  );
  if (!Number.isFinite(humanizationDeltaMs) || humanizationDeltaMs < 0) {
    return {
      descriptor: null,
      error: "Humanization delta must be zero or a positive number.",
    };
  }

  return {
    descriptor: {
      timeSignature,
      macroBeatDivision,
      defaultSwingFactor,
      balanceRemainingNotes: draft.balanceRemainingNotes,
      velocityPattern,
      humanizationDeltaMs,
    },
    error: null,
  };
}

export const SwingDescriptorEditor: Component<SwingDescriptorEditorProps> = (
  props
) => {
  const updateDraft = <K extends keyof SwingDescriptorDraft>(
    key: K,
    value: SwingDescriptorDraft[K]
  ) => {
    props.onDraftChange({
      ...props.draft,
      [key]: value,
    });
  };

  return (
    <section class="rounded-2xl border border-border bg-card p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-foreground">Swing shape</p>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            Leave this on to inherit the matching default pattern&apos;s
            `swing_desc`. Turn it off to override the rhythm shape for this
            custom pattern.
          </p>
        </div>

        <label class="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={props.useInheritedDefault}
            onChange={(event) =>
              props.onUseInheritedDefaultChange(event.currentTarget.checked)
            }
            class="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            data-testid="rhythm-player-custom-pattern-swing-desc-inherit-checkbox"
          />
          <span>Inherit default</span>
        </label>
      </div>

      <Show
        when={!props.useInheritedDefault}
        fallback={
          <div
            class="mt-4 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground"
            data-testid="rhythm-player-custom-pattern-swing-desc-inherit-summary"
          >
            The matching default pattern row will provide the swing descriptor
            unless you override it here.
          </div>
        }
      >
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">Time signature</span>
            <input
              type="text"
              value={props.draft.timeSignature}
              onInput={(event) =>
                updateDraft("timeSignature", event.currentTarget.value)
              }
              class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-time-signature-input"
            />
          </label>

          <label class="flex flex-col gap-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">Macro beat division</span>
            <input
              type="number"
              min="2"
              step="1"
              value={props.draft.macroBeatDivision}
              onInput={(event) =>
                updateDraft("macroBeatDivision", event.currentTarget.value)
              }
              class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-macro-division-input"
            />
          </label>

          <label class="flex flex-col gap-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">
              Default swing factor
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={props.draft.defaultSwingFactor}
              onInput={(event) =>
                updateDraft("defaultSwingFactor", event.currentTarget.value)
              }
              class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-default-factor-input"
            />
          </label>

          <label class="flex flex-col gap-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">Humanization (ms)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={props.draft.humanizationDeltaMs}
              onInput={(event) =>
                updateDraft("humanizationDeltaMs", event.currentTarget.value)
              }
              class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-humanization-input"
            />
          </label>

          <label class="sm:col-span-2 flex flex-col gap-2 text-sm text-muted-foreground">
            <span class="font-medium text-foreground">Velocity pattern</span>
            <input
              type="text"
              value={props.draft.velocityPattern}
              onInput={(event) =>
                updateDraft("velocityPattern", event.currentTarget.value)
              }
              class="min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-velocity-pattern-input"
            />
            <span class="text-xs text-muted-foreground/80">
              Enter comma-separated values such as 100, 80, 60.
            </span>
          </label>

          <label class="sm:col-span-2 flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={props.draft.balanceRemainingNotes}
              onChange={(event) =>
                updateDraft(
                  "balanceRemainingNotes",
                  event.currentTarget.checked
                )
              }
              class="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              data-testid="rhythm-player-custom-pattern-swing-desc-balance-checkbox"
            />
            <span>Balance remaining notes after the first swung slot</span>
          </label>
        </div>
      </Show>
    </section>
  );
};

export default SwingDescriptorEditor;
