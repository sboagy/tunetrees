"use client";

import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";

interface IEmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onVerificationComplete: () => void;
}

export function EmailVerificationDialog({
  open,
  onOpenChange,
  email,
  onVerificationComplete,
}: IEmailVerificationDialogProps) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setErrorMessage("Please enter the verification code");
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/api/verify-user?email=${encodeURIComponent(email)}&token=${verificationCode.trim()}`,
      );

      if (response?.ok) {
        console.log("Email verification successful");
        // Close dialog first
        onOpenChange(false);
        // Small delay to ensure dialog cleanup
        setTimeout(() => {
          onVerificationComplete();
        }, 100);
      } else {
        throw new Error(
          `Verification failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      console.error("Email verification error:", error);
      setErrorMessage(
        "Verification failed. Please check your code and try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        toast({
          title: "Verification Email Sent",
          description: "Check your inbox for a new verification code.",
        });
        setVerificationCode(""); // Clear the input
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resend email");
      }
    } catch (error) {
      console.error("Failed to resend email:", error);
      setErrorMessage(
        `Failed to resend email: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogPortal>
        <DialogOverlay className="bg-black/50 fixed inset-0" />
        <DialogContent className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
            <DialogTitle className="text-center">Check your email</DialogTitle>
            <DialogDescription className="text-center">
              We sent a verification code to{" "}
              <span className="font-medium">{email}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="verification-code"
                className="text-sm font-medium"
              >
                Verification Code
              </label>
              <InputOTP
                maxLength={6}
                value={verificationCode}
                onChange={setVerificationCode}
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

            {errorMessage && (
              <p className="text-sm text-red-600 text-center" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => void handleVerifyCode()}
                disabled={isVerifying || verificationCode.length !== 6}
                className="w-full"
              >
                {isVerifying ? "Verifying..." : "Verify"}
              </Button>

              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleResendEmail()}
                  disabled={isResending}
                >
                  {isResending ? "Sending..." : "Resend verification email"}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <p className="text-xs text-muted-foreground text-center w-full">
              Didn't receive the email? Check your spam folder or try the resend
              option above.
            </p>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
