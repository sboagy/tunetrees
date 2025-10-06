/**
 * Home Page - Main App Container
 *
 * The main application entry point for authenticated users.
 * Shows MainLayout with tabs and sidebar.
 * Unauthenticated users are redirected to login.
 *
 * @module routes/Home
 */

import { useNavigate } from "@solidjs/router";
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
import { useAuth } from "../lib/auth/AuthContext";
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
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = createSignal<TabId>("practice");

  // Redirect unauthenticated users to login
  createEffect(() => {
    if (!loading() && !user()) {
      navigate("/login", { replace: true });
    }
  });

  return (
    <Show
      when={!loading()}
      fallback={
        <div class="flex items-center justify-center min-h-screen">
          <div class="text-lg">Loading...</div>
        </div>
      }
    >
      <Show when={user()}>
        <MainLayout activeTab={activeTab()} onTabChange={setActiveTab}>
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
