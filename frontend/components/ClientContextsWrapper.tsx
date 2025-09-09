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
import { useEffect } from "react";

// import Footer from "./Footer";
// import Header from "./Header";

// Note: no hooks currently required here after moving initSitdownDateHelpers to render path.
import { useSession } from "next-auth/react";

// Inject global helper (URL param now handled via SSR bootstrap script on practice page).
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
}

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  const { data: session } = useSession();
  const userId = session?.user?.id
    ? Number.parseInt(session.user.id)
    : undefined;
  // Defer helper side-effects (URL param parsing & event dispatch) until after initial
  // render to avoid React warning: "Cannot update a component while rendering a different component".
  // Parent wrapper effect runs before child provider effects, so SitDownDateProvider
  // still sees the initialized globals during its own mount effect.
  useEffect(() => {
    initSitdownDateHelpers();
  }, []);
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
