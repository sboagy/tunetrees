import { Blockquote, Flex, Heading, Text } from "@radix-ui/themes";
import { auth } from "auth";
import { redirect } from "next/navigation";

export default async function index() {
  const session = await auth();
  // The right way to do the signin check for the main pannel is probably via middleware?
  // See https://next-auth.js.org/tutorials/securing-pages-and-api-routes#nextjs-middleware
  // But I'm a bit confused about what route to protect given the components.  Need to learn more.
  if (!session?.user) {
    return (
      // Isn't there some sort of paragraph style thing, instead of using Flex?
      <Flex gap="3" direction={"column"}>
        <Heading as="h1">Welcome to TuneTrees!</Heading>

        <Blockquote>
          <i>
            The “Tune is in the Tree —”
            <br />
            The Skeptic — showeth me —<br />
            “No Sir! In Thee!” <br />
          </i>
          -- Emily Dickinson, “To Hear an Oriole Sing”
        </Blockquote>

        <Text as="p">
          TuneTrees is an app for music practice, focusing on folk musicians. It
          assists with memorization of repertoire, training of musical
          instrument motor skills, and musical wiring of the brain.
        </Text>

        <Blockquote>
          <i>
            In contrast to related literature which models the memory as a
            sequence of historical states, we model the memory as a recursive
            tree structure. This structure more effectively captures temporal
            dependencies across both short and long term time periods through
            its hierarchical structure.{" "}
          </i>
          <br />
          -- Tree Memory Networks for Modelling Long-term Temporal Dependencies,
          Tharindu Fernandoa, Simon Denmana, Aaron McFadyenb, Sridha Sridharana,
          Clinton Fookes
        </Blockquote>

        <Text as="p">
          TuneTrees uses a combination of techniques including spaced
          repetition, mnemonics, and spacial/navigational techniques. The idea
          is to make music practice more efficient, with better long term
          retention.
        </Text>
      </Flex>
    );
  }
  return redirect("/home");
}
