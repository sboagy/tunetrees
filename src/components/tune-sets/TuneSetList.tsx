import { Pencil, Trash2 } from "lucide-solid";
import type { Component } from "solid-js";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTuneSet } from "@/lib/context/CurrentTuneSetContext";
import {
  deleteTuneSet,
  getPersonalTuneSets,
  type TuneSetWithSummary,
} from "@/lib/db/queries/tune-sets";

interface TuneSetListProps {
  onTuneSetSelect?: (tuneSet: TuneSetWithSummary) => void;
  onTuneSetDeleted?: (tuneSetId: string) => void;
}

export const TuneSetList: Component<TuneSetListProps> = (props) => {
  const { user, localDb } = useAuth();
  const { tuneSetListChanged, incrementTuneSetListChanged } =
    useCurrentTuneSet();
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const [tuneSets, { refetch }] = createResource(
    () => {
      const db = localDb();
      const userId = user()?.id;
      const version = tuneSetListChanged();
      return db && userId ? { db, userId, version } : null;
    },
    async (params) => {
      if (!params) return [];
      return getPersonalTuneSets(params.db, params.userId);
    }
  );

  const orderedTuneSets = createMemo(() => tuneSets() ?? []);

  const handleDelete = async (tuneSetId: string) => {
    const db = localDb();
    const userId = user()?.id;
    if (!db || !userId) return;

    const confirmed = window.confirm(
      "Delete this tune set? The set and its item links will be removed."
    );
    if (!confirmed) return;

    try {
      setDeletingId(tuneSetId);
      await deleteTuneSet(db, tuneSetId, userId);
      incrementTuneSetListChanged();
      props.onTuneSetDeleted?.(tuneSetId);
      refetch();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div class="space-y-3">
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_100px_88px] gap-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <span>Name</span>
          <span>Description</span>
          <span>Tunes</span>
          <span>Actions</span>
        </div>

        <Show
          when={!tuneSets.loading}
          fallback={
            <div class="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
              Loading tune sets...
            </div>
          }
        >
          <Show
            when={orderedTuneSets().length > 0}
            fallback={
              <div class="px-4 py-8 text-sm text-gray-500 dark:text-gray-400">
                No tune sets yet. Create one to save subsets of your current
                repertoire.
              </div>
            }
          >
            <For each={orderedTuneSets()}>
              {(tuneSet) => {
                const isDeleting = deletingId() === tuneSet.id;
                return (
                  <div
                    class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_100px_88px] gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-sm last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/70"
                    data-testid="tune-set-list-row"
                  >
                    <button
                      type="button"
                      class="min-w-0 text-left"
                      onClick={() => props.onTuneSetSelect?.(tuneSet)}
                    >
                      <div class="font-medium text-gray-900 dark:text-white truncate">
                        {tuneSet.name}
                      </div>
                    </button>
                    <div class="text-gray-600 dark:text-gray-300 truncate">
                      {tuneSet.description || "—"}
                    </div>
                    <div class="text-gray-700 dark:text-gray-200">
                      {tuneSet.tuneCount}
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1"
                        onClick={() => props.onTuneSetSelect?.(tuneSet)}
                        title="Edit tune set"
                        aria-label="Edit tune set"
                        data-testid="edit-tune-set-button"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors p-1"
                        disabled={isDeleting}
                        onClick={() => void handleDelete(tuneSet.id)}
                        title="Delete tune set"
                        aria-label="Delete tune set"
                        data-testid="delete-tune-set-button"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
};
