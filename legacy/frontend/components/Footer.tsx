"use client";
import CustomLink from "./CustomLink";
import { Toaster } from "./ui/toaster";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";
import { useState } from "react";

export default function Footer() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <footer>
      <Collapsible.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        className={isOpen ? "" : "h-4"}
      >
        <div className="flex items-center  space-x-4">
          <Collapsible.Trigger asChild>
            <span className="ml-6">
              {isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </span>
          </Collapsible.Trigger>
          <Collapsible.Content className="collapsible-content">
            {/* <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:whitespace-nowrap sm:overflow-x-clip"> */}
            <div className="flex-col whitespace-nowrap space-x-4">
              <CustomLink href="https://github.com/sboagy/tunetrees/blob/main/docs/core-proposal.md">
                Whitepaper
              </CustomLink>
              <CustomLink href="https://github.com/sboagy/tunetrees">
                Source on GitHub
              </CustomLink>
              <CustomLink href="https://github.com/sboagy/tunetrees/blob/main/docs/sr_readme.md">
                Spaced Repetition Terminology
              </CustomLink>
              <CustomLink href="mailto:sboag@tunetrees.com">Contact</CustomLink>
              <CustomLink href="/policy">Policy</CustomLink>
              <Toaster />
            </div>
          </Collapsible.Content>
        </div>
      </Collapsible.Root>
    </footer>
  );
}
