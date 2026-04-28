import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@solidjs/testing-library";
import { createSignal, type Setter } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMediaUploadUrl,
  buildMediaViewUrl,
} from "../../../src/components/notes/media-auth";
import { NotesEditor } from "../../../src/components/notes/NotesEditor";
import * as offlineNoteMedia from "../../../src/lib/media/offline-note-media";

vi.mock("jodit/es2021/jodit.min.css", () => ({}));

const mockSession = {
  access_token: "test-access-token",
};

vi.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    session: () => mockSession,
    user: () => ({ id: "user-1" }),
    localDb: () => ({
      run: vi.fn(async () => undefined),
      all: vi.fn(async () => []),
    }),
  }),
}));

type MockEditorConfig = {
  theme?: string;
  toolbar?: boolean;
  width?: string;
  editorClassName?: string;
  uploader?: {
    url?: string;
    insertImageAsBase64URI?: boolean;
    customUploadFunction?: (
      requestData: unknown,
      showProgress: (progress: number) => void
    ) => Promise<{
      success?: boolean;
      time?: string;
      data?: {
        files?: string[];
        persistedFiles?: string[];
      };
      file?: {
        key?: string;
        size?: number;
        contentType?: string;
      };
    }>;
  };
  events?: {
    change?: (newContent: string) => void;
  };
};

type MockJoditInstance = {
  container: HTMLDivElement;
  destruct: ReturnType<typeof vi.fn>;
  execCommand: ReturnType<typeof vi.fn>;
  synchronizeValues: ReturnType<typeof vi.fn>;
  s: {
    commitStyle: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
  };
  options: {
    theme: string;
  };
  value: string;
  readonly valueAssignments: number;
};

const { makeEditor } = vi.hoisted(() => ({
  makeEditor:
    vi.fn<
      (
        element: HTMLElement | string,
        options?: MockEditorConfig
      ) => MockJoditInstance
    >(),
}));

vi.mock("jodit", () => ({
  Jodit: {
    make: makeEditor,
  },
}));

class MockMutationObserver {
  private static callbacks = new Map<MockMutationObserver, MutationCallback>();

  constructor(callback: MutationCallback) {
    MockMutationObserver.callbacks.set(this, callback);
  }

  observe() {}

  disconnect() {
    MockMutationObserver.callbacks.delete(this);
  }

  takeRecords(): MutationRecord[] {
    return [];
  }

  static async notifyAll() {
    await Promise.resolve();
    MockMutationObserver.callbacks.forEach((callback) => {
      callback([] as MutationRecord[], {} as MutationObserver);
    });
  }

  static reset() {
    MockMutationObserver.callbacks.clear();
  }
}

class MockResizeObserver {
  private static callbacks = new Map<
    MockResizeObserver,
    ResizeObserverCallback
  >();

  constructor(callback: ResizeObserverCallback) {
    MockResizeObserver.callbacks.set(this, callback);
  }

  observe() {}

  disconnect() {
    MockResizeObserver.callbacks.delete(this);
  }

  unobserve() {}

  static async notifyAll() {
    await Promise.resolve();
    MockResizeObserver.callbacks.forEach((callback) => {
      callback([] as ResizeObserverEntry[], {} as ResizeObserver);
    });
  }

  static reset() {
    MockResizeObserver.callbacks.clear();
  }
}

const createdEditors: MockJoditInstance[] = [];
let originalWindowMutationObserver: typeof window.MutationObserver;
let originalGlobalMutationObserver: typeof globalThis.MutationObserver;
let originalWindowResizeObserver: typeof window.ResizeObserver;
let originalGlobalResizeObserver: typeof globalThis.ResizeObserver;
let originalFetch: typeof globalThis.fetch;

const createMockEditor = (options?: MockEditorConfig): MockJoditInstance => {
  const container = document.createElement("div");
  let currentValue = "";
  let valueAssignments = 0;

  const editor = {
    container,
    destruct: vi.fn(),
    execCommand: vi.fn(),
    synchronizeValues: vi.fn(),
    s: {
      commitStyle: vi.fn(),
      focus: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    },
    options: {
      theme: options?.theme ?? "default",
    },
    get value() {
      return currentValue;
    },
    set value(nextValue: string) {
      currentValue = nextValue;
      valueAssignments += 1;
    },
    get valueAssignments() {
      return valueAssignments;
    },
  };

  container.classList.add(`jodit_theme_${editor.options.theme}`);
  return editor;
};

