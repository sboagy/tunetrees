import { Avatar, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { auth } from "auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { DemoUser, NewUser, SignIn, SignOut } from "./auth-components";
import { ModeToggle } from "./ui/mode-toggle";

export default async function UserButton() {
  console.log("here in the user button");
  // debugger
  const session = await auth();
  if (!session?.user) {
    ("use server");
    // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
    // const csrfToken = cookies().get("authjs.csrf-token")?.value ?? "";
    return (
      <div className="flex gap-2 items-center">
        <SignIn />
        <NewUser />
        <DemoUser />
        <ModeToggle />
      </div>
    );
  }
  return (
    <div className="flex gap-2 items-center">
      <span className="hidden text-sm sm:inline-flex">
        {session.user.email}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative w-8 h-8 rounded-full">
            <Avatar className="w-8 h-8">
              <AvatarImage
                src={
                  session.user.image ??
                  "https://source.boringavatars.com/marble/120"
                }
                alt={session.user.name ?? ""}
              />
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {session.user.name}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {session.user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuItem>
            <SignOut />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ModeToggle />
    </div>
  );
}
