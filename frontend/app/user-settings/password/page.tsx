import { Separator } from "@/components/ui/separator";
import { AccountForm } from "../account/account-form";

export default function PasswordSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Password</h3>
        <p className="text-sm text-muted-foreground">Update your password.</p>
      </div>
      <Separator />
      <AccountForm showPassword showProfile={false} showPhone={false} />
    </div>
  );
}
