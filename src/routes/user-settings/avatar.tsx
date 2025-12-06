/**
 * Avatar Settings Page
 *
 * Allows users to select or upload their profile avatar
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarPicker } from "@/components/user-settings/AvatarPicker";

export default function AvatarSettings() {
  return (
    <div class="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Avatar</CardTitle>
          <CardDescription>
            Choose a predefined avatar or upload your own custom image
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarPicker />
        </CardContent>
      </Card>
    </div>
  );
}
