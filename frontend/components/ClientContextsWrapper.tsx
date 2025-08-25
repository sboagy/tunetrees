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

import { useEffect } from "react";
import { useSession } from "next-auth/react";

const fetchWithTimeout = (url: string, options = {}, timeout = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
};

const loadTestBrowserProperties = () => {
  const nodeEnv = process.env.NODE_ENV;
  if (typeof window !== "undefined" && nodeEnv === "development") {
    fetchWithTimeout("/test-browser.properties", {}, 600000)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch test-browser.properties");
        const text = res.text();
        return text;
      })
      .then((text) => {
        const lines = text.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const [key, ...rest] = trimmed.split("=");
          const value = rest.join("=").trim();
          if (key === "TT_REVIEW_SITDOWN_DATE" && value) {
            if (typeof window.__TT_REVIEW_SITDOWN_DATE__ === "undefined") {
              window.__TT_REVIEW_SITDOWN_DATE__ = value;
            }
            window.localStorage.setItem("TT_REVIEW_SITDOWN_DATE", value);
            console.assert(
              window.localStorage.getItem("TT_REVIEW_SITDOWN_DATE") === value,
              "TT_REVIEW_SITDOWN_DATE in localStorage does not match the expected value",
            );
            // if (!window.localStorage.getItem("TT_REVIEW_SITDOWN_DATE")) {
            //   window.localStorage.setItem("TT_REVIEW_SITDOWN_DATE", value);
            // }
          }
          // Add more keys as needed
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          console.warn("Fetch for test-browser.properties timed out");
        }
        // else ignore or handle other errors
      });
  }
};

const ClientContextsWrapper = ({ children }: React.PropsWithChildren) => {
  const { data: session } = useSession();
  const userId = session?.user?.id
    ? Number.parseInt(session.user.id)
    : undefined;
  useEffect(() => {
    loadTestBrowserProperties();
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
