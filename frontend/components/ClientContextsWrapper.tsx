"use client";
import { MainPaneViewProvider } from "@/app/(main)/pages/practice/components/MainPaneViewContext";
import { RepertoireTunesProvider } from "@/app/(main)/pages/practice/components/RepertoireTunesContext";
import { TuneProvider } from "@/app/(main)/pages/practice/components/TuneContext";
import { TuneDataRefreshProvider } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";
import "@radix-ui/themes/styles.css";

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  return (
    <MainPaneViewProvider>
      <TuneDataRefreshProvider>
        <TuneProvider>
          <RepertoireTunesProvider>
            <main
              id="main-content"
              className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
            >
              {children}
            </main>
          </RepertoireTunesProvider>
        </TuneProvider>
      </TuneDataRefreshProvider>
    </MainPaneViewProvider>
  );
};

export default ClientContextsWrapper;
