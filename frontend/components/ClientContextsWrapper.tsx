"use client";
import { CurrentTuneProvider } from "@/app/(main)/pages/practice/components/CurrentTuneContext";
import { MainPaneViewProvider } from "@/app/(main)/pages/practice/components/MainPaneViewContext";
import { RepertoireTunesProvider } from "@/app/(main)/pages/practice/components/RepertoireTunesContext";
import { ScheduledTunesProvider } from "@/app/(main)/pages/practice/components/ScheduledTunesContext";
import { TuneDataRefreshProvider } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import "@radix-ui/themes/styles.css";

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <MainPaneViewProvider>
      <TuneDataRefreshProvider>
        <CurrentTuneProvider>
          <RepertoireTunesProvider>
            <ScheduledTunesProvider>
              <main
                id="main-content"
                className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
              >
                {children}
              </main>
            </ScheduledTunesProvider>
          </RepertoireTunesProvider>
        </CurrentTuneProvider>
      </TuneDataRefreshProvider>
    </MainPaneViewProvider>
  );
};

export default ClientContextsWrapper;
