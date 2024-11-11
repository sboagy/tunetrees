"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import type { JSX } from "react";
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
import Image from "next/image";
import { authorizeWithPassword } from "./validate-signin";
import axios from "axios";
import { emailSchema } from "../auth-types";

// export default function LoginDialog({ email = "" }: ILoginDialogProps) {
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export default function LoginDialog(props: any): JSX.Element {
  let email = props.searchParams.email || "";
  if (email === "" && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get("email") || email;
  }

  const [userEmail, setUserEmail] = useState(email);
  const [password, setPassword] = useState("");
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
    validateEmail(email);
  }, [email, validateEmail]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setUserEmail(newEmail);
    validateEmail(newEmail);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateEmail(userEmail)) {
      // Handle login logic here
      console.log("Sign in attempt with:", { user_email: userEmail, password });
      try {
        // const user = authorizeWithPassword(user_email, password);
        const user = await authorizeWithPassword(userEmail, password);
        if (!user) {
          setPasswordError("Sign in failed");
        } else {
          console.log("Sign in successful");
          // Redirect to the home page
          if (typeof window !== "undefined") {
            const response = await axios.get("/api/verify-user", {
              params: {
                email: userEmail,
                password: password,
              },
            });
            console.log("verify-user response:", response);
            if (response.status === 200) {
              // Redirect to the home page
              window.location.href = "/";
            } else {
              setPasswordError(response.statusText);
              console.log("Could not sign in user");
            }
          } else {
            // Hopefully this never happens??
            setPasswordError("Problem redirecting to home page");
            console.log("Sign in successful, but window is undefined");
          }
        }
      } catch (error) {
        setPasswordError(`${(error as Error).message}`);
        console.error((error as Error).message);
      }

      // TODO: Implement password check and authorization logic, then redirect
      // to the to the home page.
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
            <form onSubmit={void handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="user_email">Email</Label>
                <Input
                  id="user_email"
                  name="user_email"
                  type="email"
                  placeholder="m@example.com"
                  value={userEmail}
                  onChange={handleEmailChange}
                  required
                  className={emailError ? "border-red-500" : ""}
                />
                {emailError && (
                  <p className="text-red-500 text-sm" role="alert">
                    {emailError}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
                {passwordError && (
                  <p className="text-red-500 text-sm" role="alert">
                    {passwordError}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              type="submit"
              onClick={void handleSubmit}
              disabled={!!emailError}
              variant="outline"
            >
              Sign In
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
