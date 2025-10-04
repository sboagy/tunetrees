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
  // Simpler approach: rely on CSS calc to constrain height within viewport minus header/footer allowance.
  // Adjust the rem values if outer layout header/footer heights change.

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
        // Anchor near top; horizontally centered, adjustable height. (Revised bottom margin reduction.)
        className="max-w-6xl w-[calc(100%-2rem)] sm:w-full overflow-hidden p-0 top-8 left-1/2 -translate-x-1/2 translate-y-0 h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] max-h-[calc(100vh-7rem)] md:max-h-[calc(100vh-8rem)] flex flex-col"
        hideCloseButton
        data-testid="user-settings-dialog"
      >
        <div className="flex flex-col h-full min-h-0">
          <DialogHeader className="px-5 pt-4 pb-1 text-left">
            <div className="flex items-start justify-between">
              <div className="space-y-0 pr-3">
                <DialogTitle className="text-2xl leading-snug">
                  Settings
                </DialogTitle>
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
          <div className="flex-1 flex flex-col lg:flex-row lg:space-x-6 overflow-hidden min-h-0">
            <aside
              className="px-5 py-3 border-b lg:border-b-0 lg:border-r w-full lg:w-1/4 overflow-y-auto"
              data-testid="user-settings-sidebar"
            >
              <SidebarNav items={items} />
            </aside>
            {/* Scroll container ensures header remains fixed while form/content scroll within available height */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden min-h-0">
              <div
                className="flex-1 overflow-y-auto px-5 py-4"
                data-testid="user-settings-content"
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
