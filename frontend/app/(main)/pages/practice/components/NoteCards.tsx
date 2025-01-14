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
  Plus,
  Save,
  SquareChevronDown,
  SquareChevronRight,
  Star,
  TrashIcon,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createNote, deleteNote, getNotes, updateNote } from "../queries";
import { type INote, UpdateActionType } from "../types";

interface INoteCardProps {
  note: INote;
  onUpdate: (updatedNote: INote, action: UpdateActionType) => void;
}

function NoteCard({ note, onUpdate }: INoteCardProps) {
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
    <Card className="w-full max-w-md mb-4">
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
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
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

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const fetchedNotes = await getNotes(tuneRef, 1, userRef, displayPublic);
        setNotes(fetchedNotes);
      } catch (error) {
        console.error("Failed to fetch notes:", error);
      }
    };

    console.log(
      `Fetching notes for tune ${tuneRef} ${userRef} ${displayPublic}`,
    );
    fetchNotes()
      .then(() => console.log("fetched notes"))
      .catch((error) => console.error("Error fetching notes:", error));
  }, [tuneRef, userRef, displayPublic]);

  const handleUpdateNote = (updatedNote: INote, action: UpdateActionType) => {
    if (action === UpdateActionType.DELETE) {
      // Logic to delete the reference entry
      console.log("Deleting reference entry...");
      setNotes((prevNotes) =>
        prevNotes.filter((note) => note.id !== updatedNote.id),
      );
      deleteNote(updatedNote.id ?? 0)
        .then(() => {
          console.log("Note deleted successfully");
        })
        .catch((error) => {
          console.error("Error deleting note:", error);
          alert("An error occurred while deleting the note. Please try again.");
        });
    } else if (action === UpdateActionType.CREATE) {
      // Logic to create a new reference entry
      console.log("Creating new reference entry...");
      createNote(updatedNote)
        .then((result: INote) => {
          console.log("Reference updated successfully");
          // Need to update the note with the new ID
          setNotes((prevNotes) => [...prevNotes, result]);
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
      updateNote(updatedNote.id ?? 0, updatedNote)
        .then(() => {
          console.log("Reference updated successfully");
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
      <CollapsibleContent>
        {notes.map((note) => {
          const duplicate = notes.filter((n) => n.id === note.id).length > 1;
          console.log(`Checking for duplicate id: ${note.id}`);
          if (duplicate) {
            console.log(`Duplicate id found: ${note.id}`);
          }
          return (
            <NoteCard key={note.id} note={note} onUpdate={handleUpdateNote} />
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
