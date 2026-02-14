/**
 * Home Page - Main App Container
 *
 * The main application entry point for authenticated users.
 * Shows MainLayout with tabs and sidebar.
 * Unauthenticated users are redirected to login.
 *
 * @module routes/Home
 */

import { useNavigate, useSearchParams } from "@solidjs/router";
import {
  type Component,
  createEffect,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";
import { MainLayout } from "../components/layout";
import type { TabId } from "../components/layout/TabBar";
import { OnboardingOverlay } from "../components/onboarding";
import { useAuth } from "../lib/auth/AuthContext";
import { useOnboarding } from "../lib/context/OnboardingContext";
import { getUserRepertoires } from "../lib/db/queries/repertoires";
import AnalysisPage from "./analysis";
import CatalogPage from "./catalog";
import PracticeIndex from "./practice/Index";
import RepertoirePage from "./repertoire";

/**
 * Home Page Component
 *
 * Features:
 * - Auto-redirects unauthenticated users to /login
 * - Shows MainLayout with tabs/sidebar for authenticated users
 * - Tab content switches based on active tab
 * - Default tab: Practice
 *
 * @example
 * ```tsx
 * <Route path="/" component={Home} />
 * ```
 */
const Home: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    loading,
    isAnonymous,
    initialSyncComplete,
    lastSyncTimestamp,
    localDb,
    userIdInt,
  } = useAuth();
  const {
    startOnboarding,
    shouldShowOnboarding,
    hasCheckedOnboarding,
    setHasCheckedOnboarding,
  } = useOnboarding();
  const [activeTab, setActiveTab] = createSignal<TabId>("practice");

  // Initialize active tab from URL parameter
  createEffect(() => {
    const tabFromUrl = searchParams.tab as TabId;
    console.log(
      "DEBUG: Updated Search Params:",
      Object.fromEntries(Object.entries(searchParams))
    );
    if (
      tabFromUrl &&
      ["practice", "repertoire", "catalog", "analysis"].includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    }
  });

  // Redirect unauthenticated users to login (but allow anonymous users)
  createEffect(() => {
    if (!loading() && !user() && !isAnonymous()) {
      navigate("/login", { replace: true });
    }
  });

  // Check if onboarding is needed for users with no repertoires
  createEffect(() => {
    // Wait for auth to be loaded and initial sync to complete
    if (loading() || (!user() && !isAnonymous()) || !initialSyncComplete()) {
      return;
    }
    if (hasCheckedOnboarding()) return;

    // IMPORTANT: After local storage wipe, local DB starts empty and repertoires are only
    // available after the first syncDown completes. If we check too early, we incorrectly
    // show the onboarding flow to users who already have repertoires.
    if (user() && !isAnonymous()) {
      // Only gate when online; if offline we can't wait for syncDown.
      if (navigator.onLine && !lastSyncTimestamp()) {
        return;
      }
    }

    // Check if user has any repertoires
    const db = localDb();
    // Use userIdInt which is the correct UUID for both regular and anonymous users
    const userId = userIdInt();

    if (db && userId) {
      setHasCheckedOnboarding(true);
      void (async () => {
        try {
          const repertoires = await getUserRepertoires(db, userId);
          const hasRepertoires = repertoires.length > 0;

          if (shouldShowOnboarding(hasRepertoires)) {
            console.log("🎓 No repertoires found, starting onboarding");
            // Small delay to let UI settle
            setTimeout(() => {
              startOnboarding();
            }, 500);
          }
        } catch (error) {
          console.error("Failed to check repertoires for onboarding:", error);
        }
      })();
    }
  });

  // Handle tab changes and update URL
  const handleTabChange = (tabId: TabId) => {
    // Clear cross-tab filter params when switching tabs to prevent leakage
    const REPERTOIRE_URL_KEY = "tt:url:repertoire";
    const CATALOG_URL_KEY = "tt:url:catalog";

    // BEFORE setActiveTab, save the CURRENT (old) tab's query params
    const currentTabId = activeTab(); // Capture the old tab before switching
    try {
      if (typeof window !== "undefined") {
        // Read DIRECTLY from window.location.search to get the CURRENT URL state
        // (searchParams signal may have been updated by previous setSearchParams calls)
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.delete("tab"); // Remove tab param
        const queryWithoutTab = currentParams.toString();

        if (currentTabId === "repertoire") {
          localStorage.setItem(REPERTOIRE_URL_KEY, queryWithoutTab);
        } else if (currentTabId === "catalog") {
          localStorage.setItem(CATALOG_URL_KEY, queryWithoutTab);
        }
      }
    } catch (_e) {
      // non-fatal: storage might be unavailable
    }

    setActiveTab(tabId);

    // Helper to parse a query string (?a=1&b=2) to a record
    const parseQuery = (qs: string): Record<string, string> => {
      const s = qs.startsWith("?") ? qs.slice(1) : qs;
      const params = new URLSearchParams(s);
      const out: Record<string, string> = {};
      params.forEach((value, key) => {
        if (value !== "") out[key] = value;
      });
      return out;
    };

    if (tabId === "catalog") {
      // Restore saved catalog URL (if any), but enforce tab=catalog and clear repertoire keys
      let restoreObj: Record<string, string> = {};
      try {
        const saved = localStorage.getItem(CATALOG_URL_KEY);
        if (saved) restoreObj = parseQuery(saved);
      } catch {}
      // Build params: clear repertoire/legacy, restore catalog
      // Only include defined, non-empty values
      const wantedParams: Record<string, string> = { tab: tabId };
      Object.entries(restoreObj).forEach(([k, v]) => {
        if (v && v !== "") wantedParams[k] = v;
      });
      // Navigate to clean URL with only wanted params
      const queryString = new URLSearchParams(wantedParams).toString();
      navigate(`/?${queryString}`, { replace: true });
    } else if (tabId === "repertoire") {
      // Restore saved repertoire URL (if any), but enforce tab=repertoire
      let restoreObj: Record<string, string> = {};
      try {
        const saved = localStorage.getItem(REPERTOIRE_URL_KEY);
        if (saved) restoreObj = parseQuery(saved);
      } catch {}
      // Only include defined, non-empty values
      const wantedParams: Record<string, string> = { tab: tabId };
      Object.entries(restoreObj).forEach(([k, v]) => {
        if (v && v !== "") wantedParams[k] = v;
      });
      console.log("🔍 [Home] Switching to repertoire:", {
        saved: localStorage.getItem(REPERTOIRE_URL_KEY),
        restoreObj,
        wantedParams,
        queryString: new URLSearchParams(wantedParams).toString(),
      });
      // Navigate to clean URL with only wanted params
      const queryString = new URLSearchParams(wantedParams).toString();
      navigate(`/?${queryString}`, { replace: true });
    } else {
      // Other tabs: just set tab
      navigate(`/?tab=${tabId}`, { replace: true });
    }
  };

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-lg">Loading...</div>
        </div>
      }
    >
      <Show when={user() || isAnonymous()}>
        {/* Onboarding Overlay */}
        <OnboardingOverlay />

        <MainLayout activeTab={activeTab()} onTabChange={handleTabChange}>
          <Switch>
            <Match when={activeTab() === "practice"}>
              <PracticeIndex />
            </Match>
            <Match when={activeTab() === "repertoire"}>
              <RepertoirePage />
            </Match>
            <Match when={activeTab() === "catalog"}>
              <CatalogPage />
            </Match>
            <Match when={activeTab() === "analysis"}>
              <AnalysisPage />
            </Match>
          </Switch>
        </MainLayout>
      </Show>
    </Show>
  );
};

export default Home;
