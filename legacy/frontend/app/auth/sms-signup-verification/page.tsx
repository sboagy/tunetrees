"use client";

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { Loader2, MessageSquare } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SmsSignupVerificationPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";
  const name = searchParams.get("name") || "";

  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
          // Note: verification code was already validated by /api/sms/verify-code above
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

  const handleBackToSignup = () => {
    // Build the signup URL with preserved form values
    const signupUrl = new URL("/auth/newuser", window.location.origin);
    if (email) signupUrl.searchParams.set("email", email);
    if (phone) signupUrl.searchParams.set("phone", phone);
    if (name) signupUrl.searchParams.set("name", name);

    router.push(signupUrl.toString());
  };

  if (!email || !phone) {
    return (
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Invalid verification link
          </h1>
          <p className="text-sm text-muted-foreground">
            Please try signing up again.
          </p>
        </div>
        <Button onClick={() => router.push("/auth/newuser")}>
          Back to Sign Up
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
      <div className="flex flex-col space-y-2 text-center">
        <MessageSquare className="mx-auto h-6 w-6" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your SMS message
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification code to {phone}
        </p>
      </div>

      <div className="grid gap-6">
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={(value) => setVerificationCode(value)}
                id="verificationCode"
                name="verificationCode"
                pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                data-testid="sms-verification-code-input"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              data-testid="sms-verification-submit-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>
          </div>
        </form>

        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void handleResendCode();
            }}
            disabled={isResending}
            className="mr-2"
            data-testid="sms-verification-resend-button"
          >
            {isResending ? "Sending..." : "Resend Code"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleBackToSignup}>
            Back to Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
}
