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
import { Toaster } from "./ui/toaster";

// import Footer from "./Footer";
// import Header from "./Header";

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <SitDownDateProvider>
      <CurrentPlaylistProvider>
        <MainPaneViewProvider>
          <TuneDataRefreshProvider>
            <CurrentTuneProvider>
              <ImportProvider>
                <TunesProviderRepertoire>
                  <TunesProviderScheduled>
                    <TunesProviderCatalog>
                      <TabsStateProvider>
                        <RowRecallEvalPopoverProvider>
                          <Header />
                          <main
                            id="main-content"
                            className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
                          >
                            {children}
                          </main>
                          <Footer />
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
