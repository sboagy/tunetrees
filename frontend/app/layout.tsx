import ClientContextsWrapper from "@/components/ClientContextsWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@radix-ui/themes/styles.css";
import { auth } from "auth"; // Import your auth function
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
      <body className={`${inter.className} h-full`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider session={session}>
            <ClientContextsWrapper>{children}</ClientContextsWrapper>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
