"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Star, Edit, Plus, Save, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { getReferences } from "@/app/(main)/pages/practice/queries";
import type { IReferenceData } from "../types";

interface IReferenceCardProps {
  reference: IReferenceData;
  onToggle: (id: number, field: "public" | "favorite") => void;
  // onCommentChange: (id: number, comment: string) => void;
  displayPublic: boolean;
  onUpdate: (updatedNote: IReferenceData) => void;
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

  const handleSave = () => {
    onUpdate(stagedReference);
    setIsOpen(false);
  };

  const handleEditClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent the event from bubbling up to the CollapsibleTrigger
    setIsOpen(!isOpen);
  };

  const handleChange = (
    field: keyof IReferenceData,
    value: string | boolean | number | undefined,
  ) => {
    setStagedReference((prev) => ({ ...prev, [field]: value }));
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
            {!isOpen ? (
              <div className="flex items-center">
                <a
                  href={stagedReference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {stagedReference.title && stagedReference.title.trim() !== ""
                    ? stagedReference.title
                    : stagedReference.url}
                </a>
              </div>
            ) : (
              <span className="font-medium"> </span>
            )}
            <div className="flex items-center space-x-2">
              {isOpen ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                    }}
                    aria-label="Cancel edits"
                    className="p-0 h-auto cursor-pointer"
                    title="Cancel edits"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSave();
                    }}
                    aria-label="Save edits"
                    className="p-0 h-auto"
                    title="Save edits"
                    disabled={!isModified()} // Disable the button if no modifications are made
                  >
                    <Save className="h-4 w-4" />
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
              {!isOpen ? <div>{stagedReference.comment}</div> : <span />}
            </div>
          )}
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Badge
                variant={
                  stagedReference.ref_type === "website"
                    ? "default"
                    : stagedReference.ref_type === "audio"
                      ? "secondary"
                      : "destructive"
                }
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer"
              >
                {stagedReference.ref_type}
              </Badge>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`title-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                Title:
              </label>
              <Textarea
                id={`title-${stagedReference.title}`}
                value={stagedReference.title ?? ""}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Add a title..."
                className="w-full h-10 min-h-10 max-h-20 !important"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`url-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                URL:
              </label>
              <Textarea
                id={`url-${stagedReference.id}`}
                value={stagedReference.url ?? ""}
                onChange={(e) => handleChange("url", e.target.value)}
                placeholder="Add a url..."
                className="w-full h-10 min-h-10 max-h-30 !important"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`comment-${stagedReference.id}`}
                className="text-sm font-medium"
              >
                Comment:
              </label>
              <Textarea
                id={`comment-${stagedReference.id}`}
                value={stagedReference.comment ?? ""}
                onChange={(e) => handleChange("comment", e.target.value)}
                placeholder="Add a comment..."
                className="w-full h-20 min-h-10 max-h-50 !important"
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
  userRef: number | null;
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
  const handleUpdateReference = (updatedReference: IReferenceData) => {
    setReferences((prevReferences) =>
      prevReferences.map((note) =>
        note.id === updatedReference.id ? updatedReference : note,
      ),
    );
    // Here you would typically also make an API call to update the note on the server
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
