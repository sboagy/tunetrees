"use client";

import { useSearchParams } from "next/navigation";
import type { JSX } from "react";

import Image from "next/image";

import { Button } from "@/components/ui/button";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { getCsrfToken } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type ControllerRenderProps, useForm } from "react-hook-form";

import {
  type AccountFormValues,
  accountFormSchema,
} from "@/app/auth/newuser/account-form";
import { providerMap } from "@/auth";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";
import { calculatePasswordStrength } from "@/lib/password-utils";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
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

  const [_crsfToken, setCrsfToken] = useState("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      email: email || "", // Ensure email has an initial value
      password: "", // Add initial value for password
      password_confirmation: "", // Add initial value for password_confirmation
      name: "", // Add initial value for name
      phone: "", // Add initial value for phone
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
  }

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordConfirmationError, setPasswordConfirmationError] = useState<
    string | null
  >(null);

  const validateEmail = useCallback((email: string): boolean => {
    if (email === "") {
      setEmailError(null);
      return false;
    }

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.issues[0].message);
      return false;
    }
    setEmailError(null);
    return true;
  }, []);

  useEffect(() => {
    validateEmail(form.getValues("email"));
  }, [form, validateEmail]);

  const handleEmailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "email">,
  ) => {
    const newEmail = e.target.value;
    console.log("handleEmailChange: email:", newEmail);
    field.onChange(e); // Update the form state
    validateEmail(newEmail);

    if (newEmail) {
      const user = await getUser(newEmail);
      if (user && user.emailVerified) {
        // Only show error for verified users - unverified users can be cleaned up during signup
        setEmailError("Email already in use");
      } else {
        // Clear any existing email error if user is unverified or doesn't exist
        setEmailError(null);
      }
    }
  };

  function check_password() {
    const pw = form.getValues("password");
    const pwc = form.getValues("password_confirmation");
    if (!pw || !pwc) {
      setPasswordError(null);
      setPasswordConfirmationError(null);
    } else if (pw === pwc) {
      setPasswordError(null);
      setPasswordConfirmationError(null);
    } else {
      setPasswordConfirmationError("Passwords do not match");
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

  const router = useRouter();

  // Memoize password strength calculation to prevent excessive re-renders
  const watchedPassword = form.watch("password") || "";
  const passwordStrength = useMemo(() => {
    return calculatePasswordStrength(watchedPassword);
  }, [watchedPassword]);

  const onSubmitHandler = async (data: AccountFormValues) => {
    console.log("onSubmit called with data:", data);

    setIsLoading(true);
    setEmailError(null);
    setPasswordError(null);
    setPasswordConfirmationError(null);

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
        if (typeof window !== "undefined") {
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
        // Redirect to SMS verification page
        router.push(
          `/auth/sms-signup-verification?email=${encodeURIComponent(
            data.email,
          )}&phone=${encodeURIComponent(data.phone)}`,
        );
      } else {
        // Redirect to email verification page
        router.push(`/auth/verify-request?email=${data.email}`);
      }
    } catch (error) {
      console.error("Signup error:", error);
      setEmailError("An error occurred during sign up. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
    <div className="flex items-center justify-center mb-0 mt-20">
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
        <CardHeader className="pt-1">
          <CardTitle className="flex justify-center">
            <Image
              src="/logo4.png"
              alt="Home"
              width={75}
              height={75}
              className="min-w-8"
              priority={true}
            />
          </CardTitle>
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
              className="space-y-6"
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
                    <FormLabel>EMail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="person@example.com"
                        {...field}
                        onChange={(e) => void handleEmailChange(e, field)}
                        required
                        className={emailError ? "border-red-500" : ""}
                        autoFocus
                        data-testid="user_email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {emailError && (
                <p className="text-red-500 text-sm" role="alert">
                  {emailError}
                </p>
              )}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
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
                      className="mt-2"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
              {passwordError && (
                <p className="text-red-500 text-sm" role="alert">
                  {passwordError}
                </p>
              )}
              <FormField
                control={form.control}
                name="password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
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
              {passwordConfirmationError && (
                <p className="text-red-500 text-sm" role="alert">
                  {passwordConfirmationError}
                </p>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
                    <FormLabel>Phone Number (Optional)</FormLabel>
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
                  !!emailError ||
                  !!passwordError ||
                  !!passwordConfirmationError ||
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
    </div>
  );
}
