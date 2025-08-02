"use client";

import { providerMap } from "@/auth";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { XCircle } from "lucide-react";
import { getCsrfToken, signIn } from "next-auth/react"; // Ensure getCsrfToken is imported
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { type ControllerRenderProps, useForm } from "react-hook-form";
import { emailSchema } from "../auth-types";
import { type LoginFormValues, loginFormSchema } from "./login-form";

export default function LoginDialog(): JSX.Element {
  const searchParams = useSearchParams();

  // Initialize userEmail state
  const [userEmail, setUserEmail] = useState<string>("");
  const [userEmailParam, setUserEmailParam] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch email from searchParams asynchronously
  useEffect(() => {
    const emailParam = searchParams.get("email") || "";
    console.log(
      "===> page.tsx:43 ~ LoginDialog useEffect emailParam: ",
      emailParam,
    );
    setUserEmail(emailParam);
    setUserEmailParam(emailParam);
    console.log("Extracted email from searchParams:", emailParam);
  }, [searchParams]);

  const [password, setPassword] = useState("");

  const [csrfToken, setCsrfToken] = useState("");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "", // Start with empty string
      password: "",
      csrfToken: "", // Initialize with empty string
    },
  });

  // Runs once after initial render: The effect runs only once, after the component has rendered for the first time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void (async () => {
      const token = await getCsrfToken();
      if (token) {
        setCsrfToken(token);
        form.setValue("csrfToken", token); // Update form's csrfToken value
      }
    })();
  }, []);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validateEmail = useCallback((email: string): boolean => {
    if (email === "") {
      // setEmailError("Email cannot be empty");
      setEmailError(null);
      setPasswordError(null);
      return false;
    }
    // TODO: implement token validation logic
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.issues[0].message);
      setPasswordError(null);
      return false;
    }
    setEmailError(null);
    setPasswordError(null);
    return true;
  }, []);

  useEffect(() => {
    validateEmail(userEmail);
  }, [userEmail, validateEmail]);

  // Update the form's email field when userEmail state changes
  useEffect(() => {
    console.log(
      "===> page.tsx:105 ~ LoginDialog useEffect (2) userEmail: ",
      userEmail,
    );
    form.setValue("email", userEmail);
  }, [userEmail, form]);

  const handleEmailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<LoginFormValues, "email">,
  ): Promise<void> => {
    const newEmail = e.target.value;
    console.log("handleEmailChange: email:", newEmail);
    field.onChange(e); // Update the form state
    setUserEmail(newEmail); // Update userEmail state
    validateEmail(newEmail);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  };

  const onSubmit = async (data: LoginFormValues) => {
    console.log("onSubmit called with data:", data);

    if (!validateEmail(userEmail)) {
      console.log("onSubmit - email validation failed");
      return;
    }

    setIsLoading(true);
    setPasswordError(null);

    try {
      console.log("Sign in attempt with:", {
        email: userEmail,
        password: data.password,
        csrfToken: data.csrfToken,
      });

      const result = await signIn("credentials", {
        redirect: false,
        email: userEmail,
        password: data.password,
        csrfToken: data.csrfToken,
      });

      if (result?.error) {
        // Given limitations of next-auth, such that we can't get the error instance
        // or error message, this is the best we can do for now.
        setPasswordError(`User login failed, error class: ${result.error}`);
      } else {
        console.log("Sign in successful");
        if (typeof window !== "undefined") {
          window.location.href = "/";
        } else {
          setPasswordError("Problem redirecting to home page");
          console.log("Login successful, but window is undefined");
        }
      }
    } catch (error) {
      setPasswordError(`${(error as Error).message}`);
      console.log(
        `User not found ===> page.tsx:149 ~ ${(error as Error).message}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // tune.deleted = true indicates this is a new tune, so it's
    // safe and proper to delete on cancel.
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-4">
        <Card className="w-full">
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
          <CardHeader className="space-y-1 pt-1">
            <div className="flex justify-center mb-4">
              <Image
                src="/logo4.png"
                alt="TuneTrees Logo"
                width={64}
                height={64}
                priority
              />
            </div>
            <CardTitle className="text-2xl text-center">Sign in</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <Form {...form}>
              <form
                onSubmit={(e) => {
                  void form.handleSubmit(onSubmit)(e);
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
                          value={csrfToken} // Use the state variable here
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          id="user_email"
                          name="user_email"
                          type="email"
                          placeholder="user@example.com"
                          value={userEmail}
                          onChange={(e) => void handleEmailChange(e, field)}
                          required
                          className={emailError ? "border-red-500" : ""}
                          autoFocus={userEmailParam === ""}
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
                        <Input
                          id="password"
                          name="password"
                          type="password"
                          value={password}
                          onChange={(e) => {
                            setPasswordError(null);
                            setPassword(e.target.value);
                            field.onChange(e);
                          }}
                          autoFocus={userEmailParam !== ""}
                          required
                          data-testid="user_password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm" role="alert">
                    {passwordError}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    asChild
                    className="p-0 h-auto text-sm text-primary hover:underline"
                  >
                    <a href="/auth/password-reset">Forgot password?</a>
                  </Button>
                </div>
                <LoadingButton
                  type="submit"
                  variant="secondary"
                  loading={isLoading}
                  disabled={
                    isLoading ||
                    !!emailError ||
                    !!passwordError ||
                    !password ||
                    !userEmail ||
                    !csrfToken // Add CSRF token check
                  }
                  className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
                  data-testid="login-submit-button"
                >
                  {isLoading ? "Signing In..." : "Sign In"}
                </LoadingButton>
              </form>
              {userEmailParam === "" && (
                <div className="flex gap-2 items-center ml-12 mr-12 mt-6 -mb-2">
                  <div className="flex-1 bg-neutral-300 dark:bg-neutral-600 h-[1px]" />
                  <span className="text-xs leading-4 uppercase text-neutral-500 dark:text-neutral-400">
                    or sign in with
                  </span>
                  <div className="flex-1 bg-neutral-300 dark:bg-neutral-600 h-[1px]" />
                </div>
              )}
            </Form>
          </CardContent>
          <CardFooter className="flex justify-between">
            {userEmailParam === "" && SocialLoginButtons(providerMap)}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
