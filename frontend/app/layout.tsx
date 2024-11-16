import "@radix-ui/themes/styles.css";
import "./globals.css";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Theme } from "@radix-ui/themes";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TuneTrees",
  description:
    "TuneTrees is an app make music repertoire practice more efficient, and the tunes better retained in long term memory.",
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Theme>
            <div id="root" className="flex flex-col h-full">
              <Header />
              <main
                id="main-content"
                className="flex-auto w-full max-w-8xl px-4 py-2 mx-auto sm:px-6 md:pt-0"
              >
                {children}
              </main>
              <Footer />
            </div>
          </Theme>
        </ThemeProvider>
      </body>
    </html>
  );
}
