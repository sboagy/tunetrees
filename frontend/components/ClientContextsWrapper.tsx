"use client";
import { CurrentPlaylistProvider } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { CurrentTuneProvider } from "@/app/(main)/pages/practice/components/CurrentTuneContext";
import { ImportProvider } from "@/app/(main)/pages/practice/components/ImportContext";
import { MainPaneViewProvider } from "@/app/(main)/pages/practice/components/MainPaneViewContext";
import { RowRecallEvalPopoverProvider } from "@/app/(main)/pages/practice/components/RowRecallEvalPopoverContext";
import { SitDownDateProvider } from "@/app/(main)/pages/practice/components/SitdownDateProvider";
import { TabsStateProvider } from "@/app/(main)/pages/practice/components/TabsStateContext";
import { TuneDataRefreshProvider } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import { TunesProviderCatalog } from "@/app/(main)/pages/practice/components/TunesContextCatalog";
import { TunesProviderRepertoire } from "@/app/(main)/pages/practice/components/TunesContextRepertoire";
import { TunesProviderScheduled } from "@/app/(main)/pages/practice/components/TunesContextScheduled";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import "@radix-ui/themes/styles.css";
import { GenreProvider } from "./GenreContext";
import { Toaster } from "./ui/toaster";

// import Footer from "./Footer";
// import Header from "./Header";

// Note: no hooks currently required here after moving initSitdownDateHelpers to render path.
import { useSession } from "next-auth/react";

// Inject global helper & optional URL param override.
function initSitdownDateHelpers() {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    __TT_REVIEW_SITDOWN_DATE__?: string;
    __TT_SET_SITDOWN_DATE__?: (iso: string, manual?: boolean) => void;
  };
  if (!w.__TT_SET_SITDOWN_DATE__) {
    w.__TT_SET_SITDOWN_DATE__ = (iso: string, manual = true) => {
      try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) {
          console.warn("[SitdownHelper] Invalid date supplied", iso);
          return;
        }
        w.__TT_REVIEW_SITDOWN_DATE__ = iso;
        window.localStorage.setItem("TT_REVIEW_SITDOWN_DATE", iso);
        if (manual) {
          window.localStorage.setItem("TT_REVIEW_SITDOWN_MANUAL", "true");
        } else {
          window.localStorage.removeItem("TT_REVIEW_SITDOWN_MANUAL");
        }
        window.dispatchEvent(new Event("tt-sitdown-updated"));
        if (process.env.NODE_ENV !== "production") {
          console.debug("[SitdownHelper] set", { iso, manual });
        }
      } catch (error) {
        console.warn("[SitdownHelper] failed", error);
      }
    };
  }
  // URL param formats (non-production only):
  //   ?tt_sitdown=ISO_STRING[,auto]  -> set date (manual unless ,auto)
  //   ?tt_sitdown=reset              -> clear stored date & manual flag (next load auto rolls to today)
  try {
    if (process.env.NODE_ENV !== "production") {
      const url = new URL(window.location.href);
      const param = url.searchParams.get("tt_sitdown");
      if (param) {
        if (param === "reset") {
          window.localStorage.removeItem("TT_REVIEW_SITDOWN_DATE");
          window.localStorage.removeItem("TT_REVIEW_SITDOWN_MANUAL");
          w.__TT_REVIEW_SITDOWN_DATE__ = undefined;
          window.dispatchEvent(new Event("tt-sitdown-updated"));
          if (
            process.env.NODE_ENV === "development" ||
            process.env.NODE_ENV === "test"
          ) {
            console.debug("[SitdownHelper] reset via query param");
          }
        } else {
          // Allow optional suffix ",auto" to avoid setting manual flag
          const [iso, mode] = param.split(",");
          if (iso) {
            w.__TT_SET_SITDOWN_DATE__(iso, mode !== "auto");
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
}

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  const { data: session } = useSession();
  const userId = session?.user?.id
    ? Number.parseInt(session.user.id)
    : undefined;
  // Run helper immediately during first render (still guarded for browser) so that
  // localStorage + globals are available before tests or subsequent code reads them.
  // This replaces the previous useEffect timing which introduced a race for URL-param
  // based initialization assertions executed immediately after navigation/redirect.
  initSitdownDateHelpers();
  return (
    <SitDownDateProvider>
      <CurrentPlaylistProvider userId={userId}>
        <MainPaneViewProvider>
          <TuneDataRefreshProvider>
            <CurrentTuneProvider>
              <ImportProvider>
                <TunesProviderRepertoire>
                  <TunesProviderScheduled>
                    <TunesProviderCatalog>
                      <TabsStateProvider>
                        <RowRecallEvalPopoverProvider>
                          <GenreProvider>
                            <Header />
                            <main
                              id="main-content"
                              className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
                            >
                              {children}
                            </main>
                            <Footer />
                          </GenreProvider>
                        </RowRecallEvalPopoverProvider>
                      </TabsStateProvider>
                    </TunesProviderCatalog>
                  </TunesProviderScheduled>
                </TunesProviderRepertoire>
              </ImportProvider>
            </CurrentTuneProvider>
          </TuneDataRefreshProvider>
        </MainPaneViewProvider>
      </CurrentPlaylistProvider>
      <Toaster />
    </SitDownDateProvider>
  );
};

export default ClientContextsWrapper;
