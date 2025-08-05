"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function SmsSignupVerificationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";

  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // First verify the SMS code
      const verifyResponse = await fetch("/api/sms/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          code: verificationCode,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.detail || "Invalid verification code");
      }

      // Then complete the SMS signup verification
      const signupResponse = await fetch("/api/auth/verify-sms-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          phone: phone,
        }),
      });

      if (!signupResponse.ok) {
        const error = await signupResponse.json();
        throw new Error(
          error.error || "Failed to complete account verification",
        );
      }

      toast({
        title: "Success!",
        description:
          "Your account has been verified via SMS. You can now sign in.",
      });

      // Redirect to login page with email pre-filled
      router.push(`/auth/login?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error("SMS verification error:", error);
      toast({
        title: "Verification Failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);

    try {
      const response = await fetch("/api/sms/send-verification-signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to resend verification code");
      }

      toast({
        title: "Code Sent",
        description: "A new verification code has been sent to your phone.",
      });
    } catch (error) {
      console.error("Resend error:", error);
      toast({
        title: "Resend Failed",
        description:
          error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  if (!email || !phone) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Invalid verification link. Please try signing up again.
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => router.push("/auth/newuser")}
            >
              Back to Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center">
            Verify Your Phone Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              We've sent a 6-digit verification code to{" "}
              <span className="font-medium">{phone}</span>
            </p>

            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-4"
            >
              <div>
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  disabled={isLoading}
                  data-testid="sms-verification-code-input"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || verificationCode.length !== 6}
                data-testid="sms-verification-submit-button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Phone Number"
                )}
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="link"
                onClick={() => {
                  void handleResendCode();
                }}
                disabled={isResending}
                className="text-sm"
                data-testid="sms-verification-resend-button"
              >
                {isResending ? "Sending..." : "Resend Code"}
              </Button>
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                onClick={() => router.push("/auth/newuser")}
                className="text-sm"
              >
                Back to Sign Up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
