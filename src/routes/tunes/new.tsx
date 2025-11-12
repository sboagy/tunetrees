/**
 * New Tune Route
 *
 * Protected route for creating a new tune.
 * Accepts query parameters for imported tune data (title, type, mode, structure, incipit, genre, sourceUrl).
 *
 * @module routes/tunes/new
 */

import { useNavigate, useSearchParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { createMemo } from "solid-js";
import type { TuneEditorData } from "../../components/tunes";
import { TuneEditor } from "../../components/tunes";
import { useAuth } from "../../lib/auth/AuthContext";
import { createTune } from "../../lib/db/queries/tunes";
import { createReference } from "../../lib/db/queries/references";

/**
 * New Tune Page Component
 */
const NewTunePage: Component = () => {
  const navigate = useNavigate();
  const { localDb, userIdInt } = useAuth();
  const [searchParams] = useSearchParams();

  // Extract imported data from query params
  const initialData = createMemo(() => ({
    title: searchParams.title || "",
    type: searchParams.type || undefined,
    mode: searchParams.mode || undefined,
    structure: searchParams.structure || undefined,
    incipit: searchParams.incipit || undefined,
    genre: searchParams.genre || undefined,
    sourceUrl: searchParams.sourceUrl || undefined,
  }));

  const handleSave = async (
    tuneData: Partial<TuneEditorData>
  ): Promise<string> => {
    const db = localDb();
    if (!db) {
      console.error("Database not initialized");
      throw new Error("Database not available");
    }

    try {
      // Create tune in local SQLite (automatically queued for Supabase sync)
      const newTune = await createTune(db, {
        title: tuneData.title || "",
        type: tuneData.type ?? undefined,
        mode: tuneData.mode ?? undefined,
        structure: tuneData.structure ?? undefined,
        incipit: tuneData.incipit ?? undefined,
        genre: tuneData.genre ?? undefined,
        privateFor: undefined, // TODO: Add privacy controls in UI
      });

      // If imported from external source, create a reference link
      const sourceUrl = initialData().sourceUrl;
      if (sourceUrl && newTune.id) {
        const userId = userIdInt();
        const supabaseUserId = auth.user()?.id;
        if (userId && supabaseUserId) {
          try {
            const foreignId = sourceUrl.split("/").filter(Boolean).pop();
            const title = sourceUrl.includes("://www.irishtune.info")
              ? `irishtune.info #${foreignId}`
              : sourceUrl.includes("://thesession.org")
                ? `thesession.org #${foreignId}`
                : `Source #${foreignId}`;

            await createReference(db, {
              tuneRef: newTune.id,
              url: sourceUrl,
              title: title,
              refType: "website",
              favorite: false,
              public: true,
              comment: null,
            }, supabaseUserId);
          } catch (refError) {
            console.error("Error creating reference:", refError);
            // Don't fail the whole operation if reference creation fails
          }
        }
      }

      // Navigate to the newly created tune's detail page
      navigate(`/tunes/${newTune.id}`);

      // Return the new tune ID so TuneEditor can save tags
      return newTune.id;
    } catch (error) {
      console.error("Error creating tune:", error);
      throw error; // Let TuneEditor handle the error display
    }
  };

  const handleCancel = () => {
    navigate("/");
  };

  return (
    <div class="container mx-auto py-8 px-4">
      <TuneEditor
        onSave={handleSave}
        onCancel={handleCancel}
        initialData={initialData()}
      />
    </div>
  );
};

export default NewTunePage;
