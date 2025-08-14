"use client";
import { useSession } from "next-auth/react";
import { Avatar, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

import { ChevronDownIcon } from "lucide-react";
import {
  DemoUser,
  NewUser,
  SignIn,
  SignOut,
  UserSettingsMenuItem,
} from "./AuthComponents";
import styles from "./Header.module.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ModeToggle } from "./ui/mode-toggle";

export default function UserButton() {
  // console.log("here in the user button");
  // debugger

  const { data: session } = useSession();
  // Removed debug logging for production
  // if (!session) {
  //   console.log("No session found (UserButton)");
  // } else {
  //   console.log("Session found (UserButton)");
  // }
  // if (!session?.user) {
  //   console.log("No user found in session (UserButton)");

  if (!session?.user) {
    // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
    // const csrfToken = cookies().get("authjs.csrf-token")?.value ?? "";
    return (
      <div className="flex gap-2 items-center">
        <SignIn />
        {/* <span className="text-muted-foreground">or</span> */}
        <NewUser />
        {/* <span className="text-muted-foreground">or</span> */}
        <DemoUser />
        <ModeToggle />
        {/* <ThemePanel /> */}
      </div>
    );
  }
  // console.log("Session found! (UserButton)");
  const unknownUserNameString = "";
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger className={`${styles.headerMenuTrigger}`} asChild>
          <Button
            variant="ghost"
            className={`${styles.dropDownMenuTriggerInnerButton}`}
            data-testid="tt-user-menu-trigger"
          >
            <div className="flex items-center space-x-3 ">
              <span className="hidden text-sm sm:inline-flex">
                {session.user.email}
              </span>
              <Avatar className="w-8 h-8">
                <AvatarImage
                  src="/avatars/flute.png"
                  alt={session.user.name ?? ""}
                />
                {/* <AvatarImage
                src={
                  session.user.image ??
                  "https://source.boringavatars.com/marble/120"
                }
                alt={session.user.name ?? ""}
              /> */}
              </Avatar>
              <ChevronDownIcon
                className={`${styles.dropDownMenuChevronDown}`}
              />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(() => {
            if (session.user.name && session.user.name !== "None") {
              return (
                <>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session.user.name
                          ? session.user.name === "None"
                            ? unknownUserNameString
                            : session.user.name
                          : unknownUserNameString}
                      </p>
                      {/* <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p> */}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              );
            }
            return null;
          })()}
          <DropdownMenuItem className="h-8">
            <UserSettingsMenuItem />
          </DropdownMenuItem>
          {/* <DropdownMenuSeparator className="my-2 border-t border-dark-gray-200" /> */}
          <DropdownMenuItem className="h-8">
            <SignOut />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ModeToggle />
    </div>
  );
}
