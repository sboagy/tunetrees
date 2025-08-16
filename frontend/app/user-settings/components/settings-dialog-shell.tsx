"use client";

import { useCallback, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SidebarNav } from "./sidebar-nav";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import Link from "next/link";

interface ISettingsDialogShellProps {
  items: { title: string; href: string }[];
  children: React.ReactNode;
}

// Always-open dialog representing the user-settings surface. Closing navigates home.
export function SettingsDialogShell({
  items,
  children,
}: ISettingsDialogShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Derive whether we are exactly at /user-settings root for potential future logic.
  const isRoot = pathname === "/user-settings";
  void isRoot;

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
          handleClose();
        } else {
          setOpen(true);
        }
      }}
    >
      <DialogContent
        // Wider than default dialog; responsive full-screen on small devices
        className="w-full max-w-6xl md:max-h-[85vh] overflow-hidden p-0"
        hideCloseButton
        data-testid="user-settings-dialog"
      >
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-2 text-left">
            <div className="flex items-start justify-between">
              <div className="space-y-0.5 pr-4">
                <DialogTitle className="text-2xl">Settings</DialogTitle>
                <DialogDescription>
                  Manage your account settings and set scheduling preferences.
                </DialogDescription>
              </div>
              {/* Fallback Link for non-dialog navigation (e.g., no JS) */}
              <Link
                href="/"
                aria-label="Close settings and return to home"
                className="hidden"
              >
                Home
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8 shrink-0"
                data-testid="user-settings-close"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>
          <Separator />
          <div className="flex-1 flex flex-col lg:flex-row lg:space-x-8 overflow-hidden">
            <aside
              className="px-6 py-4 border-b lg:border-b-0 lg:border-r w-full lg:w-1/4 overflow-y-auto"
              data-testid="user-settings-sidebar"
            >
              <SidebarNav items={items} />
            </aside>
            <div
              className="flex-1 min-w-0 overflow-y-auto px-6 py-6"
              data-testid="user-settings-content"
            >
              {children}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
