"use client";

import AutoResizingRichTextarea from "@/components/AutoResizingRichTextarea";
// import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Check,
  Edit,
  GripVertical,
  Plus,
  Save,
  SquareChevronDown,
  SquareChevronRight,
  Star,
  TrashIcon,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { logVerbose } from "@/lib/logging";
import {
  createNoteAction,
  deleteNoteAction,
  getNotesAction,
  updateNoteAction,
  reorderNotesAction,
} from "../actions/practice-actions";
import { type INote, UpdateActionType } from "../types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface INoteCardProps {
  note: INote;
  onUpdate: (updatedNote: INote, action: UpdateActionType) => void;
  isDragging?: boolean;
}

function NoteCard({ note, onUpdate, isDragging }: INoteCardProps) {
  const [isOpen, setIsOpen] = useState(note.isNew);
  const [stagedNote, setStagedNote] = useState<INote>({ ...note });

  function isModified(): boolean {
    return (
      (note.created_date ?? "") !== (stagedNote.created_date ?? "") ||
      note.note_text !== stagedNote.note_text ||
      Boolean(note.favorite) !== Boolean(stagedNote.favorite) ||
      Boolean(note.public) !== Boolean(stagedNote.public)
    );
  }

  const handleEditClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the CollapsibleTrigger
    setIsOpen(!isOpen);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm("Are you sure you want to delete this note?")) {
      onUpdate(stagedNote, UpdateActionType.DELETE);
    }
    setIsOpen(false);
  };

  const handleSave = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isModified()) {
      const { isNew, ...noteToUpdate } = stagedNote;
      onUpdate(
        noteToUpdate,
        isNew ? UpdateActionType.CREATE : UpdateActionType.UPDATE,
      );
    }
    setIsOpen(false);
  };

  const handleCancelClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the CollapsibleTrigger
    if (isModified()) {
      if (!window.confirm("Are you sure you want to lose your changes?")) {
        return;
      }
      setStagedNote({ ...note });
    }
    setIsOpen(!isOpen);
  };

  const handleChange = (
    field: keyof INote,
    value: string | boolean | number | undefined,
  ) => {
    setStagedNote((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card
      className={`w-full max-w-md mb-4 ${isDragging ? "opacity-50" : ""}`}
      data-testid="tt-note-card"
    >
      <CardContent className="pt-6">
        <Collapsible open={isOpen}>
          <div className="flex items-right justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOpen) {
                    handleChange("favorite", !stagedNote.favorite);
                  }
                }}
                aria-label={
                  stagedNote.favorite
                    ? "Unflag as favorite"
                    : "Flag as favorite"
                }
                className={`p-0 h-auto ${!isOpen ? "pointer-events-none cursor-pointer" : ""}`}
                title="Favorite"
              >
                <Star
                  className={`w-4 h-4 ${stagedNote.favorite ? "text-yellow-500 fill-current" : "text-gray-400"}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isOpen) {
                    handleChange("public", !stagedNote.public);
                  }
                }}
                aria-label={
                  stagedNote.public ? "Set to private" : "Set to public"
                }
                className={`p-0 h-auto ${!isOpen ? "pointer-events-none cursor-pointer" : ""}`}
                title="Public"
              >
                <Check
                  className={`w-4 h-4 ${stagedNote.public ? "text-green-500" : "text-gray-300"}`}
                />
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                aria-label="Delete reference"
                className="p-0 h-auto"
                title="Delete reference"
                // disabled={!isModified()} // Disable the button if no modifications are made
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
              {isOpen ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSave}
                    aria-label="Save edits"
                    className="p-0 h-auto cursor-pointer"
                    title="Save edits"
                    disabled={!isModified()} // Disable the button if no modifications are made
                    data-testid="tt-save-note"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCancelClick}
                    aria-label="Cancel edits"
                    className="p-0 h-auto cursor-pointer"
                    title="Cancel edits"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit"
                  className="p-0 h-auto cursor-pointer"
                  onClick={handleEditClick} // Handle the click event to toggle the collapsible
                  title="Edit"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {isOpen ? (
            <span />
          ) : (
            <div className="space-y-0">
              {stagedNote.created_date ? (
                <div className="space-y-0">
                  {/* <label
                  htmlFor={`edit-date-${note.id}`}
                  className="text-sm font-medium"
                >
                  Edit Date:
                </label> */}
                  <Input
                    id={`edit-date-${note.id}`}
                    type="date"
                    value={stagedNote.created_date ?? ""}
                    readOnly
                    className="border-none"
                  />
                </div>
              ) : (
                <span />
              )}
              <div className="space-y-0">
                {/* <label
                  htmlFor={`edit-note-${note.id}`}
                  className="text-sm font-medium"
                >
                  Edit Note:
                </label> */}
                <AutoResizingRichTextarea
                  id={`edit-note-${note.id}`}
                  value={stagedNote.note_text ?? ""}
                  readOnly
                  onChange={(value: string) => handleChange("note_text", value)}
                  className="border-none"
                />
              </div>
            </div>
          )}
          <CollapsibleContent className="space-y-2 pt-4">
            <div className="space-y-1">
              <label
                htmlFor={`edit-date-${note.id}`}
                className="text-sm font-medium"
              >
                Edit Date:
              </label>
              <Input
                id={`edit-date-${note.id}`}
                type="date"
                value={stagedNote.created_date ?? ""}
                onChange={(e) => handleChange("created_date", e.target.value)}
                onPaste={(e) => {
                  const pastedText = e.clipboardData.getData("text");
                  const date = new Date(pastedText);
                  if (!Number.isNaN(date.getTime())) {
                    handleChange(
                      "created_date",
                      date.toISOString().split("T")[0],
                    );
                    e.preventDefault();
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`edit-note-${note.id}`}
                className="text-sm font-medium"
              >
                Edit Note:
              </label>
              <AutoResizingRichTextarea
                id={`edit-note-${note.id}`}
                value={stagedNote.note_text ?? ""}
                onChange={(value: string) => handleChange("note_text", value)}
                data-testid="tt-note-text"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

interface ISortableNoteCardProps {
  note: INote;
  onUpdate: (updatedNote: INote, action: UpdateActionType) => void;
}

function SortableNoteCard({ note, onUpdate }: ISortableNoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id ?? 0 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        type="button"
        className="mt-6 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded touch-none"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        data-testid="tt-note-drag-handle"
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </button>
      <div className="flex-1">
        <NoteCard note={note} onUpdate={onUpdate} isDragging={isDragging} />
      </div>
    </div>
  );
}

interface INotesProps {
  tuneRef: number;
  userRef: number;
  displayPublic: boolean;
}

export default function NoteCards({
  tuneRef,
  userRef,
  displayPublic,
}: INotesProps) {
  const [notes, setNotes] = useState<INote[]>([]);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const fetchedNotes = await getNotesAction(
          tuneRef,
          1,
          userRef,
          displayPublic,
        );
        setNotes(fetchedNotes);
      } catch (error) {
        console.error("Failed to fetch notes:", error);
      }
    };

    logVerbose(
      `Fetching notes for tune ${tuneRef} ${userRef} ${displayPublic}`,
    );
    fetchNotes()
      .then(() => logVerbose("fetched notes"))
      .catch((error) => console.error("Error fetching notes:", error));
  }, [tuneRef, userRef, displayPublic]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setNotes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Persist the new order to the backend
        const noteIds = newItems
          .filter((note) => note.id !== undefined && note.id > 0)
          .map((note) => note.id as number);

        if (noteIds.length > 0) {
          reorderNotesAction(noteIds)
            .then(() => {
              logVerbose("Notes reordered successfully");
            })
            .catch((error) => {
              console.error("Error reordering notes:", error);
              alert(
                "An error occurred while reordering the notes. Please try again.",
              );
            });
        }

        return newItems;
      });
    }
  };

  const handleUpdateNote = (updatedNote: INote, action: UpdateActionType) => {
    if (action === UpdateActionType.DELETE) {
      // Logic to delete the reference entry
      logVerbose("Deleting reference entry...");
      setNotes((prevNotes) =>
        prevNotes.filter((note) => note.id !== updatedNote.id),
      );
      deleteNoteAction(updatedNote.id ?? 0)
        .then(() => {
          logVerbose("Note deleted successfully");
        })
        .catch((error) => {
          console.error("Error deleting note:", error);
          alert("An error occurred while deleting the note. Please try again.");
        });
    } else if (action === UpdateActionType.CREATE) {
      // Logic to create a new reference entry
      logVerbose("Creating new reference entry...");
      createNoteAction(updatedNote)
        .then((result: INote) => {
          logVerbose("Reference updated successfully");
          // Need to update the note with the new ID
          setNotes((prevNotes) => [
            result,
            ...prevNotes.filter((note) => note.id !== updatedNote.id),
          ]);
        })
        .catch((error) => {
          console.error("Error updating reference:", error);
          alert(
            "An error occurred while creating the reference. Please try again.",
          );
        });
    } else {
      setNotes((prevNotes) =>
        prevNotes.map((note) =>
          note.id === updatedNote.id ? updatedNote : note,
        ),
      );
      updateNoteAction(updatedNote.id ?? 0, updatedNote)
        .then(() => {
          logVerbose("Reference updated successfully");
        })
        .catch((error) => {
          console.error("Error updating reference:", error);
          alert(
            "An error occurred while updating the reference. Please try again.",
          );
        });
    }
  };

  return (
    <Collapsible
      className="space-y-4"
      open={isCollapsibleOpen}
      onOpenChange={setIsCollapsibleOpen}
    >
      <div className="flex items-center justify-between space-x-4 px-4">
        <span>Notes</span>
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New Note"
            className="p-0 h-auto"
            title="New Note"
            onClick={() => {
              const newNote: INote = {
                id: -Math.floor(Math.random() * 1000000),
                tune_ref: tuneRef,
                user_ref: userRef,
                created_date: new Date().toISOString().split("T")[0],
                note_text: "",
                public: false,
                favorite: false,
                isNew: true,
                order_index: 0,
              };
              setNotes((notes) => [newNote, ...notes]);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isCollapsibleOpen ? (
                <SquareChevronDown className="h-5 w-5" />
              ) : (
                <SquareChevronRight className="h-5 w-5" />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent data-testid="tt-notes-content">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={notes.map((note) => note.id ?? 0)}
            strategy={verticalListSortingStrategy}
          >
            {notes.map((note) => {
              const duplicate =
                notes.filter((n) => n.id === note.id).length > 1;
              logVerbose(`Checking for duplicate id: ${note.id}`);
              if (duplicate) {
                logVerbose(`Duplicate id found: ${note.id}`);
              }
              return (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  onUpdate={handleUpdateNote}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
}
