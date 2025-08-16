import type { Metadata } from "next";
import Image from "next/image";

import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./components/sidebar-nav";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export const metadata: Metadata = {
  title: "Forms",
  description: "Advanced form example using react-hook-form and Zod.",
};

const sidebarNavItems = [
  // {
  //   title: "Profile",
  //   href: "/user-settings",
  // },
  {
    title: "Scheduling Options",
    href: "/user-settings/scheduling-options",
  },
  {
    title: "Spaced Repetition",
    href: "/user-settings/spaced-repetition",
  },
  {
    title: "Account",
    href: "/user-settings/account",
  },
  {
    title: "Password",
    href: "/user-settings/password",
  },
  {
    title: "Phone",
    href: "/user-settings/phone",
  },
];

interface ISettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: ISettingsLayoutProps) {
  return (
    <>
      <div className="md:hidden">
        <Image
          src="/examples/forms-light.png"
          width={1280}
          height={791}
          alt="Forms"
          className="block dark:hidden"
        />
        <Image
          src="/examples/forms-dark.png"
          width={1280}
          height={791}
          alt="Forms"
          className="hidden dark:block"
        />
      </div>
      <div className="hidden space-y-6 p-10 pb-16 md:block relative">
        <div className="absolute top-6 right-6">
          <Link href="/" aria-label="Close settings and return to home">
            <Button
              variant="ghost"
              size="icon"
              data-testid="user-settings-close"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </Link>
        </div>
        <div className="space-y-0.5">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account settings and set scheduling preferences.
          </p>
        </div>
        <Separator className="my-6" />
        <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
          <aside className="mx-2 lg:w-1/5">
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className="flex-1 lg:max-w-2xl">{children}</div>
        </div>
      </div>
    </>
  );
}
