import {
  Edit,
  GripVertical,
  Plus,
  Save,
  StickyNote,
  Trash2,
  X,
} from "lucide-solid";
import {
  type Component,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCurrentTune } from "@/lib/context/CurrentTuneContext";
import {
  getSidebarFontClasses,
  useUIPreferences,
} from "@/lib/context/UIPreferencesContext";
import { getDb } from "@/lib/db/client-sqlite";
import {
  createNote,
  deleteNote,
  getNotesByTune,
  updateNote,
  updateNoteOrder,
} from "@/lib/db/queries/notes";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { NotesEditor } from "./NotesEditor";

/**
 * NotesPanel - Display and manage notes for the current tune
 *
 * Features:
 * - Display all notes for current tune
 * - Create new notes
 * - Edit existing notes
 * - Delete notes
 * - Explicit save/cancel when editing existing notes
 * - Drag-and-drop reordering
 *
 * Note: Uses CurrentTuneContext to track which tune's notes to display
 */
export const NotesPanel: Component = () => {
  const { currentTuneId } = useCurrentTune();
  const { user } = useAuth();
  const { sidebarFontSize } = useUIPreferences();

  // Get dynamic font classes
  const fontClasses = () => getSidebarFontClasses(sidebarFontSize());

  const [isAdding, setIsAdding] = createSignal(false);
  const [editingNoteId, setEditingNoteId] = createSignal<string | null>(null); // UUID
  const [newNoteContent, setNewNoteContent] = createSignal("");
  const [editingContent, setEditingContent] = createSignal("");
  const [deleteConfirmId, setDeleteConfirmId] = createSignal<string | null>(
    null
  );
  const [isDeleting, setIsDeleting] = createSignal(false);

  // Drag-and-drop state
  const [draggedNoteId, setDraggedNoteId] = createSignal<string | null>(null);
  const [dragOverNoteId, setDragOverNoteId] = createSignal<string | null>(null);

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
    const userId = user()?.id;
    if (!userId) return;

    try {
      const db = getDb();
      await createNote(db, {
        tuneRef: tuneId,
        noteText: newNoteContent(),
        userRef: userId, // user_profile.id (UUID)
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

  const handleSaveEditedNote = async () => {
    const noteId = editingNoteId();
    if (!noteId) return;

    await handleUpdateNote(noteId, editingContent());
    setEditingNoteId(null);
    setEditingContent("");
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent("");
  };

  // Handle deleting a note
  const handleDeleteNote = async (noteId: string) => {
    try {
      const db = getDb();
      await deleteNote(db, noteId);

      if (editingNoteId() === noteId) {
        setEditingNoteId(null);
        setEditingContent("");
      }

      // Reload notes
      refetch();
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const requestDeleteNote = (noteId: string) => {
    setDeleteConfirmId(noteId);
  };

  const cancelDeleteNote = () => {
    setIsDeleting(false);
    setDeleteConfirmId(null);
  };

  const confirmDeleteNote = async () => {
    const noteId = deleteConfirmId();
    if (!noteId) return;

    setIsDeleting(true);
    try {
      await handleDeleteNote(noteId);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open) {
      cancelDeleteNote();
    }
  };

  // Drag-and-drop handlers
  const handleDragStart = (e: DragEvent, noteId: string) => {
    setDraggedNoteId(noteId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", noteId);
    }
  };

  const handleDragEnd = () => {
    setDraggedNoteId(null);
    setDragOverNoteId(null);
  };

  const handleDragOver = (e: DragEvent, noteId: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    if (draggedNoteId() !== noteId) {
      setDragOverNoteId(noteId);
    }
  };

  const handleDragLeave = () => {
    setDragOverNoteId(null);
  };

  const handleDrop = async (e: DragEvent, targetNoteId: string) => {
    e.preventDefault();
    const sourceNoteId = draggedNoteId();

    if (!sourceNoteId || sourceNoteId === targetNoteId) {
      setDraggedNoteId(null);
      setDragOverNoteId(null);
      return;
    }

    const currentNotes = notes();
    if (!currentNotes) return;

    // Calculate new order
    const sourceIndex = currentNotes.findIndex((n) => n.id === sourceNoteId);
    const targetIndex = currentNotes.findIndex((n) => n.id === targetNoteId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedNoteId(null);
      setDragOverNoteId(null);
      return;
    }

    // Create new order array
    const newOrder = [...currentNotes];
    const [movedNote] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, movedNote);

    // Update order in database
    try {
      const db = getDb();
      await updateNoteOrder(
        db,
        newOrder.map((n) => n.id)
      );
      refetch();
    } catch (error) {
      console.error("Failed to update note order:", error);
    }

    setDraggedNoteId(null);
    setDragOverNoteId(null);
  };

  return (
    <div class="notes-panel" data-testid="notes-panel">
      {/* Header with icon and Add Note button */}
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          <StickyNote class={`${fontClasses().iconSmall} text-gray-600 dark:text-gray-400`} />
          <h4
            class={`${fontClasses().text} font-medium text-gray-700 dark:text-gray-300`}
            data-testid="notes-count"
          >
            {notes()?.length || 0} {notes()?.length === 1 ? "note" : "notes"}
          </h4>
        </div>
        <Show when={currentTuneId() && !isAdding()}>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            class={`inline-flex items-center gap-1 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-600 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50`}
            title="Add new note"
            data-testid="notes-add-button"
          >
            Add
            <Plus class={fontClasses().iconSmall} />
          </button>
        </Show>
      </div>

      {/* New note editor */}
      <Show when={isAdding()}>
        <div
          class="mb-3 p-2 bg-gray-50/50 dark:bg-gray-800/50 rounded border border-gray-200/30 dark:border-gray-700/30"
          data-testid="notes-new-editor"
        >
          <div class="flex items-center justify-between mb-1">
            <span
              class={`${fontClasses().textSmall} font-semibold text-gray-700 dark:text-gray-300`}
            >
              New note
            </span>
            <div class="flex gap-1.5">
              <button
                type="button"
                onClick={handleCreateNote}
                class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-700 dark:text-green-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50`}
                disabled={!newNoteContent().trim()}
                data-testid="notes-save-button"
              >
                Save
                <Save class={fontClasses().iconSmall} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewNoteContent("");
                }}
                class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm transition-colors border border-gray-200/50 dark:border-gray-700/50`}
                data-testid="notes-cancel-button"
              >
                Cancel
                <X class={fontClasses().iconSmall} />
              </button>
            </div>
          </div>
          <NotesEditor
            content={newNoteContent()}
            onContentChange={setNewNoteContent}
            placeholder="Write your note..."
            autofocus={true}
          />
        </div>
      </Show>

      {/* No tune selected */}
      <Show when={!currentTuneId()}>
        <p
          class={`${fontClasses().text} italic text-gray-500 dark:text-gray-400`}
          data-testid="notes-no-tune-message"
        >
          Select a tune to view notes
        </p>
      </Show>

      {/* Loading state */}
      <Show when={notes.loading}>
        <p
          class={`${fontClasses().text} text-gray-500 dark:text-gray-400`}
          data-testid="notes-loading"
        >
          Loading notes...
        </p>
      </Show>

      {/* Empty state */}
      <Show when={currentTuneId() && !notes.loading && notes()?.length === 0}>
        <p
          class={`${fontClasses().text} italic text-gray-500 dark:text-gray-400`}
          data-testid="notes-empty-message"
        >
          No notes yet. Click "+ Add Note" to create one.
        </p>
      </Show>

      {/* Notes list with drag-and-drop */}
      <ul class="space-y-2 list-none" data-testid="notes-list">
        <For each={notes()}>
          {(note) => {
            const isEditing = () => editingNoteId() === note.id;

            return (
              <li
                class={`p-2 bg-white/50 dark:bg-gray-800/50 rounded border transition-all ${
                  draggedNoteId() === note.id
                    ? "opacity-50 border-gray-400/50 dark:border-gray-500/50"
                    : dragOverNoteId() === note.id
                      ? "border-blue-400 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
                      : "border-gray-200/30 dark:border-gray-700/30"
                }`}
                data-testid={`note-item-${note.id}`}
                onDragOver={(e) =>
                  handleDragOver(e as unknown as DragEvent, note.id)
                }
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e as unknown as DragEvent, note.id)}
              >
                {/* Note metadata */}
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-1">
                    {/* Drag handle */}
                    <button
                      type="button"
                      draggable={true}
                      onDragStart={(e) =>
                        handleDragStart(e as unknown as DragEvent, note.id)
                      }
                      onDragEnd={handleDragEnd}
                      class="cursor-grab active:cursor-grabbing p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Drag to reorder"
                      aria-label="Drag to reorder note"
                      data-testid={`note-drag-handle-${note.id}`}
                    >
                      <GripVertical class={fontClasses().iconSmall} />
                    </button>
                    <span
                      class={`${fontClasses().textSmall} text-gray-500 dark:text-gray-400`}
                      data-testid={`note-date-${note.id}`}
                    >
                      {formatDate(note.createdDate)}
                    </span>
                  </div>

                  <Show
                    when={isEditing()}
                    fallback={
                      <div class="flex gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingContent(note.noteText || "");
                          }}
                          class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 rounded-sm transition-colors`}
                          title="Edit note"
                          data-testid={`note-edit-button-${note.id}`}
                        >
                          Edit
                          <Edit class={fontClasses().iconSmall} />
                        </button>

                        <button
                          type="button"
                          onClick={() => requestDeleteNote(note.id)}
                          class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/30 rounded-sm transition-colors`}
                          title="Delete note"
                          data-testid={`note-delete-button-${note.id}`}
                        >
                          Delete
                          <Trash2 class={fontClasses().iconSmall} />
                        </button>
                      </div>
                    }
                  >
                    <div class="flex gap-0.5">
                      <button
                        type="button"
                        onClick={handleSaveEditedNote}
                        class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-green-700 dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-900/30 rounded-sm transition-colors`}
                        title="Save note"
                        data-testid={`note-save-button-${note.id}`}
                      >
                        Save
                        <Save class={fontClasses().iconSmall} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/30 rounded-sm transition-colors`}
                        title="Cancel editing"
                        data-testid={`note-cancel-button-${note.id}`}
                      >
                        Cancel
                        <X class={fontClasses().iconSmall} />
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDeleteNote(note.id)}
                        class={`inline-flex items-center gap-0.5 ${fontClasses().textSmall} px-1.5 py-0.5 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/30 rounded-sm transition-colors`}
                        title="Delete note"
                        data-testid={`note-delete-button-${note.id}`}
                      >
                        Delete
                        <Trash2 class={fontClasses().iconSmall} />
                      </button>
                    </div>
                  </Show>
                </div>

                {/* Note content */}
                <Show
                  when={isEditing()}
                  fallback={
                    <div
                      class={`${fontClasses().text} text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none`}
                      innerHTML={note.noteText || ""}
                      data-testid={`note-content-${note.id}`}
                    />
                  }
                >
                  <div data-testid={`note-editor-${note.id}`}>
                    <NotesEditor
                      content={editingContent()}
                      onContentChange={setEditingContent}
                      placeholder="Edit your note..."
                    />
                  </div>
                </Show>
              </li>
            );
          }}
        </For>
      </ul>

      <AlertDialog
        open={!!deleteConfirmId()}
        onOpenChange={handleDeleteDialogChange}
      >
        <AlertDialogContent data-testid="note-delete-confirm-dialog">
          <AlertDialogCloseButton />
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <button
              type="button"
              onClick={cancelDeleteNote}
              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-sm border border-gray-300 dark:border-gray-700"
              data-testid="note-delete-confirm-cancel"
            >
              Cancel
              <X class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={confirmDeleteNote}
              disabled={isDeleting()}
              class="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-70 rounded-sm border border-red-700"
              data-testid="note-delete-confirm-submit"
            >
              Delete
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
