import type { Metadata } from "next";
import { SettingsDialogShell } from "./components/settings-dialog-shell";

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
    <SettingsDialogShell items={sidebarNavItems}>
      {children}
    </SettingsDialogShell>
  );
}
