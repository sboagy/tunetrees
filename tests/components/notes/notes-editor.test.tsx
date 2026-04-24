import { cleanup, render, waitFor } from "@solidjs/testing-library";
import { createSignal, type Setter } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesEditor } from "../../../src/components/notes/NotesEditor";

vi.mock("jodit/es2021/jodit.min.css", () => ({}));

type MockEditorConfig = {
  theme?: string;
  events?: {
    change?: (newContent: string) => void;
  };
};

type MockJoditInstance = {
  container: HTMLDivElement;
  destruct: ReturnType<typeof vi.fn>;
  options: {
    theme: string;
  };
  value: string;
  readonly valueAssignments: number;
};

const { makeEditor } = vi.hoisted(() => ({
  makeEditor: vi.fn<
    (element: HTMLElement | string, options?: MockEditorConfig) => MockJoditInstance
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

const createdEditors: MockJoditInstance[] = [];
let originalWindowMutationObserver: typeof window.MutationObserver;
let originalGlobalMutationObserver: typeof globalThis.MutationObserver;

const createMockEditor = (options?: MockEditorConfig): MockJoditInstance => {
  const container = document.createElement("div");
  let currentValue = "";
  let valueAssignments = 0;

  const editor = {
    container,
    destruct: vi.fn(),
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

describe("NotesEditor", () => {
  beforeEach(() => {
    cleanup();
    createdEditors.length = 0;
    document.documentElement.className = "";
    MockMutationObserver.reset();
    originalWindowMutationObserver = window.MutationObserver;
    originalGlobalMutationObserver = globalThis.MutationObserver;

    Object.defineProperty(window, "MutationObserver", {
      configurable: true,
      writable: true,
      value: MockMutationObserver,
    });
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      writable: true,
      value: MockMutationObserver,
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
    MockMutationObserver.reset();
    cleanup();
  });

  it("updates the Jodit theme in place without recreating the editor", async () => {
    render(() => (
      <NotesEditor content="<p>Initial note</p>" onContentChange={() => undefined} />
    ));

    await waitFor(() => {
      expect(makeEditor).toHaveBeenCalledTimes(1);
    });

    const editor = createdEditors[0];
    expect(editor.options.theme).toBe("default");
    expect(editor.container.classList.contains("jodit_theme_default")).toBe(true);

    document.documentElement.classList.add("dark");
    await MockMutationObserver.notifyAll();

    await waitFor(() => {
      expect(editor.options.theme).toBe("dark");
      expect(editor.container.classList.contains("jodit_theme_dark")).toBe(true);
    });

    expect(editor.container.classList.contains("jodit_theme_default")).toBe(false);
    expect(makeEditor).toHaveBeenCalledTimes(1);
    expect(editor.destruct).not.toHaveBeenCalled();
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
    expect(editor.valueAssignments).toBe(1);

    const updateContent = setContent;
    expect(updateContent).toBeDefined();
    if (!updateContent) {
      throw new Error("Expected test host content setter to be assigned");
    }

    updateContent("<p>Initial note</p>");
    await waitFor(() => {
      expect(editor.valueAssignments).toBe(1);
    });

    updateContent("<p>Updated note</p>");
    await waitFor(() => {
      expect(editor.value).toBe("<p>Updated note</p>");
      expect(editor.valueAssignments).toBe(2);
    });
  });
});
