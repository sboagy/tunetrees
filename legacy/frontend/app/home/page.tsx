"use server";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import MainPanel from "../(main)/pages/practice/components/MainPanel";
import { buildSitdownBootstrap } from "../(main)/pages/practice/sitdown-bootstrap";
import type React from "react";

type TRawSearchParamsHome = Record<string, string | string[] | undefined>;

const HomePage = async ({
  searchParams,
}: {
  // Next.js 15: promise form allowed
  searchParams?: Promise<TRawSearchParamsHome>;
}) => {
  // console.log("In the HomePage function");
  const session: Session | null = await auth();

  if (!session) {
    // console.log("No session found (HomePage)");
    redirect("/");
  }

  if (!session?.user) {
    console.log("No user found (HomePage)");
    redirect("/");
  }

  // console.log("Session found! (HomePage)");

  const userId = session?.user?.id ? Number.parseInt(session?.user?.id) : 1;

  // Resolve searchParams for tt_sitdown bootstrap
  let resolvedSearchParams: TRawSearchParamsHome | undefined;
  if (searchParams) {
    try {
      resolvedSearchParams = await searchParams;
    } catch {
      resolvedSearchParams = undefined;
    }
  }
  const rawSitdownParam = resolvedSearchParams?.tt_sitdown;
  let sitdownBootstrapScript: React.ReactNode = null;
  if (typeof rawSitdownParam === "string" && rawSitdownParam.length > 0) {
    let js = buildSitdownBootstrap(rawSitdownParam);
    // Escape closing tag just in case
    js = js.replace(/<\/script>/gi, "<\\/script>");
    sitdownBootstrapScript = (
      <script data-tt="sitdown-bootstrap-home">{js}</script>
    );
  }
  return (
    <>
      {sitdownBootstrapScript}
      <MainPanel userId={userId} />
    </>
  );
};

export default HomePage;
