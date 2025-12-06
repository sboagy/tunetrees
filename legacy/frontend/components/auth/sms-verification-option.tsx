"use client";

import { Loader2, MessageSquare, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ISMSVerificationOptionProps {
  onVerificationSuccess?: (phone: string) => void;
  onError?: (error: string) => void;
  buttonText?: string;
  description?: string;
  disabled?: boolean;
  isSignup?: boolean; // Whether this is for signup verification or existing user
  initialPhone?: string; // Pre-fill phone number
  userEmail?: string; // User email for existing user phone verification
}

// Validates E.164 phone number format
const validatePhoneNumber = (phone: string): boolean => {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
};

// Formats phone number for display (e.g., +1234567890 -> +1 (234) 567-8900)
const formatPhoneForDisplay = (phone: string): string => {
  console.log("formatPhoneForDisplay input:", phone);
  if (!phone.startsWith("+")) return phone;

  const digits = phone.slice(1);
  console.log(
    "formatPhoneForDisplay digits:",
    digits,
    "length:",
    digits.length,
  );

  if (digits.length === 11 && digits[0] === "1") {
    // US/Canada number: +15084794800 -> +1 (508) 479-4800
    const formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    console.log("formatPhoneForDisplay US format result:", formatted);
    return formatted;
  }

  if (digits.length === 10 && digits[0] === "1") {
    // US/Canada number missing leading 1: +1508479480 -> +1 (508) 479-480 (truncated)
    const formatted = `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    console.log("formatPhoneForDisplay truncated US format result:", formatted);
    return formatted;
  }

  // For other countries or malformed numbers, return as-is with minimal formatting
  if (digits.length <= 4) {
    return phone; // Too short to format meaningfully
  }

  // Just return the original phone number for now to avoid mangling
  console.log("formatPhoneForDisplay returning original:", phone);
  return phone;
};

export function SMSVerificationOption({
  onVerificationSuccess,
  onError,
  buttonText = "Verify via SMS",
  description = "Enter your phone number to receive a verification code",
  disabled = false,
  isSignup = false,
  initialPhone = "",
  userEmail = "",
}: ISMSVerificationOptionProps) {
  // If initialPhone is provided and valid, start with "send" step, otherwise "phone"
  const [step, setStep] = useState<"phone" | "send" | "verify">(
    initialPhone && validatePhoneNumber(initialPhone) ? "send" : "phone",
  );
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Update phone state when initialPhone changes
  useEffect(() => {
    console.log(
      "SMSVerificationOption: initialPhone changed to:",
      initialPhone,
    );
    setPhone(initialPhone);
    // Update step based on phone validity
    if (initialPhone && validatePhoneNumber(initialPhone)) {
      setStep("send");
    } else {
      setStep("phone");
    }
  }, [initialPhone]);

  // Remove auto-send functionality - let user manually trigger verification

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
      // Use user-specific endpoint for existing users with email
      const isUserPhoneVerification = !isSignup && userEmail;
      const endpoint = isUserPhoneVerification
        ? "/api/sms/send-verification-user-phone"
        : "/api/sms/send-verification";

      const requestBody = isUserPhoneVerification
        ? { user_email: userEmail, phone: phone }
        : { phone: phone, isSignup };

      console.log("SMS: Sending request to:", endpoint);
      console.log("SMS: Request body:", requestBody);
      console.log("SMS: Phone number being sent:", phone);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("SMS: Response status:", response.status);
      console.log("SMS: Response data:", data);

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
      // Use user-specific endpoint for existing users with email
      const isUserPhoneVerification = !isSignup && userEmail;
      const endpoint = isUserPhoneVerification
        ? "/api/sms/verify-user-phone"
        : "/api/sms/verify-code";

      const requestBody = isUserPhoneVerification
        ? { user_email: userEmail, phone: phone, code: code.trim() }
        : { phone: phone, code: code.trim() };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      setMessage("Phone verified successfully!");
      onVerificationSuccess?.(phone);
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
    setStep("send"); // Go back to send step instead of phone if we have initialPhone
    setCode("");
    setError(null);
    setMessage(null);
  };

  if (step === "phone") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sms-phone">Phone Number</Label>
          <Input
            id="sms-phone"
            type="tel"
            placeholder="+1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="font-mono"
            disabled={disabled || isLoading}
            data-testid="sms-phone-input"
          />
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

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

        <Button
          onClick={() => void handleSendCode()}
          disabled={disabled || isLoading || !phone.trim()}
          className="w-full"
          variant="outline"
          data-testid="sms-send-code-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              {buttonText}
            </>
          )}
        </Button>
      </div>
    );
  }

  // Send step - shows just the send button without phone input (for pre-populated phone)
  if (step === "send") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {description} We'll send it to {formatPhoneForDisplay(phone)}
          </p>
        </div>

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

        <Button
          onClick={() => void handleSendCode()}
          disabled={disabled || isLoading || !validatePhoneNumber(phone)}
          className="w-full"
          data-testid="sms-send-code-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Phone className="mr-2 h-4 w-4" />
              {buttonText}
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sms-code">Verification Code</Label>
        <Input
          id="sms-code"
          type="text"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono text-center text-lg tracking-widest"
          maxLength={6}
          disabled={disabled || isLoading}
          data-testid="sms-verification-code-input"
        />
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to {formatPhoneForDisplay(phone)}
        </p>
      </div>

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

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={handleBackToPhone}
          className="flex-1"
          disabled={disabled || isLoading}
          data-testid="sms-reset-button"
        >
          Back
        </Button>
        <Button
          onClick={() => void handleVerifyCode()}
          disabled={disabled || isLoading || !code.trim()}
          className="flex-1"
          data-testid="sms-verify-code-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <MessageSquare className="mr-2 h-4 w-4" />
              Verify Code
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
