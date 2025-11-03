/**
 * New Tune Route
 *
 * Protected route for creating a new tune.
 *
 * @module routes/tunes/new
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import type { TuneEditorData } from "../../components/tunes";
import { TuneEditor } from "../../components/tunes";
import { useAuth } from "../../lib/auth/AuthContext";
import { createTune } from "../../lib/db/queries/tunes";

/**
 * New Tune Page Component
 */
const NewTunePage: Component = () => {
  const navigate = useNavigate();
  const { localDb } = useAuth();

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
      <TuneEditor onSave={handleSave} onCancel={handleCancel} />
    </div>
  );
};

export default NewTunePage;
