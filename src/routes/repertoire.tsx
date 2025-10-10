/**
 * Repertoire Page
 *
 * Displays the user's repertoire (tunes they're actively practicing).
 * Shows tune table with practice status.
 *
 * Port from: legacy/frontend/app/(main)/pages/practice/components/TunesGridRepertoire.tsx
 *
 * @module routes/repertoire
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { RepertoireControlBanner } from "../components/repertoire";
import { TuneList } from "../components/tunes/TuneList";
import type { Tune } from "../lib/db/types";

/**
 * Repertoire Page Component
 *
 * Features:
 * - Sticky control banner with actions
 * - Tune table (sortable, filterable)
 * - Shows practice status (due dates, stability, etc.)
 * - Multi-select for batch actions
 *
 * @example
 * ```tsx
 * <Route path="/repertoire" component={RepertoirePage} />
 * ```
 */
const RepertoirePage: Component = () => {
  const navigate = useNavigate();

  const handleTuneSelect = (tune: Tune) => {
    navigate(`/tunes/${tune.id}`);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Sticky Control Banner */}
      <RepertoireControlBanner />

      {/* Tune Table */}
      <div class="flex-1 overflow-auto">
        <TuneList onTuneSelect={handleTuneSelect} filterByPlaylist={true} />
      </div>
    </div>
  );
};

export default RepertoirePage;
