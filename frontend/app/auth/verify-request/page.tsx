"use client";
import type { JSX } from "react";
import Head from "next/head";
import { useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { useRouter } from "next/navigation"; // Use the next/navigation module for client-side navigation
import { useSearchParams } from "next/navigation";

export default function VerifyRequest(): JSX.Element {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleOnSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = (e.target as HTMLFormElement).verificationCode.value;
    console.log("Submitted verification code:", code);

    if (!email) {
      setError("Email parameter is missing from the URL");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/verify-user?email=${encodeURIComponent(email)}&token=${code}`,
      );

      if (response?.ok && response?.statusText === "OK") {
        console.log("Verification successful");
        router.push("/");
        router.refresh();
        return;
      }

      throw new Error(`Verification failed: ${response.statusText}`);
    } catch (error) {
      console.error("Error verifying code:", error);
      setError("Verification failed. Please check your code and try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Head>
        <title>Verify Your Request</title>
      </Head>
      <div className="w-full max-w-md p-4">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Check Your Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to your email address.
              </p>
              <p className="text-sm text-muted-foreground">
                Please enter the 6-digit verification code below:
              </p>
            </div>

            <form
              onSubmit={(e) => {
                void handleOnSubmit(e);
              }}
              className="space-y-6"
            >
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  id="verificationCode"
                  name="verificationCode"
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                  disabled={isLoading}
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

              {error && (
                <p className="text-red-500 text-sm text-center" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="secondary"
                loading={isLoading}
                loadingText="Verifying..."
                disabled={isLoading}
                className="w-full"
              >
                Submit Code
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