const installEditorWidthController = (
  container: HTMLElement,
  initialWidth: number
) => {
  const wrapper = container.querySelector(".notes-editor");
  if (!wrapper) {
    throw new Error("Expected NotesEditor wrapper to be rendered");
  }

  let currentWidth = initialWidth;

  Object.defineProperty(wrapper, "clientWidth", {
    configurable: true,
    get: () => currentWidth,
  });

  return async (nextWidth: number) => {
    currentWidth = nextWidth;
    await MockResizeObserver.notifyAll();
  };
};

describe("NotesEditor", () => {
  beforeEach(() => {
    cleanup();
    createdEditors.length = 0;
    document.documentElement.className = "";
    MockMutationObserver.reset();
    MockResizeObserver.reset();
    originalWindowMutationObserver = window.MutationObserver;
    originalGlobalMutationObserver = globalThis.MutationObserver;
    originalWindowResizeObserver = window.ResizeObserver;
    originalGlobalResizeObserver = globalThis.ResizeObserver;
    originalFetch = globalThis.fetch;

    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      writable: true,
      value: MockMutationObserver,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: MockMutationObserver,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: MockResizeObserver,
    });

    makeEditor.mockReset();
    makeEditor.mockImplementation((_element, options) => {
      const editor = createMockEditor(options);
      createdEditors.push(editor);
      return editor;
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      writable: true,
      value: originalWindowMutationObserver,
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: originalGlobalMutationObserver,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalWindowResizeObserver,
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      writable: true,
      value: originalGlobalResizeObserver,
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: originalFetch,
    });
    MockMutationObserver.reset();
    MockResizeObserver.reset();
    cleanup();
  });

  it("updates the Jodit theme in place without recreating the editor", async () => {
    render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const editor = createdEditors[0];
    expect(editor.options.theme).toBe("default");
    expect(editor.container.classList.contains("jodit_theme_default")).toBe(
      true
    );

    document.documentElement.classList.add("dark");
    await MockMutationObserver.notifyAll();

    await waitFor(() => {
      expect(editor.options.theme).toBe("dark");
      expect(editor.container.classList.contains("jodit_theme_dark")).toBe(
        true
      );
    });

    expect(editor.container.classList.contains("jodit_theme_default")).toBe(
      false
    );
    expect(makeEditor).toHaveBeenCalledTimes(1);
    expect(editor.destruct).not.toHaveBeenCalled();
  });

  it("disables the built-in Jodit toolbar and overflows actions when space runs out", async () => {
    const { container } = render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const setEditorWidth = installEditorWidthController(container, 300);
    await setEditorWidth(300);

    const options = makeEditor.mock.calls[0]?.[1];
    expect(options?.toolbar).toBe(false);
    expect(options?.width).toBe("100%");
    expect(options?.editorClassName).toBe("notes-editor__content");

    await waitFor(() => {
      expect(screen.getByTestId("notes-toolbar-overflow-button")).toBeTruthy();
      expect(screen.getByTestId("notes-toolbar-bold-button")).toBeTruthy();
      expect(screen.queryByTestId("notes-toolbar-redo-button")).toBeNull();
    });
  });

  it("executes inline and overflow commands through the custom toolbar", async () => {
    const { container } = render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const setEditorWidth = installEditorWidthController(container, 300);
    await setEditorWidth(300);

    const editor = createdEditors[0];
    const boldButton = screen.getByTestId("notes-toolbar-bold-button");
    fireEvent.mouseDown(boldButton);
    fireEvent.click(boldButton);

    expect(editor.s.save).toHaveBeenCalled();
    expect(editor.s.restore).toHaveBeenCalled();
    expect(editor.s.focus).toHaveBeenCalled();
    expect(editor.execCommand).toHaveBeenCalledWith("bold");

    const overflowButton = screen.getByTestId("notes-toolbar-overflow-button");
    fireEvent.pointerDown(overflowButton);

    const undoButton = await screen.findByTestId(
      "notes-toolbar-overflow-undo-button"
    );
    const overflowMenu = undoButton.closest(".notes-editor__toolbar-menu");
    expect(overflowMenu).toBeInstanceOf(HTMLElement);
    if (!(overflowMenu instanceof HTMLElement)) {
      throw new Error(
        "Expected overflow menu to be rendered as an HTML element"
      );
    }
    expect(overflowMenu.style.getPropertyValue("--notes-editor-surface")).toBe(
      "#ffffff"
    );
    fireEvent.click(undoButton);

    await waitFor(() => {
      expect(editor.execCommand).toHaveBeenCalledWith("undo");
    });
  });

  it("uploads note images through the worker and strips runtime auth tokens from saved HTML", async () => {
    const handleContentChange = vi.fn();
    render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={handleContentChange}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const options = makeEditor.mock.calls[0]?.[1];
    expect(options?.uploader?.url).toBe(buildMediaUploadUrl());
    expect(options?.uploader?.insertImageAsBase64URI).toBe(false);

    const uploadedUrl = buildMediaViewUrl("users/user-1/notes/uploaded.png");
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(
          JSON.stringify({
            success: true,
            time: new Date().toISOString(),
            data: {
              files: [uploadedUrl],
              isImages: [true],
              path: "users/user-1/notes/uploaded.png",
              baseurl: "",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const requestData = new FormData();
    requestData.append(
      "files[0]",
      new File(["image-bytes"], "uploaded.png", { type: "image/png" })
    );
    const showProgress = vi.fn();

    const uploadResponse = await options?.uploader?.customUploadFunction?.(
      requestData,
      showProgress
    );

    expect(fetchMock).toHaveBeenCalledWith(buildMediaUploadUrl(), {
      method: "POST",
      headers: {
        Authorization: "Bearer test-access-token",
      },
      body: requestData,
    });
    expect(showProgress).toHaveBeenCalledWith(25);
    expect(showProgress).toHaveBeenCalledWith(100);
    expect(uploadResponse?.data?.files?.[0]).toBe(
      `${uploadedUrl}&token=test-access-token`
    );

    options?.events?.change?.(
      `<p><img src="${uploadedUrl}&token=test-access-token"></p>`
    );

    expect(handleContentChange).toHaveBeenCalledWith(
      `<p><img src="${uploadedUrl}"></p>`
    );
  });

  it("replaces pasted data-uri images with worker URLs before saving note content", async () => {
    const handleContentChange = vi.fn();
    render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={handleContentChange}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const options = makeEditor.mock.calls[0]?.[1];
    const editor = createdEditors[0];
    const uploadedUrl = buildMediaViewUrl(
      "users/user-1/notes/pasted-image-1.png"
    );
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(
          JSON.stringify({
            success: true,
            time: new Date().toISOString(),
            data: {
              files: [uploadedUrl],
              isImages: [true],
              path: "users/user-1/notes/pasted-image-1.png",
              baseurl: "",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
    );
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    const pastedDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2C9f8AAAAASUVORK5CYII=";

    options?.events?.change?.(`<p><img src="${pastedDataUrl}"></p>`);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(buildMediaUploadUrl());
    await waitFor(() => {
      expect(handleContentChange).toHaveBeenCalledWith(
        `<p><img src="${uploadedUrl}"></p>`
      );
    });
    expect(editor.valueAssignments).toBeGreaterThan(1);
  });

  it("returns a blob URL immediately when note media is queued offline", async () => {
    const offlineUploadSpy = vi
      .spyOn(offlineNoteMedia, "uploadNoteMediaFile")
      .mockResolvedValue({
        success: true,
        data: {
          files: ["blob:offline-note-image"],
          persistedFiles: ["tunetrees-note-media-draft://draft-1"],
        },
      });

    const handleContentChange = vi.fn();

    render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={handleContentChange}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const options = makeEditor.mock.calls[0]?.[1];
    const requestData = new FormData();
    const offlineFile = new File(["offline-image"], "offline.png", {
      type: "image/png",
    });
    requestData.append("files[0]", offlineFile);

    const uploadResponse = await options?.uploader?.customUploadFunction?.(
      requestData,
      vi.fn()
    );

    expect(offlineUploadSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        file: offlineFile,
        userId: "user-1",
        accessToken: "test-access-token",
      })
    );
    expect(uploadResponse?.data?.files).toEqual(["blob:offline-note-image"]);

    const optionsEvents = makeEditor.mock.calls[0]?.[1]?.events;
    optionsEvents?.change?.(`<p><img src="blob:offline-note-image"></p>`);

    expect(handleContentChange).toHaveBeenCalledWith(
      '<p><img src="tunetrees-note-media-draft://draft-1"></p>'
    );
  });

  it("persists stable draft URLs when pasted data-uri images are queued offline", async () => {
    const offlineUploadSpy = vi
      .spyOn(offlineNoteMedia, "uploadNoteMediaFile")
      .mockResolvedValue({
        success: true,
        data: {
          files: ["blob:offline-pasted-note-image"],
          persistedFiles: ["tunetrees-note-media-draft://draft-2"],
        },
      });
    offlineUploadSpy.mockClear();

    const handleContentChange = vi.fn();
    render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={handleContentChange}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const options = makeEditor.mock.calls[0]?.[1];
    const editor = createdEditors[0];
    const pastedDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2C9f8AAAAASUVORK5CYII=";

    options?.events?.change?.(`<p><img src="${pastedDataUrl}"></p>`);

    await waitFor(() => {
      expect(offlineUploadSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(editor.value).toBe(
        '<p><img src="blob:offline-pasted-note-image"></p>'
      );
      expect(handleContentChange).toHaveBeenCalledWith(
        '<p><img src="tunetrees-note-media-draft://draft-2"></p>'
      );
    });
  });

  it("rehydrates stored offline draft references into fresh blob URLs in the editor", async () => {
    const resolveDraftHtmlSpy = vi
      .spyOn(offlineNoteMedia, "resolveOfflineNoteMediaDraftUrlsInHtml")
      .mockResolvedValue({
        html: '<p><img src="blob:rehydrated-note-image"></p>',
        displayUrlByDraftUrl: new Map([
          [
            "tunetrees-note-media-draft://draft-1",
            "blob:rehydrated-note-image",
          ],
        ]),
        revoke: vi.fn(),
      });

    render(() => (
      <NotesEditor
        content={'<p><img src="tunetrees-note-media-draft://draft-1"></p>'}
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(resolveDraftHtmlSpy).toHaveBeenCalledWith(
        '<p><img src="tunetrees-note-media-draft://draft-1"></p>',
        expect.objectContaining({
          reuseDisplayUrlByDraftUrl: expect.any(Map),
        })
      );
      expect(createdEditors[0]?.value).toBe(
        '<p><img src="blob:rehydrated-note-image"></p>'
      );
    });
  });

  it("applies list formatting through Jodit's commitStyle API", async () => {
    const { container } = render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const setEditorWidth = installEditorWidthController(container, 360);
    await setEditorWidth(360);

    const editor = createdEditors[0];
    const bulletedListButton = screen.getByTestId("notes-toolbar-ul-button");
    fireEvent.mouseDown(bulletedListButton);
    fireEvent.click(bulletedListButton);

    expect(editor.s.focus).toHaveBeenCalled();
    expect(editor.s.commitStyle).toHaveBeenCalledWith({
      element: "ul",
      attributes: {
        style: {
          listStyleType: null,
        },
      },
    });
    expect(editor.synchronizeValues).toHaveBeenCalled();

    const numberedListButton = screen.getByTestId("notes-toolbar-ol-button");
    fireEvent.mouseDown(numberedListButton);
    fireEvent.click(numberedListButton);

    expect(editor.s.commitStyle).toHaveBeenCalledWith({
      element: "ol",
      attributes: {
        style: {
          listStyleType: null,
        },
      },
    });
  });

  it("moves actions into and out of the overflow menu as the editor width changes", async () => {
    const { container } = render(() => (
      <NotesEditor
        content="<p>Initial note</p>"
        onContentChange={() => undefined}
      />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const setEditorWidth = installEditorWidthController(container, 240);
    await setEditorWidth(240);

    await waitFor(() => {
      expect(screen.getByTestId("notes-toolbar-overflow-button")).toBeTruthy();
      expect(screen.queryByTestId("notes-toolbar-ol-button")).toBeNull();
      expect(screen.queryByTestId("notes-toolbar-link-button")).toBeNull();
    });

    await setEditorWidth(300);

    await waitFor(() => {
      expect(screen.getByTestId("notes-toolbar-overflow-button")).toBeTruthy();
      expect(screen.getByTestId("notes-toolbar-ol-button")).toBeTruthy();
      expect(screen.queryByTestId("notes-toolbar-link-button")).toBeNull();
    });

    await setEditorWidth(360);

    await waitFor(() => {
      expect(screen.queryByTestId("notes-toolbar-overflow-button")).toBeNull();
      expect(screen.getByTestId("notes-toolbar-link-button")).toBeTruthy();
      expect(screen.getByTestId("notes-toolbar-redo-button")).toBeTruthy();
    });
  });

  it("only pushes external content updates into Jodit when the value changes", async () => {
    let setContent: Setter<string> | undefined;

    const Host = () => {
      const [content, updateContent] = createSignal("<p>Initial note</p>");
      setContent = updateContent;

      return (
        <NotesEditor content={content()} onContentChange={() => undefined} />
      );
    };

    render(() => <Host />);

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const editor = createdEditors[0];
    expect(editor.valueAssignments).toBe(2);

    const updateContent = setContent;
    expect(updateContent).toBeDefined();
    if (!updateContent) {
      throw new Error("Expected test host content setter to be assigned");
    }

    updateContent("<p>Initial note</p>");
    await waitFor(() => {
      expect(editor.valueAssignments).toBe(2);
    });

    updateContent("<p>Updated note</p>");
    await waitFor(() => {
      expect(editor.value).toBe("<p>Updated note</p>");
      expect(editor.valueAssignments).toBe(3);
    });
  });
});
