"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, MessageSquare } from "lucide-react";

interface IUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
}

interface ISMSLoginProps {
  onSuccess?: (user: IUser) => void;
}

export function SmsLogin({ onSuccess }: ISMSLoginProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendCode = async () => {
    if (!phone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/sms/send-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: phone.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStep("code");
        toast({
          title: "Code Sent",
          description: "Verification code sent to your phone",
        });
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send verification code",
        });
      }
    } catch (error) {
      console.error("SMS send error:", error);
      toast({
        title: "Error",
        description: "Network error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter the verification code",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/sms/verify-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });

      const data = await response.json();

      if (response.ok && data) {
        toast({
          title: "Success",
          description: "Login successful!",
        });
        onSuccess?.(data);
      } else {
        toast({
          title: "Error",
          description: data.detail || "Invalid verification code",
        });
      }
    } catch (error) {
      console.error("SMS verification error:", error);
      toast({
        title: "Error",
        description: "Network error. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStep("phone");
    setCode("");
    setPhone("");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Smartphone className="h-6 w-6 text-blue-600" />
        </div>
        <CardTitle>SMS Login</CardTitle>
        <CardDescription>
          {step === "phone"
            ? "Enter your phone number to receive a verification code"
            : "Enter the verification code sent to your phone"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "phone" ? (
          <>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isLoading}
                data-testid="sms-phone-input"
              />
              <p className="text-xs text-gray-500">
                Enter your phone number with country code (e.g., +1234567890)
              </p>
            </div>
            <Button
              onClick={handleSendCode}
              disabled={isLoading || !phone.trim()}
              className="w-full"
              data-testid="sms-send-code-button"
            >
              {isLoading ? "Sending..." : "Send Code"}
              <MessageSquare className="ml-2 h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="code"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                maxLength={6}
                data-testid="sms-verification-code-input"
              />
              <p className="text-xs text-gray-500">Sent to {phone}</p>
            </div>
            <div className="space-y-2">
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || !code.trim()}
                className="w-full"
                data-testid="sms-verify-code-button"
              >
                {isLoading ? "Verifying..." : "Verify & Login"}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="w-full"
                disabled={isLoading}
                data-testid="sms-reset-button"
              >
                Use Different Number
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
