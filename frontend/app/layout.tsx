import ClientContextsWrapper from "@/components/ClientContextsWrapper";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@radix-ui/themes/styles.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
          <Header />
          <ClientContextsWrapper>{children}</ClientContextsWrapper>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
