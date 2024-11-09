"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Star, Edit, Plus, Save, XCircle, Delete } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  createReference,
  deleteReference,
  getReferences,
  updateReference,
} from "@/app/(main)/pages/practice/queries";
import { type IReferenceData, UpdateActionType } from "../types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import "./ReferenceCards.css"; // Import the CSS file
import AutoResizingRichTextarea from "@/components/AutoResizingRichTextarea";
import AutoResizingTextarea from "@/components/AutoResizingTextarea";

interface IReferenceCardProps {
  reference: IReferenceData;
  onToggle: (id: number, field: "public" | "favorite") => void;
  // onCommentChange: (id: number, comment: string) => void;
  displayPublic: boolean;
  onUpdate: (updatedNote: IReferenceData, action: UpdateActionType) => void;
}

function ReferenceCard({
  reference,
  displayPublic,
  onUpdate,
}: IReferenceCardProps) {
  const [isOpen, setIsOpen] = useState(reference.isNew || false);
  const [stagedReference, setStagedReference] = useState<IReferenceData>({
    ...reference,
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  function isModified(): boolean {
    return (
      (reference.comment ?? "") !== (stagedReference.comment ?? "") ||
      reference.url !== stagedReference.url ||
      reference.title !== stagedReference.title ||
      reference.ref_type !== stagedReference.ref_type ||
      Boolean(reference.favorite) !== Boolean(stagedReference.favorite) ||
      Boolean(reference.public) !== Boolean(stagedReference.public)
    );
  }

  const handleEditClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the CollapsibleTrigger
    setIsOpen(!isOpen);
  };

  const handleSave = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isModified()) {
      const { isNew, ...referenceToUpdate } = stagedReference;
      onUpdate(
        referenceToUpdate,
        isNew ? UpdateActionType.CREATE : UpdateActionType.UPDATE,
      );
    }
    setIsOpen(false);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm("Are you sure you want to delete this reference?")) {
      onUpdate(stagedReference, UpdateActionType.DELETE);
    }
    setIsOpen(false);
  };

  const handleCancelClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the CollapsibleTrigger
    if (isModified()) {
      if (!window.confirm("Are you sure you want to lose your changes?")) {
        return;
      }
      setStagedReference({ ...reference });
    }
    setIsOpen(!isOpen);
  };

  const handleChange = (
    field: keyof IReferenceData,
    value: string | boolean | number | undefined,
  ) => {
    setStagedReference((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (newType: string) => {
    setStagedReference((prev) => ({ ...prev, ref_type: newType }));
    setIsPopoverOpen(false);
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
                    handleChange("favorite", !stagedReference.favorite);
                  }
                }}
                aria-label={
                  stagedReference.favorite
                    ? "Unflag as favorite"
                    : "Flag as favorite"
                }
                className={`p-0 h-auto ${!isOpen ? "pointer-events-none cursor-pointer" : ""}`}
                title="Favorite"
              >
                <Star
                  className={`w-4 h-4 ${stagedReference.favorite ? "text-yellow-500 fill-current" : "text-gray-400"}`}
                />
              </Button>
              {displayPublic && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isOpen) {
                      handleChange("public", !stagedReference.public);
                    }
                  }}
                  aria-label={
                    stagedReference.public ? "Set to private" : "Set to public"
                  }
                  className={`p-0 h-auto ${!isOpen ? "pointer-events-none cursor-pointer" : ""}`}
                  title="Public"
                >
                  <Check
                    className={`w-4 h-4 ${stagedReference.public ? "text-green-500" : "text-gray-300"}`}
                  />
                </Button>
              )}
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
                <Delete className="h-4 w-4" />
              </Button>
              {isOpen ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSave}
                    aria-label="Save edits"
                    className="p-0 h-auto"
                    title="Save edits"
                    disabled={!isModified()} // Disable the button if no modifications are made
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
                  onClick={handleEditClick} // Handle the click event to toggle the collapsible
                  className="p-0 h-auto cursor-pointer"
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
            <div className="space-y-2">
              {!isOpen && stagedReference.comment?.trim ? (
                <AutoResizingRichTextarea
                  id={`edit-note-${reference.id}`}
                  value={stagedReference.comment ?? ""}
                  readOnly
                  onChange={(value: string) => handleChange("comment", value)}
                  className="border-none"
                />
              ) : (
                <span />
              )}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            {!isOpen ? (
              <>
                <div
                  className={`mt-1 rounded-2xl px-2 py-1 ${
                    stagedReference.ref_type === "website"
                      ? "bg-blue-800 text-white"
                      : stagedReference.ref_type === "audio"
                        ? "bg-green-800 text-white"
                        : "bg-red-800 text-white"
                  }`}
                >
                  {stagedReference.ref_type}
                </div>
                <div className="flex items-center">
                  <a
                    href={stagedReference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {stagedReference.title &&
                    stagedReference.title.trim() !== ""
                      ? stagedReference.title
                      : stagedReference.url}
                  </a>
                </div>
              </>
            ) : (
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <div
                    className={`mt-1 rounded-2xl px-2 py-1 ${
                      stagedReference.ref_type === "website"
                        ? "bg-blue-800 text-white"
                        : stagedReference.ref_type === "audio"
                          ? "bg-green-800 text-white"
                          : "bg-purple-800 text-white"
                    }`}
                  >
                    {stagedReference.ref_type}
                  </div>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-col space-y-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleTypeChange("website")}
                      className="bg-blue-800 text-white"
                    >
                      Website
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleTypeChange("audio")}
                      className="bg-green-800 text-white"
                    >
                      Audio
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleTypeChange("video")}
                      className="bg-purple-800 text-white"
                    >
                      Video
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>{" "}
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="space-y-1">
              <label
                htmlFor={`title-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                Title:
              </label>
              <AutoResizingTextarea
                id={`title-${stagedReference.title}`}
                value={stagedReference.title ?? ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Add a title..."
                // className="w-full h-10 min-h-10 max-h-20 !important"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`url-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                URL:
              </label>
              <AutoResizingTextarea
                id={`url-${stagedReference.id}`}
                value={stagedReference.url ?? ""}
                onChange={(e) => handleChange("url", e.target.value)}
                placeholder="Add a url..."
                // className="w-full h-10 min-h-10 max-h-30 !important"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`comment-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                Comment:
              </label>
              <AutoResizingRichTextarea
                id={`comment-${stagedReference.id}`}
                value={stagedReference.comment ?? ""}
                onChange={(value: string) => handleChange("comment", value)}
                placeholder="Add a comment..."
                // className="w-full h-20 min-h-10 max-h-50 !important"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

interface IReferenceCardsProps {
  tuneRef: number;
  userRef: number;
  displayPublic: boolean;
}

export default function ReferenceCards({
  tuneRef,
  userRef,
  displayPublic,
}: IReferenceCardsProps) {
  const [references, setReferences] = useState<IReferenceData[]>([]);

  useEffect(() => {
    const fetchReferences = async () => {
      const data = await getReferences(tuneRef, userRef);
      console.log(`setting references... ${tuneRef} ${userRef}`);
      setReferences(data);
    };
    console.log(`fetching references... ${tuneRef} ${userRef}`);
    fetchReferences()
      .then(() => console.log("fetched references"))
      .catch((error) => console.error("Error fetching references:", error));
  }, [tuneRef, userRef]);

  const handleToggle = (id: number, field: "public" | "favorite") => {
    setReferences((prevReferences) =>
      prevReferences.map((ref) =>
        ref.id === id ? { ...ref, [field]: ref[field] === 1 ? 0 : 1 } : ref,
      ),
    );
  };

  // const handleCommentChange = (id: number, comment: string) => {
  //   setReferences((prevReferences) =>
  //     prevReferences.map((ref) => (ref.id === id ? { ...ref, comment } : ref)),
  //   );
  // };
  const handleUpdateReference = (
    updatedReference: IReferenceData,
    action: UpdateActionType,
  ) => {
    if (action === UpdateActionType.DELETE) {
      // Logic to delete the reference entry
      console.log("Deleting reference entry...");
      // Need to update the note with the new ID
      setReferences((prevReferences) =>
        prevReferences.filter(
          (reference) => reference.id !== updatedReference.id,
        ),
      );
      deleteReference(updatedReference.id ?? 0)
        .then(() => {
          console.log("Reference deleted successfully");
        })
        .catch((error) => {
          console.error("Error deleting reference:", error);
          alert(
            "An error occurred while deleting the reference. Please try again.",
          );
        });

      return;
    }
    const { isNew, ...referenceToUpdate } = updatedReference;
    if (action === UpdateActionType.CREATE || isNew) {
      // Logic to create a new reference entry
      console.log("Creating new reference entry...");
      const { id, ...referenceToUpdate2 } = referenceToUpdate;
      setReferences((prevReferences) =>
        prevReferences.filter((reference) => reference.id !== id),
      );

      createReference(referenceToUpdate2)
        .then((result: IReferenceData) => {
          console.log("Reference updated successfully");
          // Need to update the note with the new ID
          setReferences((prevReferences) => [...prevReferences, result]);
        })
        .catch((error) => {
          console.error("Error creating reference:", error);
          alert(
            "An error occurred while creating the reference. Please try again.",
          );
        });
    } else {
      setReferences((prevReferences) =>
        prevReferences.map((reference) =>
          reference.id === updatedReference.id ? updatedReference : reference,
        ),
      );
      updateReference(updatedReference.id ?? 0, updatedReference)
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span>References</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Add new reference"
          onClick={() => {
            // Logic to create a new reference entry
            const newReference: IReferenceData = {
              id: Date.now(), // Temporary ID, replace with actual ID from the database
              tune_ref: tuneRef,
              user_ref: userRef,
              url: "",
              title: "",
              ref_type: "website",
              favorite: 0,
              public: 0,
              comment: "",
              isNew: true,
            };
            setReferences((prevReferences) => [
              newReference,
              ...prevReferences,
            ]);
          }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {references.map((reference) => (
        <ReferenceCard
          key={reference.id}
          reference={reference}
          onToggle={handleToggle}
          // onCommentChange={handleCommentChange}
          displayPublic={displayPublic}
          onUpdate={handleUpdateReference}
        />
      ))}
    </div>
  );
}
