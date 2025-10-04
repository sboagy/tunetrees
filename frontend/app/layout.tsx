import ClientContextsWrapper from "@/components/ClientContextsWrapper";
import LoggingBootstrap from "@/components/LoggingBootstrap";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeScript, ThemeScriptNoFlash } from "@/components/ThemeScript";
import "@radix-ui/themes/styles.css";
import { auth } from "auth";
import type { Metadata } from "next";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TuneTrees",
  description:
    "TuneTrees is an app make music repertoire practice more efficient, and the tunes better retained in long term memory.",
};

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
  const session: Session | null = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/jodit.min.css" />
        <ThemeScriptNoFlash />
      </head>
      <body className={`${inter.className} h-full`}>
        <ThemeScript />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider
            session={session}
            refetchOnWindowFocus={false}
            refetchWhenOffline={false}
          >
            <LoggingBootstrap />
            <ClientContextsWrapper>{children}</ClientContextsWrapper>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
