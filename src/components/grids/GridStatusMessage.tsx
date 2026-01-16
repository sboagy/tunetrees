import { type Component, Show, createMemo } from "solid-js";

export type GridStatusVariant = "loading" | "empty" | "success" | "error";

interface GridStatusMessageProps {
  variant: GridStatusVariant;
  title: string;
  description?: string;
  hint?: string;
  error?: unknown;
}

const getErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const GridStatusMessage: Component<GridStatusMessageProps> = (props) => {
  const errorMessage = createMemo(() => getErrorMessage(props.error));
  const icon = () => {
    if (props.variant === "success") return "🎉";
    if (props.variant === "error") return "⚠️";
    return "📭";
  };

  return (
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center py-12">
        <Show
          when={props.variant === "loading"}
          fallback={
            <div class="text-6xl mb-4" aria-hidden="true">
              {icon()}
            </div>
          }
        >
          <div class="animate-spin h-12 w-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full" />
        </Show>
        <h3
          classList={{
            "text-xl font-semibold mb-2": true,
            "text-green-900 dark:text-green-300": props.variant === "success",
            "text-red-700 dark:text-red-300": props.variant === "error",
            "text-gray-700 dark:text-gray-300":
              props.variant === "loading" || props.variant === "empty",
          }}
        >
          {props.title}
        </h3>
        <Show when={props.description}>
          <p
            classList={{
              "text-gray-500 dark:text-gray-500": props.variant === "empty",
              "text-gray-600 dark:text-gray-400": props.variant === "loading",
              "text-green-700 dark:text-green-400": props.variant === "success",
              "text-red-600 dark:text-red-400": props.variant === "error",
            }}
          >
            {props.description}
          </p>
        </Show>
        <Show when={props.hint}>
          <p class="text-sm text-gray-500 dark:text-gray-500 mt-2">
            {props.hint}
          </p>
        </Show>
        <Show when={props.variant === "error" && errorMessage()}>
          <p class="text-xs text-red-600 dark:text-red-400 mt-2">
            Error details: {errorMessage()}
          </p>
        </Show>
      </div>
    </div>
  );
};
