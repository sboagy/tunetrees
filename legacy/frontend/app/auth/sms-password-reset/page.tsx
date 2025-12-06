"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { useToast } from "@/hooks/use-toast";
import {
  calculatePasswordStrength,
  isPasswordValid,
} from "@/lib/password-utils";

export default function SmsPasswordResetPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const phone = searchParams.get("phone") || "";

  const [step, setStep] = useState<"verify" | "reset">("verify");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const passwordStrength = calculatePasswordStrength(newPassword);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-sms-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone,
          code: verificationCode,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Invalid verification code");
      }

      const result = await response.json();

      // Extract reset token from the message
      const tokenMatch = result.message.match(
        /Use token (\d+) to reset password/,
      );
      if (tokenMatch) {
        setResetToken(tokenMatch[1]);
        setStep("reset");
        toast({
          title: "Code Verified",
          description: "Please enter your new password.",
        });
      } else {
        throw new Error("Reset token not found in response");
      }
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (!isPasswordValid(newPassword)) {
      toast({
        title: "Weak Password",
        description: "Password must meet security requirements.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: resetToken,
          password: newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset password");
      }

      toast({
        title: "Password Reset Successful",
        description:
          "Your password has been updated. Please sign in with your new password.",
      });

      router.push("/auth/login");
    } catch (error) {
      console.error("Password reset error:", error);
      toast({
        title: "Reset Failed",
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
      const response = await fetch("/api/auth/password-reset-sms", {
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
        throw new Error(error.error || "Failed to resend verification code");
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

  if (!phone) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Invalid password reset link. Please try the reset process again.
            </p>
            <Button
              className="w-full mt-4"
              onClick={() => router.push("/auth/password-reset")}
            >
              Back to Password Reset
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
            {step === "verify" ? "Verify SMS Code" : "Reset Your Password"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === "verify" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                We've sent a 6-digit verification code to{" "}
                <span className="font-medium">{phone}</span>
              </p>

              <form
                onSubmit={(e) => {
                  void handleVerifyCode(e);
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
                    data-testid="sms-password-reset-code-input"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || verificationCode.length !== 6}
                  data-testid="sms-password-reset-verify-button"
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
              </form>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => {
                    void handleResendCode();
                  }}
                  disabled={isResending}
                  className="text-sm"
                  data-testid="sms-password-reset-resend-button"
                >
                  {isResending ? "Sending..." : "Resend Code"}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/auth/password-reset")}
                  className="text-sm"
                >
                  Back to Password Reset
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Enter your new password below
              </p>

              <form
                onSubmit={(e) => {
                  void handlePasswordReset(e);
                }}
                className="space-y-4"
              >
                <div>
                  <PasswordInput
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    data-testid="sms-password-reset-new-password"
                  />
                  <PasswordStrengthIndicator
                    password={newPassword}
                    className="mt-2"
                  />
                </div>

                <div>
                  <PasswordInput
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    data-testid="sms-password-reset-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isLoading ||
                    !newPassword ||
                    !confirmPassword ||
                    newPassword !== confirmPassword ||
                    passwordStrength.level === "weak"
                  }
                  data-testid="sms-password-reset-submit-button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
