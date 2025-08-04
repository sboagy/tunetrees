"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { VerificationMethodSelector } from "@/components/auth/verification-method-selector";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

// Schema for password reset request
const passwordResetRequestSchema = z.object({
  email: z.string().email("Invalid email"),
});

type PasswordResetRequestValues = z.infer<typeof passwordResetRequestSchema>;

export default function PasswordResetPage(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<PasswordResetRequestValues>({
    resolver: zodResolver(passwordResetRequestSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
    },
  });

  const onEmailSubmit = async (data: PasswordResetRequestValues) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send reset email");
      }

      setSuccessMessage(
        "If an account with that email exists, we've sent you a password reset link.",
      );
      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "An error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailMethod = () => {
    void onEmailSubmit(form.getValues());
  };

  const handleSMSReset = async (phone: string) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/password-reset-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send reset code");
      }

      setSuccessMessage(
        "If an account with that phone number exists, we've sent you a password reset code.",
      );
      setIsSuccess(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "An error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
  };

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Mail className="mx-auto h-12 w-12 text-green-600" />
            <CardTitle className="mt-4 text-2xl font-bold text-gray-900">
              Check your messages
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">{successMessage}</p>
            <p className="mt-2 text-sm text-gray-500">
              The reset code will expire in 1 hour.
            </p>
          </CardContent>
          <CardFooter>
            <Link href="/auth/login" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-4">
        <VerificationMethodSelector
          title="Reset Your Password"
          description="Choose how you'd like to receive password reset instructions"
          emailButtonText="Send Reset Email"
          smsButtonText="Send Reset via SMS"
          smsDescription="Enter your phone number to receive a password reset code"
          onEmailMethod={handleEmailMethod}
          onSMSVerified={(phone) => void handleSMSReset(phone)}
          onError={handleError}
          emailDisabled={isLoading}
          smsDisabled={isLoading}
          showSMS={true}
        />

        {errorMessage && (
          <Card className="border-red-200">
            <CardContent className="pt-6">
              <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {errorMessage}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleEmailMethod();
                }}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Or enter email directly:</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/auth/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
