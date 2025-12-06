"use client";

import { Loader2, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface IUserData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  phone_verified?: boolean;
}

interface ISMSLoginProps {
  onSuccess?: (userData: IUserData) => void;
  onError?: (error: string) => void;
}

// Validates E.164 phone number format
const validatePhoneNumber = (phone: string): boolean => {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
};

// Formats phone number for display (e.g., +1234567890 -> +1 (234) 567-8900)
const formatPhoneForDisplay = (phone: string): string => {
  if (!phone.startsWith("+")) return phone;

  const digits = phone.slice(1);
  if (digits.length === 11 && digits[0] === "1") {
    // US/Canada number: +1234567890 -> +1 (234) 567-8900
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  // For other countries, just add spaces every 3 digits
  return `+${digits.replace(/(\d{3})/g, "$1 ").trim()}`;
};

export function SMSLogin({ onSuccess, onError }: ISMSLoginProps) {
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSendCode = async () => {
    if (!validatePhoneNumber(phone)) {
      setError(
        "Please enter a valid phone number in E.164 format (e.g., +1234567890)",
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sms/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone_number: phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification code");
      }

      setMessage("Verification code sent! Check your phone.");
      setStep("verify");
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to send code";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sms/verify-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone_number: phone,
          verification_code: code.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      // data already contains the parsed response, no need to parse again
      const userData: IUserData = data;
      setMessage("Phone verified successfully!");
      onSuccess?.(userData);
    } catch (error_) {
      const errorMessage =
        error_ instanceof Error ? error_.message : "Failed to verify code";
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPhone = () => {
    setStep("phone");
    setCode("");
    setError(null);
    setMessage(null);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {step === "phone" ? (
            <>
              <Phone className="h-5 w-5" />
              Enter Phone Number
            </>
          ) : (
            <>
              <MessageSquare className="h-5 w-5" />
              Verify Code
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "phone" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="font-mono"
                data-testid="sms-phone-input"
              />
              <p className="text-sm text-muted-foreground">
                Enter your phone number in international format (e.g.,
                +1234567890)
              </p>
            </div>
            <Button
              onClick={() => void handleSendCode()}
              disabled={isLoading || !phone.trim()}
              className="w-full"
              data-testid="sms-send-code-button"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </>
        )}

        {step === "verify" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-center text-lg tracking-widest"
                maxLength={6}
                data-testid="sms-verification-code-input"
              />
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {formatPhoneForDisplay(phone)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleBackToPhone}
                className="flex-1"
                data-testid="sms-back-button"
              >
                Back
              </Button>
              <Button
                onClick={() => void handleVerifyCode()}
                disabled={isLoading || !code.trim()}
                className="flex-1"
                data-testid="sms-verify-button"
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
            </div>
          </>
        )}

        {error && (
          <div className="p-3 rounded-md bg-destructive/15 border border-destructive/20">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {message && (
          <div className="p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200 font-medium">
              {message}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
