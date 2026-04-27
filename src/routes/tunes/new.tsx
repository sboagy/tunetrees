/**
 * New Tune Route
 *
 * Protected route for creating a new tune.
 * Accepts query parameters for imported tune data (title, type, mode, structure, incipit, genre, composer, artist, idForeign, releaseYear, sourceUrl).
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
import {
  getUrlPathSegments,
  matchesHostname,
  parseAbsoluteUrl,
} from "../../lib/utils/url";

/**
 * New Tune Page Component
 */
const NewTunePage: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { localDb, userIdInt, user } = useAuth();
  const [searchParams] = useSearchParams();

  const getImportedSourceReferenceTitle = (sourceUrl: string): string => {
    const parsedUrl = parseAbsoluteUrl(sourceUrl);
    const foreignId = parsedUrl ? getUrlPathSegments(parsedUrl).at(-1) : null;

    if (parsedUrl && matchesHostname(parsedUrl, "irishtune.info")) {
      return foreignId ? `irishtune.info #${foreignId}` : "irishtune.info";
    }

    if (parsedUrl && matchesHostname(parsedUrl, "thesession.org")) {
      return foreignId ? `thesession.org #${foreignId}` : "thesession.org";
    }

    return foreignId ? `Source #${foreignId}` : "Source";
  };

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

  const qpInt = (key: string): number | undefined => {
    const v = qp(key);
    if (!v) return undefined;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  };

  const initialData = createMemo(() => ({
    title: qp("title") || "",
    type: qp("type") || undefined,
    mode: qp("mode") || undefined,
    structure: qp("structure") || undefined,
    incipit: qp("incipit") || undefined,
    genre: qp("genre") || undefined,
    composer: qp("composer") || undefined,
    artist: qp("artist") || undefined,
    idForeign: qp("idForeign") || qp("id_foreign") || undefined,
    releaseYear: qpInt("releaseYear") ?? qpInt("release_year") ?? undefined,
    sourceUrl: qp("sourceUrl") || undefined,
  }));

  const handleSave = async (
    tuneData: Partial<TuneEditorData>
  ): Promise<string> => {
    const db = localDb();
    const userId = userIdInt();

    if (!db) {
      console.error("Database not initialized");
      throw new Error("Database not available");
    }

    if (!userId) {
      console.error("User not authenticated");
      throw new Error("User must be authenticated to create tunes");
    }

    try {
      // Create tune in local SQLite (automatically queued for Supabase sync)
      // Note: privateFor must be set to user's ID to satisfy RLS policy
      const newTune = await createTune(db, {
        title: tuneData.title || "",
        type: tuneData.type ?? undefined,
        mode: tuneData.mode ?? undefined,
        structure: tuneData.structure ?? undefined,
        incipit: tuneData.incipit ?? undefined,
        genre: tuneData.genre ?? undefined,
        composer: tuneData.composer ?? undefined,
        artist: tuneData.artist ?? undefined,
        idForeign: tuneData.idForeign ?? undefined,
        releaseYear: tuneData.releaseYear ?? undefined,
        privateFor: userId, // Required by RLS policy for tune inserts
      });

      // If imported from external source, create a reference link
      const sourceUrl = initialData().sourceUrl;
      if (sourceUrl && newTune.id) {
        const userId = userIdInt();
        const authUserId = user()?.id;
        if (userId && authUserId) {
          try {
            await createReference(
              db,
              {
                tuneRef: newTune.id,
                url: sourceUrl,
                title: getImportedSourceReferenceTitle(sourceUrl),
                refType: "website",
                favorite: false,
                public: true,
                comment: undefined,
              },
              authUserId
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
