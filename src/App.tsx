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
import { AuthProvider } from "./lib/auth/AuthContext";
import { CurrentPlaylistProvider } from "./lib/context/CurrentPlaylistContext";
import { CurrentTuneProvider } from "./lib/context/CurrentTuneContext";
import DatabaseBrowser from "./routes/debug/db";
import Home from "./routes/Home";
import Login from "./routes/Login";
import PracticeHistory from "./routes/practice/history";
import TuneDetailsPage from "./routes/tunes/[id]";
import EditTunePage from "./routes/tunes/[id]/edit";
import NewTunePage from "./routes/tunes/new";

// Lazy load settings pages
const UserSettingsLayout = lazy(() => import("./routes/user-settings"));
const AvatarPage = lazy(() => import("./routes/user-settings/avatar"));
const AccountPage = lazy(() => import("./routes/user-settings/account"));
const SchedulingOptionsPage = lazy(
  () => import("./routes/user-settings/scheduling-options")
);
const SpacedRepetitionPage = lazy(
  () => import("./routes/user-settings/spaced-repetition")
);

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
      <CurrentPlaylistProvider>
        <CurrentTuneProvider>
          <SidebarDockProvider>
            {/* Toast notification provider */}
            <Toaster position="top-right" richColors closeButton />
            {/* <ThemeDebugger /> */}
            <Router>
              {/* Public Routes */}
              <Route path="/login" component={Login} />
              <Route path="/auth/callback" component={AuthCallback} />
              <Route path="/reset-password" component={ResetPassword} />

              {/* Main App - Home with MainLayout + tabs */}
              <Route path="/" component={Home} />

              {/* User Settings Routes (Modal) */}
              <Route path="/user-settings" component={UserSettingsLayout}>
                <Route path="/avatar" component={AvatarPage} />
                <Route
                  path="/scheduling-options"
                  component={SchedulingOptionsPage}
                />
                <Route
                  path="/spaced-repetition"
                  component={SpacedRepetitionPage}
                />
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
    </AuthProvider>
  );
}

export default App;
