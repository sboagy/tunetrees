import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Jodit } from "jodit";
import {
  Bold,
  EllipsisVertical,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from "lucide-solid";
import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import "jodit/es2021/jodit.min.css";

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  readonly?: boolean;
  autofocus?: boolean;
}

/**
 * Get the current theme from the document
 */
const getCurrentTheme = (): "light" | "dark" => {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

const getJoditTheme = (theme: "light" | "dark"): "default" | "dark" => {
  return theme === "dark" ? "dark" : "default";
};

const NOTES_EDITOR_MENU_THEME = {
  light: {
    surface: "#ffffff",
    border: "#cbd5e1",
    text: "#0f172a",
    hover: "rgba(37, 99, 235, 0.12)",
    shadow: "rgba(15, 23, 42, 0.14)",
  },
  dark: {
    surface: "#0f172a",
    border: "#334155",
    text: "#e2e8f0",
    hover: "rgba(96, 165, 250, 0.18)",
    shadow: "rgba(2, 6, 23, 0.45)",
  },
} as const;

const TOOLBAR_BUTTON_WIDTH = 36;
const TOOLBAR_ACTION_GAP = 6;
const TOOLBAR_SECTION_GAP = 8;
const TOOLBAR_HORIZONTAL_PADDING = 16;

type ToolbarActionId =
  | "bold"
  | "italic"
  | "underline"
  | "ul"
  | "ol"
  | "link"
  | "undo"
  | "redo";

type ToolbarAction = {
  id: ToolbarActionId;
  label: string;
  icon: Component<{ class?: string }>;
};

const TOOLBAR_ACTIONS: readonly ToolbarAction[] = [
  { id: "bold", label: "Bold", icon: Bold },
  { id: "italic", label: "Italic", icon: Italic },
  { id: "underline", label: "Underline", icon: Underline },
  { id: "ul", label: "Bulleted List", icon: List },
  { id: "ol", label: "Numbered List", icon: ListOrdered },
  { id: "link", label: "Insert Link", icon: Link2 },
  { id: "undo", label: "Undo", icon: Undo2 },
  { id: "redo", label: "Redo", icon: Redo2 },
] as const;

const getToolbarGroupWidth = (buttonCount: number) => {
  if (buttonCount <= 0) {
    return 0;
  }

  return (
    buttonCount * TOOLBAR_BUTTON_WIDTH +
    Math.max(buttonCount - 1, 0) * TOOLBAR_ACTION_GAP
  );
};

const resolveToolbarLayout = (toolbarWidth: number | null) => {
  if (!toolbarWidth || toolbarWidth <= 0) {
    return {
      inline: TOOLBAR_ACTIONS,
      overflow: [] as readonly ToolbarAction[],
    };
  }

  const contentWidth = Math.max(toolbarWidth - TOOLBAR_HORIZONTAL_PADDING, 0);
  const allActionsWidth = getToolbarGroupWidth(TOOLBAR_ACTIONS.length);

  if (allActionsWidth <= contentWidth) {
    return {
      inline: TOOLBAR_ACTIONS,
      overflow: [] as readonly ToolbarAction[],
    };
  }

  const availableInlineWidth = Math.max(
    contentWidth - TOOLBAR_BUTTON_WIDTH - TOOLBAR_SECTION_GAP,
    0
  );

  let inlineCount = TOOLBAR_ACTIONS.length;

  while (
    inlineCount > 0 &&
    getToolbarGroupWidth(inlineCount) > availableInlineWidth
  ) {
    inlineCount -= 1;
  }

  return {
    inline: TOOLBAR_ACTIONS.slice(0, inlineCount),
    overflow: TOOLBAR_ACTIONS.slice(inlineCount),
  };
};

/**
 * NotesEditor - SolidJS wrapper for Jodit rich text editor
 *
 * Features:
 * - Rich text editing (bold, italic, lists, links)
 * - Auto-save with debounce (2 seconds)
 * - Markdown shortcuts
 * - Responsive toolbar
 * - Theme-aware (light/dark mode support)
 */
export const NotesEditor: Component<NotesEditorProps> = (props) => {
  let editorWrapperRef: HTMLDivElement | undefined;
  let toolbarRef: HTMLDivElement | undefined;
  let editorRef: HTMLTextAreaElement | undefined;
  let joditInstance: Jodit | undefined;
  let lastContent = props.content || "";
  const [currentTheme, setCurrentTheme] = createSignal<"light" | "dark">(
    getCurrentTheme()
  );
  const [toolbarWidth, setToolbarWidth] = createSignal<number | null>(null);
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  // Track the previous theme to detect actual changes
  let previousTheme: "light" | "dark" = getCurrentTheme();

  const toolbarLayout = createMemo(() => resolveToolbarLayout(toolbarWidth()));
  const inlineActions = createMemo(() => toolbarLayout().inline);
  const overflowActions = createMemo(() => toolbarLayout().overflow);
  const overflowMenuStyle = createMemo<Record<string, string>>(() => {
    const palette = NOTES_EDITOR_MENU_THEME[currentTheme()];

    return {
      "--notes-editor-surface": palette.surface,
      "--notes-editor-border": palette.border,
      "--notes-editor-text": palette.text,
      "--notes-editor-hover": palette.hover,
      "--notes-editor-shadow": palette.shadow,
      "background-color": palette.surface,
      color: palette.text,
    };
  });

  // Create the Jodit editor configuration
  const createEditorConfig = (theme: "light" | "dark") => ({
    toolbar: false,

    // Theme configuration - use Jodit's built-in dark theme
    theme: getJoditTheme(theme),

    // Editor settings
    editorClassName: "notes-editor__content",
    width: "100%",
    placeholder: props.placeholder || "Write your notes here...",
    readonly: props.readonly || false,
    autofocus: props.autofocus || false,
    height: 200,
    minHeight: 100,

    // Enable markdown shortcuts
    useSearch: false,
    spellcheck: true,

    // Remove unnecessary features for smaller bundle
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,

    // Events
    events: {
      change: (newContent: string) => {
        if (newContent === lastContent) return;
        lastContent = newContent;
        props.onContentChange(newContent);
      },
    },
  });

  const saveSelection = () => {
    joditInstance?.s.save();
  };

  const updateToolbarWidth = () => {
    const nextWidth =
      toolbarRef?.clientWidth || editorWrapperRef?.clientWidth || 0;
    setToolbarWidth(nextWidth > 0 ? nextWidth : null);
  };

  const applyListStyle = (element: "ul" | "ol") => {
    if (!joditInstance) {
      return;
    }

    joditInstance.s.commitStyle({
      element,
      attributes: {
        style: {
          listStyleType: null,
        },
      },
    });
    joditInstance.synchronizeValues();
  };

  const executeToolbarAction = (actionId: ToolbarActionId) => {
    if (!joditInstance || props.readonly) {
      return;
    }

    joditInstance.s.restore();
    joditInstance.s.focus();

    switch (actionId) {
      case "bold":
        joditInstance.execCommand("bold");
        break;
      case "italic":
        joditInstance.execCommand("italic");
        break;
      case "underline":
        joditInstance.execCommand("underline");
        break;
      case "ul":
        applyListStyle("ul");
        break;
      case "ol":
        applyListStyle("ol");
        break;
      case "link":
        joditInstance.execCommand("openLinkDialog");
        break;
      case "undo":
        joditInstance.execCommand("undo");
        break;
      case "redo":
        joditInstance.execCommand("redo");
        break;
    }
  };

  const handleInlineButtonMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    saveSelection();
  };

  const handleOverflowTriggerMouseDown = () => {
    saveSelection();
  };

  const handleOverflowAction = (actionId: ToolbarActionId) => {
    setShowOverflowMenu(false);
    queueMicrotask(() => {
      executeToolbarAction(actionId);
    });
  };

  const applyEditorTheme = (theme: "light" | "dark") => {
    if (!joditInstance) {
      return;
    }

    const joditTheme = getJoditTheme(theme);
    joditInstance.options.theme = joditTheme;
    joditInstance.container.classList.remove(
      "jodit_theme_dark",
      "jodit_theme_default"
    );
    joditInstance.container.classList.add(`jodit_theme_${joditTheme}`);
  };

  // Initialize editor
  const initEditor = () => {
    if (editorRef) {
      // Destroy existing instance if any and clear reference
      if (joditInstance) {
        joditInstance.destruct();
        joditInstance = undefined;
      }

      // Initialize Jodit editor with current theme
      joditInstance = Jodit.make(editorRef, createEditorConfig(currentTheme()));

      // Set initial content
      lastContent = props.content || "";
      joditInstance.value = lastContent;
    }
  };

  // Watch for theme changes on the document
  onMount(() => {
    initEditor();
    updateToolbarWidth();

    // Set up a MutationObserver to detect theme changes on <html>
    // Using attributeFilter ensures we only get notified about class changes
    const observer = new MutationObserver(() => {
      const newTheme = getCurrentTheme();
      if (newTheme !== currentTheme()) {
        setCurrentTheme(newTheme);
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && editorWrapperRef
        ? new ResizeObserver(() => {
            updateToolbarWidth();
          })
        : undefined;

    if (resizeObserver && editorWrapperRef) {
      resizeObserver.observe(editorWrapperRef);
    }

    onCleanup(() => {
      observer.disconnect();
      resizeObserver?.disconnect();
    });
  });

  // Update the editor theme in place when the app theme changes
  createEffect(() => {
    const theme = currentTheme();
    // Only update if theme actually changed (not on initial mount)
    if (theme !== previousTheme && joditInstance) {
      previousTheme = theme;
      applyEditorTheme(theme);
    }
  });

  // Update editor content when prop changes (external update)
  createEffect(() => {
    const incomingContent = props.content || "";
    const editor = joditInstance;
    if (!editor) {
      return;
    }

    if (incomingContent !== editor.value) {
      lastContent = incomingContent;
      editor.value = incomingContent;
    }
  });

  createEffect(() => {
    if (overflowActions().length === 0 && showOverflowMenu()) {
      setShowOverflowMenu(false);
    }
  });

  onCleanup(() => {
    // Destroy Jodit instance
    if (joditInstance) {
      joditInstance.destruct();
      joditInstance = undefined;
    }
  });

  return (
    <div
      ref={editorWrapperRef}
      class="notes-editor notes-editor_has-custom-toolbar"
    >
      <Show when={!props.readonly}>
        <div
          ref={toolbarRef}
          class="notes-editor__toolbar"
          data-testid="notes-toolbar"
        >
          <div class="notes-editor__toolbar-actions">
            <For each={inlineActions()}>
              {(action) => (
                <button
                  type="button"
                  class="notes-editor__toolbar-button"
                  data-testid={`notes-toolbar-${action.id}-button`}
                  title={action.label}
                  aria-label={action.label}
                  onMouseDown={handleInlineButtonMouseDown}
                  onClick={() => executeToolbarAction(action.id)}
                >
                  <action.icon class="h-4 w-4" />
                  <span class="sr-only">{action.label}</span>
                </button>
              )}
            </For>
          </div>

          <Show when={overflowActions().length > 0}>
            <DropdownMenu
              open={showOverflowMenu()}
              onOpenChange={setShowOverflowMenu}
            >
              <DropdownMenu.Trigger
                type="button"
                class="notes-editor__toolbar-button notes-editor__toolbar-overflow-trigger"
                data-testid="notes-toolbar-overflow-button"
                aria-label="More formatting options"
                title="More formatting options"
                onMouseDown={handleOverflowTriggerMouseDown}
              >
                <EllipsisVertical class="h-4 w-4" />
                <span class="sr-only">More formatting options</span>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  class="notes-editor__toolbar-menu"
                  style={overflowMenuStyle()}
                >
                  <For each={overflowActions()}>
                    {(action) => (
                      <button
                        type="button"
                        class="notes-editor__toolbar-menu-item"
                        data-testid={`notes-toolbar-overflow-${action.id}-button`}
                        onClick={() => handleOverflowAction(action.id)}
                      >
                        <action.icon class="h-4 w-4" />
                        <span>{action.label}</span>
                      </button>
                    )}
                  </For>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </Show>
        </div>
      </Show>

      <textarea ref={editorRef} />
    </div>
  );
};
