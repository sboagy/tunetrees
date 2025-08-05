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
import { SMSVerificationOption } from "@/components/auth/sms-verification-option";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Mail, Phone } from "lucide-react";
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
  const [selectedMethod, setSelectedMethod] = useState<"email" | "sms">(
    "email",
  );

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

      // Redirect to SMS password reset verification page
      window.location.href = `/auth/sms-password-reset?phone=${encodeURIComponent(
        phone,
      )}`;
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
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Reset Your Password</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose how you'd like to receive password reset instructions
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Method Selection Tabs */}
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={selectedMethod === "email" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSelectedMethod("email")}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </Button>
                <Button
                  type="button"
                  variant={selectedMethod === "sms" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSelectedMethod("sms")}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  SMS
                </Button>
              </div>

              {/* Email Reset Form */}
              {selectedMethod === "email" && (
                <Form {...form}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void form.handleSubmit(onEmailSubmit)();
                    }}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email address"
                              disabled={isLoading}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending..." : "Send Reset Email"}
                    </Button>
                  </form>
                </Form>
              )}

              {/* SMS Reset Form */}
              {selectedMethod === "sms" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Enter your phone number to receive a password reset code
                  </p>
                  <SMSVerificationOption
                    onVerificationSuccess={(phone) =>
                      void handleSMSReset(phone)
                    }
                    onError={handleError}
                    disabled={isLoading}
                    buttonText={isLoading ? "Sending..." : "Send Reset via SMS"}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
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

        {/* Back to Login Link */}
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
