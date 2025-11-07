import { Edit, Plus, StickyNote, Trash2 } from "lucide-solid";
import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  createNote,
  deleteNote,
  getNotesByTune,
  updateNote,
} from "@/lib/db/queries/notes";
import { NotesEditor } from "./NotesEditor";

/**
 * NotesPanel - Display and manage notes for the current tune
 *
 * Features:
 * - Display all notes for current tune
 * - Create new notes
 * - Edit existing notes
 * - Delete notes
 * - Auto-save with debounce
 *
 * Note: Uses CurrentTuneContext to track which tune's notes to display
 */
export const NotesPanel: Component = () => {
  const { currentTuneId } = useCurrentTune();
  const { user } = useAuth();

  const [isAdding, setIsAdding] = createSignal(false);
  const [editingNoteId, setEditingNoteId] = createSignal<string | null>(null); // UUID
  const [newNoteContent, setNewNoteContent] = createSignal("");

  // Load notes for current tune
  const [notes, { refetch }] = createResource(currentTuneId, async (tuneId) => {
    if (!tuneId) return [];
    const db = getDb();
    return await getNotesByTune(db, tuneId);
  });

  // Format date for display
  const formatDate = (isoString: string | null) => {
    if (!isoString) return "Unknown date";
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  // Handle creating a new note
  const handleCreateNote = async () => {
    const tuneId = currentTuneId();
    if (!tuneId || !newNoteContent().trim()) return;

    try {
      const db = getDb();
      await createNote(db, {
        tuneRef: tuneId,
        noteText: newNoteContent(),
        userRef: user()?.id, // Already a UUID string
        public: false,
      });

      // Reset form
      setNewNoteContent("");
      setIsAdding(false);

      // Reload notes
      refetch();
    } catch (error) {
      console.error("Failed to create note:", error);
    }
  };

  // Handle updating a note
  const handleUpdateNote = async (noteId: string, content: string) => {
    // UUID
    try {
      const db = getDb();
      await updateNote(db, noteId, {
        noteText: content,
      });

      // Reload notes
      refetch();
    } catch (error) {
      console.error("Failed to update note:", error);
    }
  };

  // Handle deleting a note
  const handleDeleteNote = async (noteId: string) => {
    // UUID
    if (!confirm("Delete this note?")) return;

    try {
      const db = getDb();
      await deleteNote(db, noteId);

      // Reload notes
      refetch();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  return (
    <div class="notes-panel">
      {/* Header with icon and Add Note button */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <StickyNote class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          <h4 class="text-xs font-medium text-gray-700 dark:text-gray-300">
            {notes()?.length || 0} {notes()?.length === 1 ? "note" : "notes"}
          </h4>
        </div>
        <Show when={currentTuneId() && !isAdding()}>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 text-green-600 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50"
            title="Add new note"
          >
            <Plus class="w-2.5 h-2.5" />
            Add
          </button>
        </Show>
      </div>

      {/* New note editor */}
      <Show when={isAdding()}>
        <div class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30">
          <NotesEditor
            content={newNoteContent()}
            onContentChange={setNewNoteContent}
            placeholder="Write your note..."
            autofocus={true}
          />
          <div class="flex gap-1.5 mt-1.5">
            <button
              type="button"
              onClick={handleCreateNote}
              class="px-2 py-0.5 text-xs text-green-600 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50"
              disabled={!newNoteContent().trim()}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewNoteContent("");
              }}
              class="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <p class="text-xs italic text-gray-500 dark:text-gray-400">
          Select a tune to view notes
        </p>
      </Show>

      {/* Loading state */}
      <Show when={notes.loading}>
        <p class="text-xs text-gray-500 dark:text-gray-400">Loading notes...</p>
      </Show>

      {/* Empty state */}
      <Show when={currentTuneId() && !notes.loading && notes()?.length === 0}>
        <p class="text-xs italic text-gray-500 dark:text-gray-400">
          No notes yet. Click "+ Add Note" to create one.
        </p>
      </Show>

      {/* Notes list */}
      <div class="space-y-2">
        <For each={notes()}>
          {(note) => (
            <div class="p-2 bg-white/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30">
              {/* Note metadata */}
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] text-gray-500 dark:text-gray-400">
                  {formatDate(note.createdDate)}
                </span>
                <div class="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingNoteId(
                        editingNoteId() === note.id ? null : note.id
                      )
                    }
                    class="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 rounded-sm transition-colors"
                    title={
                      editingNoteId() === note.id ? "Cancel edit" : "Edit note"
                    }
                  >
                    <Edit class="w-2.5 h-2.5" />
                    {editingNoteId() === note.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    class="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/30 rounded-sm transition-colors"
                    title="Delete note"
                  >
                    <Trash2 class="w-2.5 h-2.5" />
                    Delete
                  </button>
                </div>
              </div>

              {/* Note content */}
              <Show
                when={editingNoteId() === note.id}
                fallback={
                  <div
                    class="text-xs text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
                    innerHTML={note.noteText || ""}
                  />
                }
              >
                <NotesEditor
                  content={note.noteText || ""}
                  onContentChange={(content) =>
                    handleUpdateNote(note.id, content)
                  }
                  placeholder="Edit your note..."
                />
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
