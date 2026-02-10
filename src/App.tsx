/**
 * Main App Component
 *
 * Sets up routing and authentication context for TuneTrees.
 *
 * @module App
 */

import { Route, Router, useNavigate } from "@solidjs/router";
import { lazy } from "solid-js";
import { Toaster } from "solid-sonner";
import { ProtectedRoute } from "./components/auth";
import { MainLayout } from "./components/layout";
import { SidebarDockProvider } from "./components/layout/SidebarDockContext";
import { UpdatePrompt } from "./components/pwa/UpdatePrompt";
import { AuthProvider } from "./lib/auth/AuthContext";
import { CurrentPlaylistProvider } from "./lib/context/CurrentPlaylistContext";
import { CurrentTuneProvider } from "./lib/context/CurrentTuneContext";
import { OnboardingProvider } from "./lib/context/OnboardingContext";
import { UIPreferencesProvider } from "./lib/context/UIPreferencesContext";
import DatabaseBrowser from "./routes/debug/db";
import Home from "./routes/Home";
import Login from "./routes/Login";
import PrivacyPolicy from "./routes/Privacy";
import PracticeHistory from "./routes/practice/history";
import TermsOfService from "./routes/Terms";
import TuneDetailsPage from "./routes/tunes/[id]";
import EditTunePage from "./routes/tunes/[id]/edit";
import TunePracticeHistoryPage from "./routes/tunes/[id]/practice-history";
import NewTunePage from "./routes/tunes/new";

// Lazy load settings pages
const UserSettingsLayout = lazy(() => import("./routes/user-settings"));
const AppearancePage = lazy(() => import("./routes/user-settings/appearance"));
const CatalogSyncPage = lazy(
  () => import("./routes/user-settings/catalog-sync")
);
const AvatarPage = lazy(() => import("./routes/user-settings/avatar"));
const AccountPage = lazy(() => import("./routes/user-settings/account"));
const SchedulingOptionsPage = lazy(
  () => import("./routes/user-settings/scheduling-options")
);
const SpacedRepetitionPage = lazy(
  () => import("./routes/user-settings/spaced-repetition")
);
const PluginsPage = lazy(() => import("./routes/user-settings/plugins"));

// Lazy load auth callback pages
const AuthCallback = lazy(() => import("./routes/auth/callback"));
const ResetPassword = lazy(() => import("./routes/reset-password"));

/**
 * App Component
 *
 * Features:
 * - Wraps entire app in AuthProvider
 * - Configures routing with @solidjs/router
 * - Sets up protected routes
 *
 * Routes:
 * - / - Main app with tabs/sidebar (protected - auto-redirects to /login if not authenticated)
 * - /login - Login page (public)
 *
 * Tab Routes (accessed via TabBar in MainLayout at /):
 * - Practice tab - Practice session with spaced repetition queue
 * - Repertoire tab - Repertoire with practice status
 * - Catalog tab - Full tune catalog with CRUD
 * - Analysis tab - Practice statistics and analytics
 *
 * Sub-routes (wrapped in MainLayout):
 * - /practice/history - Practice history table (protected)
 * - /tunes/new - New tune editor (protected)
 * - /tunes/:id - Tune details page (protected)
 * - /tunes/:id/edit - Edit tune (protected)
 */
function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <UIPreferencesProvider>
          <CurrentPlaylistProvider>
            <CurrentTuneProvider>
              <SidebarDockProvider>
                {/* Toast notification provider */}
                <Toaster position="top-right" richColors closeButton />
                {/* PWA Update Prompt */}
                <UpdatePrompt />
                {/* <ThemeDebugger /> */}
                <Router>
                  {/* Public Routes */}
                  <Route path="/login" component={Login} />
                  <Route path="/privacy" component={PrivacyPolicy} />
                  <Route path="/terms" component={TermsOfService} />
                  <Route path="/auth/callback" component={AuthCallback} />
                  <Route path="/reset-password" component={ResetPassword} />

                  {/* Main App - Home with MainLayout + tabs */}
                  <Route path="/" component={Home} />

                  {/* User Settings Routes (Modal) */}
                  <Route path="/user-settings" component={UserSettingsLayout}>
                    <Route path="/appearance" component={AppearancePage} />
                    <Route path="/catalog-sync" component={CatalogSyncPage} />
                    <Route path="/avatar" component={AvatarPage} />
                    <Route
                      path="/scheduling-options"
                      component={SchedulingOptionsPage}
                    />
                    <Route
                      path="/spaced-repetition"
                      component={SpacedRepetitionPage}
                    />
                    <Route path="/plugins" component={PluginsPage} />
                    <Route path="/account" component={AccountPage} />
                  </Route>

                  {/* Tab Route Redirects - Redirect to home with tab parameter */}
                  <Route
                    path="/practice"
                    component={() => {
                      const navigate = useNavigate();
                      navigate("/?tab=practice", { replace: true });
                      return null;
                    }}
                  />
                  <Route
                    path="/repertoire"
                    component={() => {
                      const navigate = useNavigate();
                      navigate("/?tab=repertoire", { replace: true });
                      return null;
                    }}
                  />
                  <Route
                    path="/catalog"
                    component={() => {
                      const navigate = useNavigate();
                      navigate("/?tab=catalog", { replace: true });
                      return null;
                    }}
                  />
                  <Route
                    path="/analysis"
                    component={() => {
                      const navigate = useNavigate();
                      navigate("/?tab=analysis", { replace: true });
                      return null;
                    }}
                  />

                  {/* Debug/Admin Routes */}
                  <Route
                    path="/debug/db"
                    component={() => (
                      <ProtectedRoute>
                        <DatabaseBrowser />
                      </ProtectedRoute>
                    )}
                  />

                  {/* Protected Sub-routes - Wrapped in MainLayout */}
                  <Route
                    path="/practice/history"
                    component={() => (
                      <ProtectedRoute>
                        <MainLayout>
                          <PracticeHistory />
                        </MainLayout>
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/tunes/new"
                    component={() => (
                      <ProtectedRoute>
                        <MainLayout>
                          <NewTunePage />
                        </MainLayout>
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/tunes/:id/edit"
                    component={() => (
                      <ProtectedRoute>
                        <MainLayout>
                          <EditTunePage />
                        </MainLayout>
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/tunes/:id/practice-history"
                    component={() => (
                      <ProtectedRoute>
                        <MainLayout>
                          <TunePracticeHistoryPage />
                        </MainLayout>
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="/tunes/:id"
                    component={() => (
                      <ProtectedRoute>
                        <MainLayout>
                          <TuneDetailsPage />
                        </MainLayout>
                      </ProtectedRoute>
                    )}
                  />
                </Router>
              </SidebarDockProvider>
            </CurrentTuneProvider>
          </CurrentPlaylistProvider>
        </UIPreferencesProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

export default App;
