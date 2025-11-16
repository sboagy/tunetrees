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
import { getUserPlaylists } from "../lib/db/queries/playlists";
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
  const { user, loading, isAnonymous, initialSyncComplete, localDb } = useAuth();
  const { startOnboarding, shouldShowOnboarding } = useOnboarding();
  const [activeTab, setActiveTab] = createSignal<TabId>("practice");
  const [hasCheckedOnboarding, setHasCheckedOnboarding] = createSignal(false);

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

  // Check if onboarding is needed for users with no playlists
  createEffect(() => {
    // Wait for auth to be loaded and initial sync to complete
    if (
      !loading() &&
      (user() || isAnonymous()) &&
      initialSyncComplete() &&
      !hasCheckedOnboarding()
    ) {
      setHasCheckedOnboarding(true);
      
      // Check if user has any playlists
      const db = localDb();
      const userId = user()?.id || "anonymous";
      
      if (db && userId) {
        void (async () => {
          try {
            const playlists = await getUserPlaylists(db, userId);
            const hasPlaylists = playlists.length > 0;
            
            if (shouldShowOnboarding(hasPlaylists)) {
              console.log("🎓 No playlists found, starting onboarding");
              // Small delay to let UI settle
              setTimeout(() => {
                startOnboarding();
              }, 500);
            }
          } catch (error) {
            console.error("Failed to check playlists for onboarding:", error);
          }
        })();
      }
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
