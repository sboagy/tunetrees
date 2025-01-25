import { Blockquote, Flex, Heading, Text } from "@radix-ui/themes";
import { auth } from "auth";
import { redirect } from "next/navigation";

export default async function index() {
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
  return redirect("/home");
}
