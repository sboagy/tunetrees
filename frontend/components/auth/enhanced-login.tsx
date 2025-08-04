"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SMSLogin } from "@/components/auth/sms-login";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
import { providerMap } from "@/auth";
import { Mail, Phone, Users, Loader2 } from "lucide-react";

interface IUserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phone_verified?: boolean;
}

export default function EnhancedLoginPage() {
  const [email, setEmail] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSMSSuccess = (userData: IUserData) => {
    // Redirect directly since SMS verification is complete
    void signIn("sms", {
      phone: userData.phone,
      code: "verified", // Since we already verified the code
      redirect: true,
      callbackUrl: "/dashboard",
    });
  };

  const handleSMSError = (error: string) => {
    console.error("SMS authentication error:", error);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    setIsEmailLoading(true);
    setEmailError(null);
    setEmailMessage(null);

    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setEmailError("Failed to send verification email. Please try again.");
      } else {
        setEmailMessage("Check your email for a verification link!");
      }
    } catch (error) {
      setEmailError("An unexpected error occurred. Please try again.");
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Sign in to TuneTrees
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Choose your preferred sign-in method
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="social" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="social" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Social
              </TabsTrigger>
              <TabsTrigger value="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                SMS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="social" className="space-y-4">
              <div className="space-y-3">{SocialLoginButtons(providerMap)}</div>
            </TabsContent>

            <TabsContent value="email" className="space-y-4">
              <form
                onSubmit={(e) => void handleEmailSubmit(e)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(null);
                    }}
                    disabled={isEmailLoading}
                    required
                    data-testid="email-login-input"
                  />
                </div>

                {emailError && (
                  <div className="p-3 rounded-md bg-destructive/15 border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">
                      {emailError}
                    </p>
                  </div>
                )}

                {emailMessage && (
                  <div className="p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                    <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                      {emailMessage}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isEmailLoading}
                  data-testid="email-login-submit"
                >
                  {isEmailLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Verification Email
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="sms" className="space-y-4">
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter your phone number to receive a verification code
                  </p>
                </div>
                <SMSLogin
                  onSuccess={handleSMSSuccess}
                  onError={handleSMSError}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6">
            <Separator />
            <p className="text-xs text-center text-muted-foreground mt-4">
              By signing in, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
