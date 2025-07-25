"use client";

import { useState } from "react";
import { SMSLogin } from "@/components/SMSLogin";
import { PasskeyLogin } from "@/components/PasskeyLogin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AuthTestPage() {
  const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
  const { toast } = useToast();

  const handleAuthSuccess = (user: any) => {
    setAuthenticatedUser(user);
    toast({
      title: "Authentication Successful",
      description: `Welcome, ${user.name || user.email || "User"}!`,
    });
  };

  const handleLogout = () => {
    setAuthenticatedUser(null);
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully",
    });
  };

  if (authenticatedUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Successful</CardTitle>
            <CardDescription>
              You have successfully authenticated using the new authentication
              method.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p>
                <strong>ID:</strong> {authenticatedUser.id}
              </p>
              <p>
                <strong>Name:</strong> {authenticatedUser.name || "N/A"}
              </p>
              <p>
                <strong>Email:</strong> {authenticatedUser.email || "N/A"}
              </p>
              <p>
                <strong>Phone:</strong> {authenticatedUser.phone || "N/A"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex-1"
              >
                Logout
              </Button>
              <Link href="/" className="flex-1">
                <Button className="w-full">Go to App</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to TuneTrees
          </Link>
          <h1 className="text-3xl font-bold mt-4">Authentication Testing</h1>
          <p className="text-muted-foreground mt-2">
            Test the new SMS and Passkey authentication methods
          </p>
        </div>

        <Tabs defaultValue="sms" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sms">SMS Authentication</TabsTrigger>
            <TabsTrigger value="passkey">Passkey Authentication</TabsTrigger>
          </TabsList>

          <TabsContent value="sms" className="mt-6">
            <div className="flex justify-center">
              <SMSLogin onSuccess={handleAuthSuccess} />
            </div>
          </TabsContent>

          <TabsContent value="passkey" className="mt-6">
            <div className="flex justify-center">
              <PasskeyLogin onSuccess={handleAuthSuccess} />
            </div>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Testing Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold">SMS Authentication</h4>
              <p className="text-sm text-muted-foreground">
                In development mode, verification codes are logged to the
                backend console. Check the FastAPI logs for the 6-digit code
                after requesting SMS verification.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Passkey Authentication</h4>
              <p className="text-sm text-muted-foreground">
                Requires a browser that supports WebAuthn (most modern browsers)
                and a registered passkey. You'll need to register a passkey
                first through the user settings.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Prerequisites</h4>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Backend server running on port 8000</li>
                <li>User account with verified phone number (for SMS)</li>
                <li>Registered passkey (for WebAuthn)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
