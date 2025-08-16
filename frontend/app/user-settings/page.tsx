import { redirect } from "next/navigation";

export default function SettingsIndexPage() {
  // Default to the Account section when visiting /user-settings
  redirect("/user-settings/scheduling-options");
}
