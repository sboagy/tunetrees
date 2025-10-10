/**
 * Catalog Page
 *
 * Complete database of all tunes (not just repertoire).
 * Provides full CRUD operations and search/filter functionality.
 *
 * Port from: legacy/frontend/app/(main)/pages/practice/components/TunesGridAll.tsx
 *
 * @module routes/catalog
 */

import { useNavigate } from "@solidjs/router";
import type { Component } from "solid-js";
import { CatalogControlBanner } from "../components/catalog";
import { TuneList } from "../components/tunes/TuneList";
import type { Tune } from "../lib/db/types";

/**
 * Catalog Page Component
 *
 * Features:
 * - Sticky control banner with actions
 * - Complete tune database view
 * - Add/edit/delete tunes
 * - Search and filtering
 * - Bulk operations
 *
 * @example
 * ```tsx
 * <Route path="/catalog" component={CatalogPage} />
 * ```
 */
const CatalogPage: Component = () => {
  const navigate = useNavigate();

  const handleTuneSelect = (tune: Tune) => {
    navigate(`/tunes/${tune.id}`);
  };

  return (
    <div class="h-full flex flex-col">
      {/* Sticky Control Banner */}
      <CatalogControlBanner />

      {/* Tune Table */}
      <div class="flex-1 overflow-auto">
        <TuneList onTuneSelect={handleTuneSelect} />
      </div>
    </div>
  );
};

export default CatalogPage;
