"use client";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { Mail, Smartphone, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import type { JSX } from "react";
import { useState } from "react";
import { SMSVerificationOption } from "@/components/auth/sms-verification-option";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function VerifyRequest(): JSX.Element {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const { toast } = useToast();
  const [showAlternativeVerification, setShowAlternativeVerification] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    // Check if user came from login page via referrer or go to home
    const referrer = document.referrer;
    if (referrer?.includes("/auth/login")) {
      router.push("/auth/login");
    } else {
      router.push("/");
    }
  };

  const handleOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = (e.target as HTMLFormElement).verificationCode.value;
    console.log("Submitted verification code:", code);

    // Use the email from searchParams instead of URL parameters
    if (email) {
      fetch(`/api/verify-user?email=${encodeURIComponent(email)}&token=${code}`)
        .then((response) => {
          if (response?.ok && response?.statusText === "OK") {
            console.log("Verification successful");
            router.push("/");
            router.refresh();
            return;
          }
          throw new Error(`Verification failed: ${response.statusText}`);
        })
        .catch((error) => {
          console.error("Error verifying code:", error);
          setErrorMessage(
            "Verification failed. Please try again or use SMS verification.",
          );
        });
    } else {
      console.error("Email parameter is missing from the URL");
    }
  };

  const handleResendEmail = async () => {
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setErrorMessage(null);
        toast({
          title: "Verification Email Sent",
          description: "Check your inbox for a new verification code.",
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resend email");
      }
    } catch (error) {
      console.error("Failed to resend email:", error);
      setErrorMessage(
        `Failed to resend email: ${error instanceof Error ? error.message : "Unknown error"}. Please try SMS verification below.`,
      );
    }
  };

  const handleSMSVerification = (phone: string) => {
    // After SMS verification, we need to link the phone to the existing user account
    // and mark the account as verified
    console.log("SMS verification successful for phone:", phone);

    // Complete the account verification via SMS
    fetch("/api/auth/verify-sms-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, phone }),
    })
      .then(async (response) => {
        if (response.ok) {
          console.log("Account verified via SMS");
          // Sign the user in after successful verification
          const result = await signIn("credentials", {
            email,
            smsVerified: "true", // Flag to indicate SMS verification
            redirect: false,
          });
          if (result?.ok) {
            router.push("/");
            router.refresh();
          } else {
            console.error(
              "Failed to sign in after verification:",
              result?.error,
            );
            setErrorMessage(
              "Account verified but sign-in failed. Please try logging in manually.",
            );
          }
        } else {
          throw new Error("Failed to complete SMS verification");
        }
      })
      .catch((error) => {
        console.error("SMS verification completion failed:", error);
        setErrorMessage("SMS verification failed. Please contact support.");
      });
  };

  const handleVerificationError = (error: string) => {
    setErrorMessage(error);
  };

  return (
    <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
      {/* Close button in upper right */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="h-8 w-8"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col space-y-2 text-center">
        <Mail className="mx-auto h-6 w-6" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to {email}
        </p>
      </div>

      {!showAlternativeVerification ? (
        <div className="grid gap-6">
          <form onSubmit={handleOnSubmit}>
            <div className="grid gap-2">
              <div className="grid gap-1">
                <Label htmlFor="verificationCode">Verification Code</Label>
                <InputOTP
                  maxLength={6}
                  id="verificationCode"
                  name="verificationCode"
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
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
              <Button type="submit">Verify Email</Button>
            </div>
          </form>

          {errorMessage && (
            <div className="text-sm text-red-600 text-center">
              {errorMessage}
            </div>
          )}

          <div className="text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                handleResendEmail().catch((error) => {
                  console.error("Failed to resend email:", error);
                });
              }}
              className="mr-2"
            >
              Resend Email
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlternativeVerification(true)}
            >
              Use SMS Instead
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-col space-y-2 text-center">
            <Smartphone className="mx-auto h-6 w-6" />
            <h2 className="text-xl font-semibold tracking-tight">
              Verify by SMS
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your phone number to receive a verification code
            </p>
          </div>

          <SMSVerificationOption
            onVerificationSuccess={handleSMSVerification}
            onError={handleVerificationError}
            buttonText="Verify Account"
            description="We'll send a verification code to your phone"
            isSignup={true}
          />

          {errorMessage && (
            <div className="text-sm text-red-600 text-center">
              {errorMessage}
            </div>
          )}

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlternativeVerification(false)}
            >
              Back to Email Verification
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
