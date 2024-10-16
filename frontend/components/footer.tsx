import CustomLink from "./CustomLink";
import { Toaster } from "./ui/toaster";

export default function Footer() {
  return (
    <footer className="flex flex-col gap-4 px-4 my-4 mx-0 w-full text-sm sm:flex-row sm:justify-between sm:items-center sm:px-6 sm:my-12 sm:mx-auto sm:max-w-8xl sm:h-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* <CustomLink href="https://nextjs.authjs.dev">Documentation</CustomLink> */}
        {/* <CustomLink href="https://www.npmjs.com/package/next-auth">
          NPM
        </CustomLink> */}
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
      {/* <div className="flex gap-2 justify-start items-center">
        <img
          className="size-5"
          src="https://authjs.dev/img/logo-sm.png"
          alt="Auth.js Logo"
        />
        <CustomLink href="https://npmjs.org/package/next-auth">
          {packageJSON.version}
        </CustomLink>
      </div> */}
    </footer>
  );
}
