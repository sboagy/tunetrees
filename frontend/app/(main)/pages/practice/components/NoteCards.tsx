"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
// import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Check, Star, Save, XCircle, Plus } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { INote } from "../types";
import { getNotes } from "../queries";

interface INoteCardProps {
  note: INote;
  onUpdate: (updatedNote: INote) => void;
}

function NoteCard({ note, onUpdate }: INoteCardProps) {
  const [isOpen, setIsOpen] = useState(note.isNew || false);
  const [editDate, setEditDate] = useState(note.created_date || "");
  const [editText, setEditText] = useState(note.note_text || "");

  const handleToggle = (field: "public" | "favorite") => {
    const updatedNote = {
      ...note,
      [field]: field === "public" ? !note.public : note.favorite === 1 ? 0 : 1,
    };
    onUpdate(updatedNote);
  };

  const handleSave = () => {
    const updatedNote = {
      ...note,
      created_date: editDate,
      note_text: editText,
    };
    onUpdate(updatedNote);
    setIsOpen(false);
  };

  return (
    <Card className="w-full max-w-md mb-4">
      <CardContent className="pt-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-right justify-between mb-2 cursor-pointer">
              <div className="flex items-center space-x-2">
                {/* <Badge>Note</Badge> */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle("favorite");
                  }}
                  aria-label={
                    note.favorite === 1
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                  className="p-0 h-auto"
                  title="Favorite"
                >
                  <Star
                    className={`w-4 h-4 ${note.favorite === 1 ? "text-yellow-500 fill-current" : "text-gray-400"}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle("public");
                  }}
                  aria-label={note.public ? "Set to private" : "Set to public"}
                  title="Public"
                >
                  <Check
                    className={`w-4 h-4 ${note.public ? "text-green-500" : "text-gray-300"}`}
                  />
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                {isOpen ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      aria-label="Cancel edits"
                      className="p-0 h-auto"
                      title="Cancel edits"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleSave}
                      aria-label="Save edits"
                      className="p-0 h-auto"
                      title="Save edits"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit"
                    className="p-0 h-auto"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          {isOpen ? (
            <span />
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                {/* <span className="font-medium">Date:</span> {note.created_date} */}
                {note.created_date}
              </p>
              <p className="text-sm">
                {/* <span className="font-medium">Note:</span> {note.note_text} */}
                {note.note_text}
              </p>
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
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`edit-note-${note.id}`}
                className="text-sm font-medium"
              >
                Edit Note:
              </label>
              <Textarea
                id={`edit-note-${note.id}`}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={4}
              />
            </div>
            {/* <Button onClick={handleSave}>Save Changes</Button> */}
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

  const handleUpdateNote = (updatedNote: INote) => {
    setNotes((prevNotes) =>
      prevNotes.map((note) =>
        note.id === updatedNote.id ? updatedNote : note,
      ),
    );
    // Here you would typically also make an API call to update the note on the server
  };

  return (
    <div className="space-y-4 justify-center">
      <div className="flex items-center justify-between">
        <span className="font-medium">Notes</span>
        {/* <h2 className="text-2xl font-bold mb-4">Notes for Tune {tuneRef}</h2> */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="New Note"
          className="p-0 h-auto"
          title="New Note"
          onClick={() => {
            const newNote: INote = {
              tune_ref: tuneRef,
              user_ref: userRef,
              created_date: new Date().toISOString().split("T")[0],
              note_text: "",
              public: false,
              favorite: 0,
              isNew: true,
            };
            // Here you would typically make an API call to create the note on the server
            void setNotes((notes) => [newNote, ...notes]);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onUpdate={handleUpdateNote} />
      ))}
    </div>
  );
}
