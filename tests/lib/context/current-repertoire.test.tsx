import { cleanup, render } from "@solidjs/testing-library";
import { createSignal } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CurrentRepertoireProvider,
  useCurrentRepertoire,
} from "../../../src/lib/context/CurrentRepertoireContext";

const auth = vi.hoisted(() => ({ user: (): { id: string } | null => null }));
vi.mock("../../../src/lib/auth/AuthContext", () => ({ useAuth: () => auth }));
afterEach(cleanup);

function setup() {
  const [user, setUser] = createSignal<{ id: string } | null>({ id: "first" });
  auth.user = user;
  let selection!: ReturnType<typeof useCurrentRepertoire>;
  function Consumer() {
    selection = useCurrentRepertoire();
    return <span>{selection.currentRepertoireId()}</span>;
  }
  render(() => (
    <CurrentRepertoireProvider>
      <Consumer />
    </CurrentRepertoireProvider>
  ));
  selection.setCurrentRepertoireId("first-repertoire");
  return { selection, setUser };
}

describe("current repertoire account boundary", () => {
  it("clears the previous selection on sign-out", () => {
    const { selection, setUser } = setup();
    setUser(null);
    expect(selection.currentRepertoireId()).toBeNull();
  });

  it("clears the previous selection on a direct account switch", () => {
    const { selection, setUser } = setup();
    setUser({ id: "second" });
    expect(selection.currentRepertoireId()).toBeNull();
  });

  it("preserves selection when the same user's auth details refresh", () => {
    const { selection, setUser } = setup();
    setUser({ id: "first" });
    expect(selection.currentRepertoireId()).toBe("first-repertoire");
  });
});
