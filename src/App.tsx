/**
 * Main App Component
 *
 * Sets up routing and authentication context for TuneTrees.
 *
 * @module App
 */

import { Route, Router, useNavigate } from "@solidjs/router";
import { Toaster } from "solid-sonner";
import { ProtectedRoute } from "./components/auth";
import { MainLayout } from "./components/layout";
import { AuthProvider } from "./lib/auth/AuthContext";
import { CurrentPlaylistProvider } from "./lib/context/CurrentPlaylistContext";
import { CurrentTuneProvider } from "./lib/context/CurrentTuneContext";
import DatabaseBrowser from "./routes/debug/db";
import Home from "./routes/Home";
import Login from "./routes/Login";
import PlaylistsPage from "./routes/playlists";
import EditPlaylistPage from "./routes/playlists/[id]/edit";
import NewPlaylistPage from "./routes/playlists/new";
import PracticeHistory from "./routes/practice/history";
import TuneDetailsPage from "./routes/tunes/[id]";
import EditTunePage from "./routes/tunes/[id]/edit";
import NewTunePage from "./routes/tunes/new";

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
          {/* Toast notification provider */}
          <Toaster position="top-right" richColors closeButton />
          {/* <ThemeDebugger /> */}
          <Router>
            {/* Public Routes */}
            <Route path="/login" component={Login} />

            {/* Main App - Home with MainLayout + tabs */}
            <Route path="/" component={Home} />

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
                  <MainLayout>
                    <DatabaseBrowser />
                  </MainLayout>
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
              path="/playlists"
              component={() => (
                <ProtectedRoute>
                  <MainLayout>
                    <PlaylistsPage />
                  </MainLayout>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/playlists/new"
              component={() => (
                <ProtectedRoute>
                  <MainLayout>
                    <NewPlaylistPage />
                  </MainLayout>
                </ProtectedRoute>
              )}
            />
            <Route
              path="/playlists/:id/edit"
              component={() => (
                <ProtectedRoute>
                  <MainLayout>
                    <EditPlaylistPage />
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
        </CurrentTuneProvider>
      </CurrentPlaylistProvider>
    </AuthProvider>
  );
}

export default App;
