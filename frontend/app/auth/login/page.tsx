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
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { type ControllerRenderProps, useForm } from "react-hook-form";
import { emailSchema } from "../auth-types";
import { type LoginFormValues, loginFormSchema } from "./login-form";
import { authorizeWithPassword } from "./validate-signin";

// ...existing code...

export default function LoginDialog(): JSX.Element {
  const searchParams = useSearchParams();

  // Initialize userEmail state
  const [userEmail, setUserEmail] = useState<string>("");
  const [userEmailParam, setUserEmailParam] = useState<string>("");

  // Fetch email from searchParams asynchronously
  useEffect(() => {
    const emailParam = searchParams.get("email") || "";
    setUserEmail(emailParam);
    setUserEmailParam(emailParam);
    console.log("Extracted email from searchParams:", emailParam);
  }, [searchParams]);

  const [password, setPassword] = useState("");

  const [_crsfToken, setCrsfToken] = useState("abcdef");
  console.log("SignInPage(): setCrsfToken:", setCrsfToken);

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

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "", // Start with empty string
      password: "",
      csrfToken: _crsfToken || "", // Add initial value for csrfToken if needed
      // csrfToken: "",
    },
  });

  // Update the form's email field when userEmail state changes
  useEffect(() => {
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
    // if (newEmail) {
    //   const user = await getUser(newEmail);
    //   if (!user) {
    //     setEmailError("User not found");
    //   } else {
    //     setEmailError(null);
    //   }
    // }
  };

  const onSubmit = async (data: LoginFormValues) => {
    console.log("onSubmit called with data:", data);
    if (validateEmail(userEmail)) {
      console.log("Sign in attempt with:", {
        email: userEmail,
        password: data.password,
        csrfToken: data.csrfToken,
      });
      try {
        const user = await authorizeWithPassword(userEmail, data.password);
        if (!user) {
          setPasswordError("Sign in failed");
        } else {
          console.log("Sign in successful");
          if (typeof window !== "undefined") {
            const response = await axios.get("/api/verify-user", {
              params: {
                email: userEmail,
                password: data.password,
              },
            });
            console.log("verify-user response:", response);
            if (response.status === 200) {
              window.location.href = "/";
            } else {
              setPasswordError(response.statusText);
              console.log("Could not sign in user");
            }
          } else {
            setPasswordError("Problem redirecting to home page");
            console.log("Sign in successful, but window is undefined");
          }
        }
      } catch (error) {
        setPasswordError(`${(error as Error).message}`);
        console.log(
          `User not found ===> page.tsx:149 ~ ${(error as Error).message}`,
        );
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-4">
        <Card className="w-full">
          <CardHeader className="space-y-1">
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
                  defaultValue={_crsfToken}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="csrfToken"
                          type="hidden"
                          {...field}
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
                          placeholder="person@example.com"
                          value={userEmail}
                          onChange={(e) => void handleEmailChange(e, field)}
                          required
                          className={emailError ? "border-red-500" : ""}
                          autoFocus={userEmailParam === ""}
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
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={
                    !!emailError ||
                    !!passwordError ||
                    !password ||
                    !form.getValues("email")
                  }
                  className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
                >
                  Sign In
                </Button>
              </form>
              {userEmailParam === "" && (
                <div className="flex gap-2 items-center ml-12 mr-12 mt-6 -mb-2">
                  <div className="flex-1 bg-neutral-300 h-[1px]" />
                  <span className="text-xs leading-4 uppercase text-neutral-500">
                    or sign in with
                  </span>
                  <div className="flex-1 bg-neutral-300 h-[1px]" />
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
