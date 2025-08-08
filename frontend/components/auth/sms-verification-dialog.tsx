"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageSquare } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";

interface ISmsVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  email: string;
  onVerificationComplete: () => void;
}

export function SmsVerificationDialog({
  open,
  onOpenChange,
  phone,
  email,
  onVerificationComplete,
}: ISmsVerificationDialogProps) {
  const { toast } = useToast();
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Single-step verification: validate SMS code and complete account verification
      const response = await fetch("/api/sms/verify-signup-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          phone: phone,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.error || "Verification failed");
      }

      toast({
        title: "Success!",
        description:
          "Your account has been verified via SMS. You can now sign in.",
      });

      // Close dialog first, then navigate after cleanup
      onOpenChange(false);

      // Use setTimeout to ensure dialog cleanup completes before navigation
      setTimeout(() => {
        onVerificationComplete();
      }, 100);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full dark:bg-blue-900/20">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-center">
            Check your SMS message
          </DialogTitle>
          <DialogDescription className="text-center">
            We sent a verification code to {phone}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-6"
        >
          <div className="space-y-2">
            <Label htmlFor="verificationCode" className="text-center block">
              Verification Code
            </Label>
            <div className="flex justify-center">
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
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full"
              data-testid="sms-verification-submit-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>

            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleResendCode();
                }}
                disabled={isResending}
                data-testid="sms-verification-resend-button"
              >
                {isResending ? "Sending..." : "Resend Code"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                data-testid="sms-verification-cancel-button"
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
