import { type Component, For, Show } from "solid-js";
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
    <div class="max-w-xl w-full text-center bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 shadow-sm">
      <div class="text-4xl mb-3" aria-hidden="true">
        🎵
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
        {props.title}
      </h3>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {props.description}
      </p>

      {/* Inline starter-repertoire picker (shown when starterTemplates prop is present) */}
      <Show when={props.starterTemplates && props.starterTemplates.length > 0}>
        <div class="mt-6 space-y-4 text-left">
          <h4 class="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide text-center">
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
                  class="w-full text-left border border-blue-200 dark:border-blue-700 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <span class="font-semibold text-gray-900 dark:text-white text-sm">
                          {template.name}
                        </span>
                        <span class="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full whitespace-nowrap">
                          ~{template.estimatedTuneCount} tunes
                        </span>
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
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
          <button
            type="button"
            onClick={() => props.onCreateCustom?.()}
            disabled={props.isCreatingStarter}
            class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            data-testid="onboarding-create-repertoire"
          >
            Create Custom Repertoire
          </button>

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
              <button
                type="button"
                class="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => props.primaryAction?.onClick()}
              >
                {props.primaryAction?.label}
              </button>
            </Show>

            <Show when={props.secondaryAction}>
              <button
                type="button"
                class="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => props.secondaryAction?.onClick()}
              >
                {props.secondaryAction?.label}
              </button>
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  </div>
);
