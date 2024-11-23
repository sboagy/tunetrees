"use client";
import { CurrentPlaylistProvider } from "@/app/(main)/pages/practice/components/CurrentPlaylistProvider";
import { CurrentTuneProvider } from "@/app/(main)/pages/practice/components/CurrentTuneContext";
import { MainPaneViewProvider } from "@/app/(main)/pages/practice/components/MainPaneViewContext";
import { RepertoireTunesProvider } from "@/app/(main)/pages/practice/components/RepertoireTunesContext";
import { ScheduledTunesProvider } from "@/app/(main)/pages/practice/components/ScheduledTunesContext";
import { TuneDataRefreshProvider } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import "@radix-ui/themes/styles.css";
import Footer from "./Footer";
import Header from "./Header";

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <CurrentPlaylistProvider>
      <MainPaneViewProvider>
        <TuneDataRefreshProvider>
          <CurrentTuneProvider>
            <RepertoireTunesProvider>
              <ScheduledTunesProvider>
                <Header />
                <main
                  id="main-content"
                  className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
                >
                  {children}
                </main>
                <Footer />
              </ScheduledTunesProvider>
            </RepertoireTunesProvider>
          </CurrentTuneProvider>
        </TuneDataRefreshProvider>
      </MainPaneViewProvider>
    </CurrentPlaylistProvider>
  );
};

export default ClientContextsWrapper;
