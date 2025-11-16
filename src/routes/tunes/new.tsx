/**
 * New Tune Route
 *
 * Protected route for creating a new tune.
 * Accepts query parameters for imported tune data (title, type, mode, structure, incipit, genre, sourceUrl).
 * Covers the entire viewport including tabs, with sidebar visible.
 *
 * @module routes/tunes/new
 */

import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import type { Component } from "solid-js";
import { createMemo } from "solid-js";
import type { TuneEditorData } from "../../components/tunes";
import { TuneEditor } from "../../components/tunes";
import { useAuth } from "../../lib/auth/AuthContext";
import { createReference } from "../../lib/db/queries/references";
import { createTune } from "../../lib/db/queries/tunes";

/**
 * New Tune Page Component
 */
const NewTunePage: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt, user } = useAuth();
  const [searchParams] = useSearchParams();

  // Store the location we came from (referrer) for proper back navigation
  const returnPath = createMemo(() => {
    const state = location.state as any;
    return state?.from || "/";
  });

  // Extract imported data from query params
  // Helper to normalize query param values to string
  const qp = (key: string): string | undefined => {
    const v = (searchParams as any)[key];
    if (Array.isArray(v)) return v[0];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };

  const initialData = createMemo(() => ({
    title: qp("title") || "",
    type: qp("type") || undefined,
    mode: qp("mode") || undefined,
    structure: qp("structure") || undefined,
    incipit: qp("incipit") || undefined,
    genre: qp("genre") || undefined,
    sourceUrl: qp("sourceUrl") || undefined,
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
        const supabaseUserId = user()?.id;
        if (userId && supabaseUserId) {
          try {
            const foreignId = sourceUrl.split("/").filter(Boolean).pop();
            const title = sourceUrl.includes("://www.irishtune.info")
              ? `irishtune.info #${foreignId}`
              : sourceUrl.includes("://thesession.org")
                ? `thesession.org #${foreignId}`
                : `Source #${foreignId}`;

            await createReference(
              db,
              {
                tuneRef: newTune.id,
                url: sourceUrl,
                title: title,
                refType: "website",
                favorite: false,
                public: true,
                comment: undefined,
              },
              supabaseUserId
            );
          } catch (refError) {
            console.error("Error creating reference:", refError);
            // Don't fail the whole operation if reference creation fails
          }
        }
      }

      // Navigate back to where we came from
      navigate(returnPath());

      // Return the new tune ID so TuneEditor can save tags
      return newTune.id;
    } catch (error) {
      console.error("Error creating tune:", error);
      throw error; // Let TuneEditor handle the error display
    }
  };

  const handleCancel = () => {
    // Navigate back to where we came from
    navigate(returnPath());
  };

  return (
    <TuneEditor
      onSave={handleSave}
      onCancel={handleCancel}
      initialData={initialData()}
    />
  );
};

export default NewTunePage;
