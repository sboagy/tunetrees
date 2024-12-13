"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import axios from "axios";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Controller,
  type ControllerRenderProps,
  useForm,
} from "react-hook-form";
import { emailSchema } from "../auth-types";
import { type LoginFormValues, loginFormSchema } from "../login/login-form";
import { authorizeWithPassword, getUser } from "./validate-signin"; // Import getUser function

export default function LoginDialog(): JSX.Element {
  const searchParams = useSearchParams();

  // Initialize userEmail state
  const [userEmail, setUserEmail] = useState<string>("");

  const [_crsfToken, setCrsfToken] = useState("abcdef");
  console.log("SignInPage(): setCrsfToken:", setCrsfToken);

  // Fetch email from searchParams asynchronously
  useEffect(() => {
    const emailParam = searchParams.get("email") || "";
    setUserEmail(emailParam);
    console.log("Extracted email from searchParams:", emailParam);
  }, [searchParams]);

  const [password, setPassword] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validateEmail = useCallback((email: string): boolean => {
    // TODO: implement token validation logic
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.issues[0].message);
      return false;
    }
    setEmailError(null);
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
    },
  });

  // Update the form's email field when userEmail state changes
  useEffect(() => {
    form.setValue("email", userEmail);
  }, [userEmail, form]);

  const handleEmailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<LoginFormValues, "email">,
  ) => {
    const newEmail = e.target.value;
    console.log("handleEmailChange: email:", newEmail);
    field.onChange(e); // Update the form state
    setUserEmail(newEmail); // Update userEmail state
    validateEmail(newEmail);

    if (newEmail) {
      const user = await getUser(newEmail);
      if (!user) {
        setEmailError("User not found");
      } else {
        setEmailError(null);
      }
    }
  };

  const onSubmitOnInvalid = async (
    errors: object,
    // e?: Event,
  ): Promise<void> => {
    console.log("onSubmitInvalid called with errors:", errors);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  const onSubmitHandler = async (data: LoginFormValues): Promise<void> => {
    console.log("onSubmit called with data:", data);
    if (validateEmail(userEmail)) {
      console.log("Sign in attempt with:", {
        user_email: userEmail,
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
        console.error((error as Error).message);
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
                alt="Company Logo"
                width={64}
                height={64}
                priority
              />
            </div>
            <CardTitle className="text-2xl text-center">Sign in</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                form
                  .handleSubmit(onSubmitHandler, onSubmitOnInvalid)()
                  .then(() => {
                    console.log("Form submitted");
                  })
                  .catch((error) => {
                    console.error("Form submission error:", error);
                  });
              }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="user_email">Email</Label>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="user_email"
                      name="user_email"
                      type="email"
                      placeholder="m@example.com"
                      value={userEmail}
                      onChange={(e) => void handleEmailChange(e, field)}
                      required
                      className={emailError ? "border-red-500" : ""}
                    />
                  )}
                />
                {emailError && (
                  <p className="text-red-500 text-sm" role="alert">
                    {emailError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        field.onChange(e);
                      }}
                      autoFocus
                      required
                    />
                  )}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm" role="alert">
                    {passwordError}
                  </p>
                )}
              </div>
              <Controller
                name="csrfToken"
                control={form.control}
                render={({ field }) => (
                  <Input
                    type="hidden"
                    value={csrfToken}
                    onChange={(e) => {
                      setCsrfToken(e.target.value);
                      field.onChange(e);
                    }}
                  />
                )}
              />
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
          </CardContent>
          <CardFooter>
            {/* <Button
                className="w-full"
                type="submit"
                onClick={void handleSubmit}
                disabled={!!emailError}
                variant="outline"
              >
                Sign In
              </Button> */}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
