"use client";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@radix-ui/themes/styles.css";
import { TuneProvider } from "@/app/(main)/pages/practice/components/TuneContext";
import { TuneDataRefreshProvider } from "@/app/(main)/pages/practice/components/TuneDataRefreshContext";

const ClientLayout = ({ children }: React.PropsWithChildren) => {
  return (
    <TuneDataRefreshProvider>
      <TuneProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main
            id="main-content"
            className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
          >
            {children}
          </main>
        </ThemeProvider>
      </TuneProvider>
    </TuneDataRefreshProvider>
  );
};

export default ClientLayout;
