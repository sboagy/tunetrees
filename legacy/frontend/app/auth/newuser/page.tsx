"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getCsrfToken, signIn } from "next-auth/react";
import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ControllerRenderProps, useForm } from "react-hook-form";
import {
  type AccountFormValues,
  accountFormSchema,
} from "@/app/auth/newuser/account-form";
import { providerMap } from "@/auth";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
import { EmailVerificationDialog } from "@/components/auth/email-verification-dialog";
import { SmsVerificationDialog } from "@/components/auth/sms-verification-dialog";
import { PasswordInput } from "@/components/PasswordInput";
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
import { LoadingButton } from "@/components/ui/loading-button";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { calculatePasswordStrength } from "@/lib/password-utils";
import { emailSchema } from "../auth-types";
import { getUser } from "../login/validate-signin";
import { newUser } from "./newuser-actions";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const languages = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Spanish", value: "es" },
  { label: "Portuguese", value: "pt" },
  { label: "Russian", value: "ru" },
  { label: "Japanese", value: "ja" },
  { label: "Korean", value: "ko" },
  { label: "Chinese", value: "zh" },
] as const;

export default function SignInPage(): JSX.Element {
  const searchParams = useSearchParams();
  let email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";
  const name = searchParams.get("name") || "";

  const [_crsfToken, setCrsfToken] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // SMS verification dialog state
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsEmail, setSmsEmail] = useState("");

  // Email verification dialog state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailForVerification, setEmailForVerification] = useState("");

  // Track if user creation is in progress to prevent duplicates
  const [userCreationInProgress, setUserCreationInProgress] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      email: email || "", // Ensure email has an initial value
      password: "", // Add initial value for password
      password_confirmation: "", // Add initial value for password_confirmation
      name: name || "", // Add initial value for name from URL params
      phone: phone || "", // Add initial value for phone from URL params
      csrfToken: "", // Initialize with empty string
    },
  });

  // Runs once after initial render: The effect runs only once, after the component has rendered for the first time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void (async () => {
      const token = await getCsrfToken();
      if (token) {
        setCrsfToken(token);
        form.setValue("csrfToken", token); // Update form's csrfToken value
      }
    })();
  }, []);

  if (email === "" && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get("email") || email;
    const phoneParam = searchParams.get("phone") || "";
    const nameParam = searchParams.get("name") || "";

    if (phoneParam && !form.getValues("phone")) {
      form.setValue("phone", phoneParam);
    }
    if (nameParam && !form.getValues("name")) {
      form.setValue("name", nameParam);
    }
  }

  // Using React Hook Form's built-in error handling instead of separate state

  const validateEmail = useCallback(
    (email: string): boolean => {
      if (email === "") {
        form.clearErrors("email");
        return false;
      }

      const result = emailSchema.safeParse(email);
      if (!result.success) {
        form.setError("email", {
          type: "manual",
          message: result.error.issues[0].message,
        });
        return false;
      }
      form.clearErrors("email");
      return true;
    },
    [form],
  );

  useEffect(() => {
    validateEmail(form.getValues("email"));
  }, [form, validateEmail]);

  // Update form values when URL parameters change (e.g., coming back from SMS verification)
  useEffect(() => {
    const emailParam = searchParams.get("email");
    const phoneParam = searchParams.get("phone");
    const nameParam = searchParams.get("name");

    if (emailParam && emailParam !== form.getValues("email")) {
      form.setValue("email", emailParam);
    }
    if (phoneParam && phoneParam !== form.getValues("phone")) {
      form.setValue("phone", phoneParam);
    }
    if (nameParam && nameParam !== form.getValues("name")) {
      form.setValue("name", nameParam);
    }
  }, [searchParams, form]);

  const handleEmailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "email">,
  ) => {
    const newEmail = e.target.value;
    console.log("handleEmailChange: email:", newEmail);
    field.onChange(e); // Update the form state

    // First validate the email format
    const isValidFormat = validateEmail(newEmail);

    // Only check for existing users if the email format is valid
    if (newEmail && isValidFormat) {
      const user = await getUser(newEmail);
      if (user?.emailVerified) {
        // Only show error for verified users - unverified users can be cleaned up during signup
        form.setError("email", {
          type: "manual",
          message: "Email already in use",
        });
      } else {
        // Clear any existing "email already in use" error if user is unverified or doesn't exist
        // Don't clear format validation errors here
        const currentError = form.getFieldState("email").error;
        if (currentError?.message === "Email already in use") {
          form.clearErrors("email");
        }
      }
    }
  };

  function check_password() {
    const pw = form.getValues("password");
    const pwc = form.getValues("password_confirmation");
    if (!pw || !pwc) {
      form.clearErrors(["password", "password_confirmation"]);
    } else if (pw === pwc) {
      form.clearErrors(["password", "password_confirmation"]);
    } else {
      form.setError("password_confirmation", {
        type: "manual",
        message: "Passwords do not match",
      });
    }
  }

  const handlePasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "password">,
  ) => {
    console.log("handlePasswordChange: password:", e.target.value);
    field.onChange(e); // Update the form state
    check_password();
    void form.trigger("password");
  };

  const handlePasswordConfirmationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "password_confirmation">,
  ) => {
    console.log(
      "handlePasswordConfirmationChange: password_confirmation:",
      e.target.value,
    );
    field.onChange(e); // Update the form state
    check_password();
  };

  const handleUserNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "name">,
  ) => {
    console.log("handleUserNameChange: name:", e.target.value);
    field.onChange(e); // Update the form state
  };

  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "phone">,
  ) => {
    console.log("handlePhoneChange: phone:", e.target.value);
    field.onChange(e); // Update the form state
  };

  // Memoize password strength calculation to prevent excessive re-renders
  const watchedPassword = form.watch("password") || "";
  const passwordStrength = useMemo(() => {
    return calculatePasswordStrength(watchedPassword);
  }, [watchedPassword]);

  const onSubmitHandler = async (data: AccountFormValues) => {
    console.log("onSubmit called with data:", data);

    // Prevent duplicate submissions if user creation is already in progress
    if (userCreationInProgress) {
      console.log(
        "User creation already in progress, ignoring duplicate submission",
      );
      return;
    }

    setIsLoading(true);
    setUserCreationInProgress(true);
    form.clearErrors(); // Clear all form errors before submit

    try {
      const host = window.location.host;

      const result = await newUser(data, host);
      console.log(`newUser status result ${result.status}`);
      console.log(`newUser linkBackURL result ${result.linkBackURL}`);
      console.log(
        `NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION value: ${process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION}`,
      );

      if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
        const linkBackURL = result.linkBackURL;
        console.log(`Setting linkBackURL in localStorage: ${linkBackURL}`);
        // Store the linkBackURL in local storage for testing purposes
        if (typeof window !== "undefined" && linkBackURL) {
          localStorage.setItem("linkBackURL", linkBackURL);
          console.log("Successfully stored linkBackURL in localStorage");
          // Verify it was stored
          const stored = localStorage.getItem("linkBackURL");
          console.log(`Verification - retrieved from localStorage: ${stored}`);
        } else {
          console.log(
            "onSubmit(): window is undefined, cannot store linkBackURL for playwright tests",
          );
        }
      } else {
        console.log(
          `NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION is not "true", it is: ${process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION}`,
        );
      }

      // Check if SMS verification is required
      if (result.smsVerificationRequired && result.phone && data.phone) {
        // Show SMS verification dialog instead of navigating away
        setSmsEmail(data.email);
        setSmsPhone(data.phone);
        setShowSmsDialog(true);
      } else {
        // Show email verification dialog instead of redirecting
        setEmailForVerification(data.email);
        setShowEmailDialog(true);
      }
    } catch (error) {
      console.error("Signup error:", error);
      form.setError("email", {
        type: "manual",
        message: "An error occurred during sign up. Please try again.",
      });
    } finally {
      setIsLoading(false);
      // Don't reset userCreationInProgress here - only reset when dialog is properly closed
    }
  };

  const handleSmsVerificationComplete = () => {
    console.log("=== SMS VERIFICATION COMPLETE ===");
    console.log("About to auto-login user with email:", smsEmail);

    // SMS verification completed successfully
    // Reset the creation in progress flag since verification is done
    setUserCreationInProgress(false);
    // Ensure dialog is closed first
    setShowSmsDialog(false);

    // Use async function within the handler
    void (async () => {
      try {
        // Get the password from the form
        const userPassword = form.getValues("password");

        console.log("Auto-signing in user with:", {
          email: smsEmail,
          hasPassword: !!userPassword,
          hasCsrfToken: !!_crsfToken,
        });

        // Automatically sign in the user since SMS verification is complete
        const result = await signIn("credentials", {
          redirect: false,
          email: smsEmail,
          password: userPassword,
          csrfToken: _crsfToken,
        });

        if (result?.error) {
          console.error(
            "Auto-signin failed after SMS verification:",
            result.error,
          );
          // Fallback to login page if auto-signin fails
          if (typeof window !== "undefined") {
            window.location.href = `/auth/login?email=${encodeURIComponent(smsEmail)}`;
          }
        } else {
          console.log("Auto-signin successful! Redirecting to home page...");
          // Success! Redirect to main application
          if (typeof window !== "undefined") {
            window.location.href = "/";
          } else {
            console.error("Window is undefined, cannot navigate");
          }
        }
      } catch (error) {
        console.error("Auto-signin error after SMS verification:", error);
        // Fallback to login page if there's an error
        if (typeof window !== "undefined") {
          window.location.href = `/auth/login?email=${encodeURIComponent(smsEmail)}`;
        } else {
          console.error("Window is undefined, cannot navigate");
        }
      }
    })();
  };

  const handleEmailVerificationComplete = () => {
    console.log("=== EMAIL VERIFICATION COMPLETE ===");
    console.log("About to auto-login user with email:", emailForVerification);

    // Email verification completed successfully
    // Reset the creation in progress flag since verification is done
    setUserCreationInProgress(false);
    // Ensure dialog is closed first
    setShowEmailDialog(false);

    // Use async function within the handler
    void (async () => {
      try {
        // Get the password from the form
        const userPassword = form.getValues("password");

        console.log("Auto-signing in user with:", {
          email: emailForVerification,
          hasPassword: !!userPassword,
          hasCsrfToken: !!_crsfToken,
        });

        // Automatically sign in the user since email verification is complete
        const result = await signIn("credentials", {
          redirect: false,
          email: emailForVerification,
          password: userPassword,
          csrfToken: _crsfToken,
        });

        if (result?.error) {
          console.error(
            "Auto-signin failed after email verification:",
            result.error,
          );
          // Fallback to login page if auto-signin fails
          if (typeof window !== "undefined") {
            window.location.href = `/auth/login?email=${encodeURIComponent(emailForVerification)}`;
          }
        } else {
          console.log("Auto-signin successful! Redirecting to home page...");
          // Success! Redirect to main application
          if (typeof window !== "undefined") {
            window.location.href = "/";
          } else {
            console.error("Window is undefined, cannot navigate");
          }
        }
      } catch (error) {
        console.error("Auto-signin error after email verification:", error);
        // Fallback to login page if there's an error
        if (typeof window !== "undefined") {
          window.location.href = `/auth/login?email=${encodeURIComponent(emailForVerification)}`;
        } else {
          console.error("Window is undefined, cannot navigate");
        }
      }
    })();
  };

  const handleEmailDialogClose = (open: boolean) => {
    if (!open && emailForVerification) {
      // Dialog is being closed - clean up unverified user if verification wasn't completed
      console.log(
        "Email dialog closed, cleaning up unverified user:",
        emailForVerification,
      );

      // Use async function within the handler to avoid Promise return type
      void (async () => {
        try {
          // Call cleanup endpoint to remove unverified user
          const response = await fetch("/api/auth/cleanup-unverified-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: emailForVerification }),
          });

          if (response.ok) {
            console.log("Successfully cleaned up unverified user");
            // Only reset state after successful cleanup
            setUserCreationInProgress(false);
          } else {
            console.warn(
              "Failed to clean up unverified user:",
              await response.text(),
            );
            // Reset state anyway so user isn't permanently blocked
            setUserCreationInProgress(false);
          }
        } catch (error) {
          console.error("Error cleaning up unverified user:", error);
          // Reset state anyway so user isn't permanently blocked
          setUserCreationInProgress(false);
        }
      })();
    }

    setShowEmailDialog(open);
  };

  const handleSmsDialogClose = (open: boolean) => {
    if (!open && smsPhone) {
      // Dialog is being closed - clean up unverified user if verification wasn't completed
      console.log("SMS dialog closed, cleaning up unverified user:", smsPhone);

      // Use async function within the handler to avoid Promise return type
      void (async () => {
        try {
          // Call cleanup endpoint to remove unverified user
          const response = await fetch("/api/auth/cleanup-unverified-user", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: smsEmail }),
          });

          if (response.ok) {
            console.log("Successfully cleaned up unverified user");
            // Only reset state after successful cleanup
            setUserCreationInProgress(false);
          } else {
            console.warn(
              "Failed to clean up unverified user:",
              await response.text(),
            );
            // Reset state anyway so user isn't permanently blocked
            setUserCreationInProgress(false);
          }
        } catch (error) {
          console.error("Error cleaning up unverified user:", error);
          // Reset state anyway so user isn't permanently blocked
          setUserCreationInProgress(false);
        }
      })();
    }

    setShowSmsDialog(open);
  };

  console.log("SignInPage(): csrfToken: %s", _crsfToken);

  const handleCancel = () => {
    // tune.deleted = true indicates this is a new tune, so it's
    // safe and proper to delete on cancel.
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex items-center justify-center mb-0 mt-12">
      <Card className="w-[24em]">
        <div className="flex justify-end space-x-2 mt-2 mr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              handleCancel();
            }}
            aria-label="Cancel edits"
            className="p-0 h-auto cursor-pointer"
            title="Cancel edits"
            data-testid="tt-tune-editor-cancel-button"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
        <CardHeader className="pt-1 pb-4">
          <CardTitle className="text-2xl text-center">Sign up</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(e) => {
                e.preventDefault(); // Prevent default form submission behavior
                console.log("Form submitted"); // Debugging log
                console.log("Before calling form.handleSubmit"); // Debugging log
                void form.handleSubmit((data) => {
                  console.log(
                    "Inside form.handleSubmit callback with data:",
                    data,
                  );
                  void onSubmitHandler(data);
                })(e);
                console.log("After calling form.handleSubmit"); // Debugging log
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="csrfToken"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="csrfToken"
                        type="hidden"
                        {...field}
                        value={_crsfToken} // Use the state variable here
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">EMail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="person@example.com"
                        {...field}
                        onChange={(e) => void handleEmailChange(e, field)}
                        required
                        autoFocus
                        data-testid="user_email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="password"
                        placeholder="password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(e) => handlePasswordChange(e, field)}
                        data-testid="user_password"
                      />
                    </FormControl>
                    {/* Real-time password strength indicator */}
                    <PasswordStrengthIndicator
                      password={form.watch("password") || ""}
                      className="mt-3"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <PasswordInput
                        id="password_confirmation"
                        placeholder="repeat password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(e) =>
                          handlePasswordConfirmationChange(e, field)
                        }
                        data-testid="user_password_verification"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        {...field}
                        onChange={(e) => handleUserNameChange(e, field)}
                        data-testid="user_name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Phone Number (Optional, for SMS verification)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        {...field}
                        onChange={(e) => handlePhoneChange(e, field)}
                        data-testid="user_phone"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <LoadingButton
                type="submit"
                variant="secondary"
                loading={isLoading}
                disabled={
                  isLoading ||
                  !form.getValues("password") ||
                  !form.getValues("password_confirmation") ||
                  !form.getValues("email") ||
                  !form.getValues("name") ||
                  Object.keys(form.formState.errors).length > 0 ||
                  passwordStrength.level === "weak"
                }
                className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
                data-testid="signup-submit-button"
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </LoadingButton>
            </form>
            <div className="flex gap-2 items-center ml-12 mr-12 mt-6 -mb-2">
              <div className="flex-1 bg-neutral-300 dark:bg-neutral-600 h-[1px]" />
              <span className="text-xs leading-4 uppercase text-neutral-500 dark:text-neutral-400">
                or sign up with
              </span>
              <div className="flex-1 bg-neutral-300 dark:bg-neutral-600 h-[1px]" />
            </div>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-between">
          {SocialLoginButtons(providerMap)}
        </CardFooter>
      </Card>

      {/* SMS Verification Dialog */}
      <SmsVerificationDialog
        open={showSmsDialog}
        onOpenChange={handleSmsDialogClose}
        phone={smsPhone}
        email={smsEmail}
        onVerificationComplete={handleSmsVerificationComplete}
      />

      {/* Email Verification Dialog */}
      <EmailVerificationDialog
        open={showEmailDialog}
        onOpenChange={handleEmailDialogClose}
        email={emailForVerification}
        onVerificationComplete={handleEmailVerificationComplete}
      />
    </div>
  );
}
