import { LoaderCircle } from "lucide-solid";
import { createResource, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { TabId } from "../components/layout/TabBar";

const tabModules = {
  analysis: () => import("./analysis"),
  catalog: () => import("./catalog"),
  practice: () => import("./practice"),
  repertoire: () => import("./repertoire"),
  setlists: () => import("./setlists"),
} satisfies Record<TabId, unknown>;

/** Load only the selected tab's code, without suspending its data resources.
 * A surrounding Suspense boundary would detach an already rendered grid during
 * background refetches, losing native scroll position and keyboard focus.
 */
export function TabPage(props: { tab: TabId }) {
  const [page] = createResource(
    () => props.tab,
    async (tab) => (await tabModules[tab]()).default
  );

  return (
    <Show
      when={page()}
      fallback={
        <output class="flex items-center gap-2 p-4 text-muted-foreground">
          <LoaderCircle
            class="size-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          Loading...
        </output>
      }
    >
      {(component) => <Dynamic component={component()} />}
    </Show>
  );
}
