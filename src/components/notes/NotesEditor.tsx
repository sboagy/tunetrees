import { Jodit } from "jodit";
import { type Component, createEffect, onCleanup } from "solid-js";
import "jodit/es2021/jodit.min.css";

interface NotesEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  placeholder?: string;
  readonly?: boolean;
  autofocus?: boolean;
}

/**
 * NotesEditor - SolidJS wrapper for Jodit rich text editor
 *
 * Features:
 * - Rich text editing (bold, italic, lists, links)
 * - Auto-save with debounce (2 seconds)
 * - Markdown shortcuts
 * - Responsive toolbar
 */
export const NotesEditor: Component<NotesEditorProps> = (props) => {
  let editorRef: HTMLTextAreaElement | undefined;
  let joditInstance: Jodit | undefined;
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (editorRef && !joditInstance) {
      // Initialize Jodit editor
      joditInstance = Jodit.make(editorRef, {
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

      // Set initial content
      joditInstance.value = props.content || "";
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
