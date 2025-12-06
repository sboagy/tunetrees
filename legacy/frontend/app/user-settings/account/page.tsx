"use client";
import { useSession } from "next-auth/react";
import { Separator } from "@/components/ui/separator";
import { AccountForm } from "./account-form";

export default function SettingsAccountPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          Account Settings for user #{userId}
        </h3>
        <p className="text-sm text-muted-foreground">
          Update your account settings.
        </p>
      </div>
      <Separator />
      <AccountForm showProfile showPassword={false} showPhone={false} />
    </div>
  );
}
