import { Blockquote, Flex, Heading, Text } from "@radix-ui/themes";
import { auth } from "auth";
import { redirect } from "next/navigation";

// NOTE: We preserve any existing query parameters (not just tt_sitdown) when redirecting
// an authenticated user from the root (/) to /home so that feature flags or
// dev/testing query overrides (e.g. ?tt_sitdown=2025-09-05) are not lost.
// If future logic adds additional root logic, ensure this redirect logic stays intact.
// Accept standard Next.js App Router searchParams shape (record of strings/arrays).
type TRawSearchParamsRoot = Record<string, string | string[] | undefined>;

export default async function index({
  searchParams,
}: {
  // Align with Next.js 15 PageProps constraint (Promise | undefined)
  searchParams?: Promise<TRawSearchParamsRoot>;
}) {
  const session = await auth();
  if (!session?.user) {
    return (
      <Flex gap="3" direction={"column"}>
        <Heading as="h1" style={{ fontSize: "2rem", marginBottom: "1rem" }}>
          Welcome to TuneTrees!
        </Heading>
        <Blockquote
          style={{
            fontStyle: "italic",
            marginBottom: "1rem",
            borderLeft: "4px solid #ccc",
            paddingLeft: "1rem",
          }}
        >
          <Text as="p" style={{ marginBottom: "0.5rem" }}>
            The “Tune is in the Tree —”
            <br />
            The Skeptic — showeth me —
            <br />
            “No Sir! In Thee!”
          </Text>
          <Text as="p" style={{ textAlign: "left", fontStyle: "normal" }}>
            -- Emily Dickinson, “To Hear an Oriole Sing”
          </Text>
        </Blockquote>
        <Text as="p" style={{ marginBottom: "1rem" }}>
          TuneTrees is an app for music practice, focusing on folk musicians. It
          assists with memorization of repertoire, training of musical
          instrument motor skills, and musical wiring of the brain.
        </Text>
        <Text as="p" style={{ marginBottom: "1rem" }}>
          TuneTrees uses a combination of techniques including spaced
          repetition, and mnemonic techniques. The idea is to make music
          practice more efficient, with better long term retention.
        </Text>
      </Flex>
    );
  }
  // Reconstruct query string (if any) and forward to /home.
  // searchParams is a Map-like (URLSearchParams) in Next 15 can be iterated via Object.entries after spread.
  let resolvedSearchParams: TRawSearchParamsRoot | undefined;
  if (searchParams) {
    try {
      resolvedSearchParams = await searchParams;
    } catch {
      resolvedSearchParams = undefined;
    }
  }
  if (resolvedSearchParams && Object.keys(resolvedSearchParams).length > 0) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) sp.append(key, v);
      } else {
        sp.set(key, value);
      }
    }
    const qs = sp.toString();
    return redirect(qs ? `/home?${qs}` : "/home");
  }
  return redirect("/home");
}
