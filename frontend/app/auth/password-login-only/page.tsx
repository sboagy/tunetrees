"use client";
import { useState, useEffect, useCallback } from "react";
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
import { z } from "zod";
import { authorizeWithPassword } from "./validate-signin";
import { signIn } from "next-auth/react";

const emailSchema = z.string().email("Invalid email address");

interface LoginDialogProps {
  email?: string;
}

export default function LoginDialog({ email = "" }: LoginDialogProps) {
  if (email === "" && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get("email") || email;
  }

  const [user_email, setUserEmail] = useState(email);
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
    if (validateEmail(user_email)) {
      // Handle login logic here
      console.log("Sign in attempt with:", { user_email, password });
      try {
        // const user = authorizeWithPassword(user_email, password);
        const user = await authorizeWithPassword(user_email, password);
        if (!user) {
          setPasswordError("Sign in failed");
        } else {
          console.log("Sign in successful");
          // Redirect to the home page
          if (typeof window !== "undefined") {
            signIn("password-login", {
              email,
              callbackUrl: "http://localhost:3000/home",
            });
            window.location.href = "/home";
          } else {
            // Hopefully this never happens??
            setPasswordError("Problem redirecting to home page");
            console.log("Sign in successful, but window is undefined");
          }
        }
      } catch (error) {
        setPasswordError(`${error}`);
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="user_email">Email</Label>
                <Input
                  id="user_email"
                  name="user_email"
                  type="email"
                  placeholder="m@example.com"
                  value={user_email}
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
              onClick={handleSubmit}
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
