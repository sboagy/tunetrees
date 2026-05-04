import { type Component, For, Show } from "solid-js";
import { Button } from "@/components/ui/button";
import type { StarterRepertoireTemplate } from "../../lib/db/starter-repertoire-templates";

interface IEmptyStateAction {
  label: string;
  onClick: () => void;
}

interface RepertoireEmptyStateProps {
  title: string;
  description: string;
  primaryAction?: IEmptyStateAction;
  secondaryAction?: IEmptyStateAction;
  /**
   * When provided, replaces the simple action buttons with an inline
   * starter-repertoire picker. The user can choose a template or create
   * a custom repertoire from scratch.
   */
  starterTemplates?: StarterRepertoireTemplate[];
  /** Called when the user clicks a starter template card */
  onStarterChosen?: (templateId: string) => void;
  /** Called when the user clicks "Create Custom" */
  onCreateCustom?: () => void;
  /** Whether a starter is currently being created (disables cards) */
  isCreatingStarter?: boolean;
  /** User-visible error from starter creation, if any */
  starterError?: string | null;
}

export const RepertoireEmptyState: Component<RepertoireEmptyStateProps> = (
  props
) => (
  <div class="flex-1 flex items-center justify-center py-10">
    <div class="max-w-xl w-full rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center shadow-sm">
      <div class="text-4xl mb-3" aria-hidden="true">
        🎵
      </div>
      <h3 class="text-xl font-semibold text-foreground">{props.title}</h3>
      <p class="mt-2 text-sm text-muted-foreground">{props.description}</p>

      {/* Inline starter-repertoire picker (shown when starterTemplates prop is present) */}
      <Show when={props.starterTemplates && props.starterTemplates.length > 0}>
        <div class="mt-6 space-y-4 text-left">
          <h4 class="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Starter Repertoires
          </h4>

          <div class="space-y-3">
            <For each={props.starterTemplates}>
              {(template) => (
                <button
                  type="button"
                  onClick={() => props.onStarterChosen?.(template.id)}
                  disabled={props.isCreatingStarter}
                  data-testid={`onboarding-starter-${template.id}`}
                  class="w-full rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div class="flex items-start gap-3">
                    <span
                      class="text-2xl leading-none mt-0.5"
                      aria-hidden="true"
                    >
                      {template.emoji}
                    </span>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-semibold text-foreground">
                          {template.name}
                        </span>
                        <span class="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          ~{template.estimatedTuneCount} tunes
                        </span>
                      </div>
                      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </For>
          </div>

          {/* Divider */}
          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
            <span class="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide whitespace-nowrap">
              or
            </span>
            <div class="flex-1 h-px bg-gray-200 dark:bg-gray-600" />
          </div>

          {/* Create Custom */}
          <Button
            type="button"
            onClick={() => props.onCreateCustom?.()}
            disabled={props.isCreatingStarter}
            variant="outline"
            class="w-full text-sm"
            data-testid="onboarding-create-repertoire"
          >
            Create Custom Repertoire
          </Button>

          {/* Starter creation error */}
          <Show when={props.starterError}>
            <p
              class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2"
              role="alert"
            >
              {props.starterError}
            </p>
          </Show>
        </div>
      </Show>

      {/* Simple action buttons (shown when starterTemplates prop is absent) */}
      <Show
        when={!props.starterTemplates || props.starterTemplates.length === 0}
      >
        <Show when={props.primaryAction || props.secondaryAction}>
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Show when={props.primaryAction}>
              <Button
                type="button"
                variant="outline"
                onClick={() => props.primaryAction?.onClick()}
              >
                {props.primaryAction?.label}
              </Button>
            </Show>

            <Show when={props.secondaryAction}>
              <Button
                type="button"
                variant="outline"
                onClick={() => props.secondaryAction?.onClick()}
              >
                {props.secondaryAction?.label}
              </Button>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  </div>
);
