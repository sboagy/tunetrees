"use client";

import { useSearchParams } from "next/navigation";
import type { JSX } from "react";

import Image from "next/image";
import profilePic from "/public/logo4.png";

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
import { zodResolver } from "@hookform/resolvers/zod";
// import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { type ControllerRenderProps, useForm } from "react-hook-form";

// import { cookies } from "next/headers";
import {
  type AccountFormValues,
  accountFormSchema,
} from "@/app/auth/newuser/account-form";
import { providerMap } from "@/auth";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
import { PasswordInput } from "@/components/PasswordInput";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { emailSchema } from "../auth-types";
import { getUser } from "../password-login-only/validate-signin";
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

// const _crsfToken = client

export default function SignInPage(): JSX.Element {
  const searchParams = useSearchParams();
  let email = searchParams.get("email") || "";

  // Move the _crsfToken declaration here
  const [_crsfToken, setCrsfToken] = useState("abcdef");
  console.log("SignInPage(): setCrsfToken:", setCrsfToken);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      email: email || "", // Ensure email has an initial value
      password: "", // Add initial value for password
      password_confirmation: "", // Add initial value for password_confirmation
      name: "", // Add initial value for name
      csrfToken: _crsfToken || "", // Add initial value for csrfToken if needed
    },
  });

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
      // setEmailError("Email cannot be empty");
      setEmailError(null);
      return false;
    }

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
      if (user) {
        setEmailError("Email already in use");
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
      // setPasswordError("Password confirmation does not match");
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

  // Use useRouter directly
  const router = useRouter();

  // Define onSubmit as a regular async function
  const onSubmit = async (data: AccountFormValues) => {
    console.log("onSubmit called with data:", data);
    const host = window.location.host;

    const result = await newUser(data, host);
    console.log(result);

    router.push("/auth/verify-request");
  };

  // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
  console.log("SignInPage(): csrfToken: %s", _crsfToken);

  // useEffect(() => {
  //   const fetchCrsfToken = async () => {
  //     try {
  //       const response = await fetch("/api/get-csrf-token");
  //       const data = await response.json();
  //       setCrsfToken(data.csrfToken);
  //     } catch (error) {
  //       console.error("Failed to fetch CSRF token:", error);
  //     }
  //   };

  //   fetchCrsfToken();
  // }, []);

  return (
    <div className="flex items-center justify-center mb-0 mt-20">
      <Card className="w-[24em]">
        <CardHeader>
          <CardTitle className="flex justify-center">
            <Image
              src={profilePic}
              alt="Home"
              width={75}
              height={75}
              // height={48}
              className="min-w-8"
              priority={true}
            />
          </CardTitle>

          {/* <CardTitle>Sign Up for TuneTrees</CardTitle> */}
          {/* <CardDescription>Register a new user with TuneTrees</CardDescription> */}
        </CardHeader>
        <CardContent>
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
                      <Input placeholder="csrfToken" type="hidden" {...field} />
                      {/* <CSRFInput /> */}
                    </FormControl>
                    {/* <FormDescription>TuneTrees user name.</FormDescription> */}
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
                      />
                    </FormControl>
                    {/* <FormDescription>
                      Must be a valid email address.
                    </FormDescription> */}
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
                      {/* <Input
                        placeholder="password"
                        type="password"
                        {...field}
                      /> */}
                      <PasswordInput
                        id="password"
                        placeholder="password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(e) => handlePasswordChange(e, field)}
                      />
                    </FormControl>
                    {/* <FormDescription>
                      Must be a valid email address.
                    </FormDescription> */}
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
                      {/* <Input
                        placeholder="password"
                        type="password"
                        {...field}
                      /> */}
                      <PasswordInput
                        id="password_confirmation"
                        placeholder="repeat password"
                        autoComplete="new-password"
                        {...field}
                        onChange={(e) =>
                          handlePasswordConfirmationChange(e, field)
                        }
                      />
                    </FormControl>
                    {/* <FormDescription>
                      Repeat password, must match previous field.
                    </FormDescription> */}
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
                      />
                    </FormControl>
                    {/* <FormDescription>
                      This is the name that will be displayed on your profile
                      and in emails.
                    </FormDescription> */}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={
                  !!emailError ||
                  !!passwordError ||
                  !!passwordConfirmationError ||
                  !form.getValues("password") ||
                  !form.getValues("password_confirmation") ||
                  !form.getValues("email") ||
                  !form.getValues("name")
                }
                className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
              >
                Sign Up
              </Button>
            </form>
            <div className="flex gap-2 items-center ml-12 mr-12 mt-6 -mb-2">
              <div className="flex-1 bg-neutral-300 h-[1px]" />
              <span className="text-xs leading-4 uppercase text-neutral-500">
                or sign up with
              </span>
              <div className="flex-1 bg-neutral-300 h-[1px]" />
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
