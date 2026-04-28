import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Jodit } from "jodit";
import { useAuth } from "@/lib/auth/AuthContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  hasOfflineNoteMediaDraftUrlsInHtml,
  persistOfflineNoteMediaDraftUrlsInHtml,
  resolveOfflineNoteMediaDraftUrlsInHtml,
  uploadNoteMediaFile,
} from "@/lib/media/offline-note-media";
import "jodit/es2021/jodit.min.css";
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
import {
  attachMediaAuthToken,
  attachMediaAuthTokenToUrl,
  buildMediaUploadUrl,
  stripMediaAuthToken,
} from "./media-auth";

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

const EMBEDDED_MEDIA_SELECTOR = 'img[src^="data:image/"]';

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
  const auth = useAuth();
  let editorWrapperRef: HTMLDivElement | undefined;
  let toolbarRef: HTMLDivElement | undefined;
  let editorRef: HTMLTextAreaElement | undefined;
  let joditInstance: Jodit | undefined;
  let lastContent = props.content || "";
  let embeddedMediaReplacementVersion = 0;
  let resolvedDraftDisplayCleanup: (() => void) | undefined;
  let resolvedDraftDisplayVersion = 0;
  let lastResolvedContentInput: string | undefined;
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

  const displayUrlByDraftUrl = new Map<string, string>();
  const draftUrlByDisplayUrl = new Map<string, string>();

  const resetDraftDisplayMappings = (
    nextDisplayUrlByDraftUrl: ReadonlyMap<string, string>
  ) => {
    displayUrlByDraftUrl.clear();
    draftUrlByDisplayUrl.clear();

    for (const [draftUrl, displayUrl] of nextDisplayUrlByDraftUrl.entries()) {
      displayUrlByDraftUrl.set(draftUrl, displayUrl);
      draftUrlByDisplayUrl.set(displayUrl, draftUrl);
    }
  };

  const getPersistedEditorContent = (content: string) =>
    stripMediaAuthToken(
      persistOfflineNoteMediaDraftUrlsInHtml(content, draftUrlByDisplayUrl)
    );

  const applyResolvedEditorContent = async (incomingContent: string) => {
    const editor = joditInstance;
    if (!editor) {
      return;
    }

    lastResolvedContentInput = incomingContent;

    if (!hasOfflineNoteMediaDraftUrlsInHtml(incomingContent)) {
      resolvedDraftDisplayCleanup?.();
      resolvedDraftDisplayCleanup = undefined;
      resetDraftDisplayMappings(new Map());

      const displayContent = attachMediaAuthToken(
        incomingContent,
        auth.session?.()?.access_token
      );

      lastContent = stripMediaAuthToken(incomingContent);
      if (displayContent !== editor.value) {
        editor.value = displayContent;
      }
      return;
    }

    const resolutionVersion = ++resolvedDraftDisplayVersion;
    const resolvedContent = await resolveOfflineNoteMediaDraftUrlsInHtml(
      incomingContent,
      {
        reuseDisplayUrlByDraftUrl: displayUrlByDraftUrl,
      }
    );

    if (
      resolutionVersion !== resolvedDraftDisplayVersion ||
      editor !== joditInstance
    ) {
      resolvedContent.revoke();
      return;
    }

    resolvedDraftDisplayCleanup?.();
    resolvedDraftDisplayCleanup = resolvedContent.revoke;
    resetDraftDisplayMappings(resolvedContent.displayUrlByDraftUrl);

    const displayContent = attachMediaAuthToken(
      resolvedContent.html,
      auth.session?.()?.access_token
    );

    lastContent = stripMediaAuthToken(incomingContent);
    if (displayContent !== editor.value) {
      editor.value = displayContent;
    }
  };

  const uploadMediaFormData = async (
    requestData: FormData,
    showProgress: (progress: number) => void
  ) => {
    const file = Array.from(requestData.values()).find(
      (value): value is File => value instanceof File
    );
    if (!file) {
      throw new Error(
        "Unexpected media upload payload: expected a FormData containing one File."
      );
    }

    const db = auth.localDb?.() ?? getDb();
    const userId = auth.user?.()?.id;
    if (!db || !userId) {
      throw new Error("You must be signed in to upload note media.");
    }

    const upload = await uploadNoteMediaFile({
      db,
      file,
      userId,
      accessToken: auth.session?.()?.access_token,
      showProgress,
    });

    const persistedFiles = upload.data.persistedFiles ?? upload.data.files;
    for (const [index, fileUrl] of upload.data.files.entries()) {
      const persistedUrl = persistedFiles[index];
      if (!fileUrl || !persistedUrl || fileUrl === persistedUrl) {
        continue;
      }

      displayUrlByDraftUrl.set(persistedUrl, fileUrl);
      draftUrlByDisplayUrl.set(fileUrl, persistedUrl);
    }

    const accessToken = auth.session?.()?.access_token;

    return {
      ...upload,
      data: {
        ...upload.data,
        files: upload.data.files.map((url) =>
          url.startsWith("blob:")
            ? url
            : accessToken
              ? attachMediaAuthTokenToUrl(url, accessToken)
              : url
        ),
      },
    };
  };

  const dataUrlToFile = (dataUrl: string, index: number) => {
    const matches = dataUrl.match(/^data:(image\/[^;,]+)(;base64)?,(.*)$/);
    if (!matches) {
      return null;
    }

    const [, mimeType, encodingFlag, payload] = matches;
    if (!mimeType || !payload) {
      return null;
    }

    const extension = mimeType.split("/")[1] || "png";
    const binaryPayload = encodingFlag
      ? atob(payload)
      : decodeURIComponent(payload);
    const bytes = Uint8Array.from(binaryPayload, (character) =>
      character.charCodeAt(0)
    );

    return new File([bytes], `pasted-image-${index + 1}.${extension}`, {
      type: mimeType,
    });
  };

  const replaceEmbeddedMediaSources = async (content: string) => {
    const template = document.createElement("template");
    template.innerHTML = content;

    const images = Array.from(
      template.content.querySelectorAll<HTMLImageElement>(
        EMBEDDED_MEDIA_SELECTOR
      )
    );

    if (images.length === 0) {
      return null;
    }

    const replacements = new Map<string, string>();

    for (const [index, image] of images.entries()) {
      const source = image.getAttribute("src");
      if (!source || replacements.has(source)) {
        continue;
      }

      const file = dataUrlToFile(source, index);
      if (!file) {
        continue;
      }

      const formData = new FormData();
      formData.append("files[0]", file, file.name);
      const uploadResponse = await uploadMediaFormData(
        formData,
        () => undefined
      );
      const uploadedUrl = uploadResponse.data?.files?.[0];
      if (uploadedUrl) {
        replacements.set(source, uploadedUrl);
      }
    }

    if (replacements.size === 0) {
      return null;
    }

    for (const image of images) {
      const source = image.getAttribute("src");
      if (!source) {
        continue;
      }

      const uploadedUrl = replacements.get(source);
      if (uploadedUrl) {
        image.setAttribute("src", uploadedUrl);
      }
    }

    return template.innerHTML;
  };

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

    uploader: {
      url: buildMediaUploadUrl(),
      insertImageAsBase64URI: false,
      customUploadFunction: async (
        requestData: unknown,
        showProgress: (progress: number) => void
      ) => {
        if (!(requestData instanceof FormData)) {
          throw new Error("Unexpected media upload payload.");
        }

        return uploadMediaFormData(requestData, showProgress);
      },
    },

    // Events
    events: {
      change: (newContent: string) => {
        const sanitizedContent = stripMediaAuthToken(newContent);
        if (sanitizedContent === lastContent) return;

        if (sanitizedContent.includes("data:image/")) {
          const replacementVersion = ++embeddedMediaReplacementVersion;
          void replaceEmbeddedMediaSources(newContent)
            .then((updatedContent) => {
              if (
                !updatedContent ||
                replacementVersion !== embeddedMediaReplacementVersion ||
                !joditInstance
              ) {
                return;
              }

              lastContent = getPersistedEditorContent(updatedContent);
              joditInstance.value = updatedContent;
              props.onContentChange(lastContent);
            })
            .catch((error) => {
              console.error("Failed to replace embedded note media:", error);
              lastContent = getPersistedEditorContent(newContent);
              props.onContentChange(lastContent);
            });
          return;
        }

        lastContent = getPersistedEditorContent(newContent);
        props.onContentChange(lastContent);
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
      lastContent = stripMediaAuthToken(props.content || "");
      joditInstance.value = "";
      void applyResolvedEditorContent(props.content || "");
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
    if (!editor || incomingContent === lastResolvedContentInput) {
      return;
    }

    void applyResolvedEditorContent(incomingContent);
  });

  createEffect(() => {
    if (overflowActions().length === 0 && showOverflowMenu()) {
      setShowOverflowMenu(false);
    }
  });

  onCleanup(() => {
    resolvedDraftDisplayCleanup?.();
    resolvedDraftDisplayCleanup = undefined;

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
