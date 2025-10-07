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
  const [editingNoteId, setEditingNoteId] = createSignal<number | null>(null);
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
        userRef: user()?.id ? parseInt(user()!.id) : undefined,
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
  const handleUpdateNote = async (noteId: number, content: string) => {
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
  const handleDeleteNote = async (noteId: number) => {
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
      {/* Header with Add Note button */}
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {notes()?.length || 0} {notes()?.length === 1 ? "note" : "notes"}
        </h4>
        <Show when={currentTuneId() && !isAdding()}>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            + Add Note
          </button>
        </Show>
      </div>

      {/* New note editor */}
      <Show when={isAdding()}>
        <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
          <NotesEditor
            content={newNoteContent()}
            onContentChange={setNewNoteContent}
            placeholder="Write your note..."
            autofocus={true}
          />
          <div class="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleCreateNote}
              class="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
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
              class="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>

      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <p class="text-sm italic text-gray-500 dark:text-gray-400">
          Select a tune to view notes
        </p>
      </Show>

      {/* Loading state */}
      <Show when={notes.loading}>
        <p class="text-sm text-gray-500 dark:text-gray-400">Loading notes...</p>
      </Show>

      {/* Empty state */}
      <Show when={currentTuneId() && !notes.loading && notes()?.length === 0}>
        <p class="text-sm italic text-gray-500 dark:text-gray-400">
          No notes yet. Click "+ Add Note" to create one.
        </p>
      </Show>

      {/* Notes list */}
      <div class="space-y-3">
        <For each={notes()}>
          {(note) => (
            <div class="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 shadow-sm">
              {/* Note metadata */}
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(note.createdDate)}
                </span>
                <div class="flex gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingNoteId(
                        editingNoteId() === note.id ? null : note.id
                      )
                    }
                    class="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900 rounded transition-colors"
                    title={
                      editingNoteId() === note.id ? "Cancel edit" : "Edit note"
                    }
                  >
                    {editingNoteId() === note.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    class="text-xs px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded transition-colors"
                    title="Delete note"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Note content */}
              <Show
                when={editingNoteId() === note.id}
                fallback={
                  <div
                    class="text-sm text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none"
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
