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

interface ISMSLoginProps {
  onSuccess?: (user: any) => void;
}

export function SMSLogin({ onSuccess }: ISMSLoginProps) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendCode = async () => {
    if (!phone) {
      toast({
        title: "Error",
        description: "Please enter a phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/sms/send-verification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      if (response.ok) {
        setStep("code");
        toast({
          title: "Code Sent",
          description: "Verification code sent to your phone",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Failed to send verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code) {
      toast({
        title: "Error",
        description: "Please enter the verification code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, code }),
      });

      if (response.ok) {
        const user = await response.json();
        toast({
          title: "Success",
          description: "Successfully authenticated with SMS",
        });
        onSuccess?.(user);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("phone");
    setCode("");
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          SMS Authentication
        </CardTitle>
        <CardDescription>
          {step === "phone"
            ? "Enter your phone number to receive a verification code"
            : "Enter the verification code sent to your phone"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === "phone" ? (
          <>
            <Input
              type="tel"
              placeholder="+1234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <Button
              onClick={sendCode}
              disabled={loading || !phone}
              className="w-full"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              {loading ? "Sending..." : "Send Code"}
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              Code sent to {phone}
            </div>
            <Input
              type="text"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={loading}
              maxLength={6}
            />
            <div className="flex gap-2">
              <Button
                onClick={verifyCode}
                disabled={loading || !code}
                className="flex-1"
              >
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <Button variant="outline" onClick={reset} disabled={loading}>
                Back
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
