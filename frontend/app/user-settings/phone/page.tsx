import { Separator } from "@/components/ui/separator";
import { AccountForm } from "../account/account-form";

export default function PhoneSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Phone</h3>
        <p className="text-sm text-muted-foreground">
          Manage your phone number and SMS verification.
        </p>
      </div>
      <Separator />
      <AccountForm showPhone showProfile={false} showPassword={false} />
    </div>
  );
}
