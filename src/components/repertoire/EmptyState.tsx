import { type Component, Show } from "solid-js";

interface IEmptyStateAction {
  label: string;
  onClick: () => void;
}

interface RepertoireEmptyStateProps {
  title: string;
  description: string;
  primaryAction?: IEmptyStateAction;
  secondaryAction?: IEmptyStateAction;
}

export const RepertoireEmptyState: Component<RepertoireEmptyStateProps> = (
  props
) => (
  <div class="flex-1 flex items-center justify-center py-10">
    <div class="max-w-xl text-center bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-6 shadow-sm">
      <div class="text-4xl mb-3" aria-hidden="true">
        🎵
      </div>
      <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
        {props.title}
      </h3>
      <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
        {props.description}
      </p>

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
    </div>
  </div>
);
