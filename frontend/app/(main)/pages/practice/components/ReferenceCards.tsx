"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Star, Edit, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getReferences } from "@/app/(main)/pages/practice/queries";
import type { IReferenceData } from "../types";

interface IReferenceCardProps {
  reference: IReferenceData;
  onToggle: (id: number, field: "public" | "favorite") => void;
  onCommentChange: (id: number, comment: string) => void;
  displayPublic: boolean;
}

function ReferenceCard({
  reference,
  onToggle,
  onCommentChange,
  displayPublic,
}: IReferenceCardProps) {
  const [isOpen, setIsOpen] = useState(reference.isNew || false);

  return (
    <Card className="w-full max-w-md mb-4">
      <CardContent className="pt-6">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between mb-2">
            <CollapsibleTrigger asChild>
              <div className="flex items-center space-x-2 cursor-pointer">
                {/* <span className="font-medium">Ref:</span> */}
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {reference.title && reference.title.trim() !== ""
                    ? reference.title
                    : reference.url}
                </a>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggle(reference.id, "favorite")}
              aria-label={
                reference.favorite === 1
                  ? "Remove from favorites"
                  : "Add to favorites"
              }
              className="p-0 h-auto"
            >
              <Star
                className={`w-4 h-4 ${reference.favorite === 1 ? "text-yellow-500 fill-current" : "text-gray-400"}`}
              />
            </Button>
          </div>
          <CollapsibleContent className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Badge
                variant={
                  reference.ref_type === "website"
                    ? "default"
                    : reference.ref_type === "audio"
                      ? "secondary"
                      : "destructive"
                }
              >
                {reference.ref_type}
              </Badge>
              {displayPublic && (
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-sm">Public:</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggle(reference.id, "public")}
                    aria-label={
                      reference.public === 1
                        ? "Set to private"
                        : "Set to public"
                    }
                  >
                    <Check
                      className={`w-4 h-4 ${reference.public === 1 ? "text-green-500" : "text-gray-300"}`}
                    />
                  </Button>
                </div>
              )}

              <Button variant="ghost" size="icon" aria-label="Edit reference">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <label
                htmlFor={`comment-${reference.id}`}
                className="text-sm font-medium"
              >
                Comment:
              </label>
              <Textarea
                id={`comment-${reference.id}`}
                value={reference.comment ?? ""}
                onChange={(e) => onCommentChange(reference.id, e.target.value)}
                placeholder="Add a comment..."
                className="w-full"
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

  const handleCommentChange = (id: number, comment: string) => {
    setReferences((prevReferences) =>
      prevReferences.map((ref) => (ref.id === id ? { ...ref, comment } : ref)),
    );
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
          onCommentChange={handleCommentChange}
          displayPublic={displayPublic}
        />
      ))}
    </div>
  );
}
