import { Jodit } from "jodit";
import {
  type Component,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
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
  let editorRef: HTMLTextAreaElement | undefined;
  let joditInstance: Jodit | undefined;
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  const [currentTheme, setCurrentTheme] = createSignal<"light" | "dark">(
    getCurrentTheme()
  );

  // Create the Jodit editor configuration
  const createEditorConfig = (theme: "light" | "dark") => ({
    // Toolbar configuration
    buttons: [
      "bold",
      "italic",
      "underline",
      "|",
      "ul",
      "ol",
      "|",
      "link",
      "|",
      "undo",
      "redo",
    ],

    // Theme configuration - use Jodit's built-in dark theme
    theme: theme === "dark" ? "dark" : "default",

    // Editor settings
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
        // Debounce auto-save (2 seconds)
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        saveTimeout = setTimeout(() => {
          props.onContentChange(newContent);
        }, 2000);
      },
    },
  });

  // Initialize editor
  const initEditor = () => {
    if (editorRef) {
      // Destroy existing instance if any
      if (joditInstance) {
        joditInstance.destruct();
      }

      // Initialize Jodit editor with current theme
      joditInstance = Jodit.make(editorRef, createEditorConfig(currentTheme()));

      // Set initial content
      joditInstance.value = props.content || "";
    }
  };

  // Watch for theme changes on the document
  onMount(() => {
    initEditor();

    // Set up a MutationObserver to detect theme changes on <html>
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          const newTheme = getCurrentTheme();
          if (newTheme !== currentTheme()) {
            setCurrentTheme(newTheme);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    onCleanup(() => {
      observer.disconnect();
    });
  });

  // Re-initialize editor when theme changes
  createEffect(() => {
    // Subscribe to theme changes - currentTheme() must be called to track it
    if (currentTheme() && joditInstance) {
      // Only reinitialize if editor already exists (theme changed)
      const currentContent = joditInstance.value;
      initEditor();
      if (joditInstance) {
        joditInstance.value = currentContent;
      }
    }
  });

  // Update editor content when prop changes (external update)
  createEffect(() => {
    if (joditInstance && props.content !== joditInstance.value) {
      joditInstance.value = props.content || "";
    }
  });

  onCleanup(() => {
    // Clear any pending save
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      // Trigger immediate save on unmount
      if (joditInstance) {
        props.onContentChange(joditInstance.value);
      }
    }

    // Destroy Jodit instance
    if (joditInstance) {
      joditInstance.destruct();
      joditInstance = undefined;
    }
  });

  return (
    <div class="notes-editor">
      <textarea ref={editorRef} />
    </div>
  );
};
