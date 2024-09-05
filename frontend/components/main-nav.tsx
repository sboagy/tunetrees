"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import Image from "next/image";
import profilePic from "/public/logo4.png";

import CustomLink from "./custom-link";
import { Button } from "./ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "./ui/navigation-menu";

export function MainNav() {
  return (
    <div className="flex items-center py-4">
      <CustomLink href="/">
        <Button variant="ghost" className="h-16 py-2 mt-1">
          <Image
            src={profilePic}
            alt="Home"
            width="52"
            height="52"
            className="items-center py-0"
            priority={true}
          />
        </Button>
      </CustomLink>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger className="px-2">
              TuneTrees
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                <ListItem href="/server-example" title="Blah">
                  Blah blah blah
                </ListItem>
                <ListItem href="/middleware-example" title="Yada">
                  Yada yada yada
                </ListItem>
                <ListItem href="/api-example" title="What">
                  Whatever
                </ListItem>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          {/* <NavigationMenuItem>
            <NavigationMenuLink
              href="/client-example"
              className={navigationMenuTriggerStyle()}
            >
              Client Side
            </NavigationMenuLink>
          </NavigationMenuItem> */}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground opacity-100">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
