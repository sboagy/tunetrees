/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

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
import { useForm } from "react-hook-form";

// import { cookies } from "next/headers";
import {
  type AccountFormValues,
  accountFormSchema,
  defaultValues,
} from "@/app/auth/newuser/account-form";
import { PasswordInput } from "@/components/PasswordInput";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { newUser } from "./newuser-actions";
import { getUser } from "../password-login-only/validate-signin";
import { SocialLoginButtons } from "@/components/AuthSocialLogin";
import { providerMap } from "@/auth";
import { emailSchema } from "../auth-types";

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

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export default function SignInPage(props: any): JSX.Element {
  let email = props.searchParams.email || "";
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues,
  });

  if (email === "" && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get("email") || email;
  }

  const [userEmail, setUserEmail] = useState(email);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordConfirmationError, setPasswordConfirmationError] = useState<
    string | null
  >(null);
  const [userName, setUserName] = useState("");

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
    validateEmail(email);
  }, [email, validateEmail]);

  const handleEmailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setUserEmail(newEmail);
    validateEmail(newEmail);

    const user = await getUser(newEmail);
    if (user) {
      setEmailError("Email already in use");
    }
    form.setValue("email", newEmail);
  };

  function check_password(pw: string, pwc: string) {
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

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pw = e.target.value;
    setPassword(pw);
    check_password(pw, passwordConfirmation);
    void form.trigger("password");
    form.setValue("password", pw);
    // form.trigger("password");
  };

  const handlePasswordConfirmationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const pwc = e.target.value;
    setPasswordConfirmation(pwc);
    check_password(password, pwc);
    form.setValue("password_confirmation", pwc);
    // form.trigger("password_confirmation");
  };

  const handleUserNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userNameValue = e.target.value;
    setUserName(userNameValue);
    form.setValue("name", userNameValue);
    // form.trigger("password_confirmation");
  };

  // if I don't get the router via useState, I get a huge error,
  // but, I don't need or want to call setRouter, so this seems
  // really goofy.  There must be a better way.
  const [router, setRouter] = useState(useRouter());
  console.log("SignInPage(): setRouter: ", setRouter);

  const onSubmit = useCallback(
    async (data: AccountFormValues) => {
      const host = window.location.host;
      // const response = await fetch("/api/user", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ data, host }),
      // });

      const result = await newUser(data, host);

      // const result = await response.json();
      console.log(result);

      router.push("/auth/verify-request");

      // Redirect to a success page or handle the result as needed
      // redirect("/auth/verify-request");
    },
    [router],
  );

  // function onSubmit(data: AccountFormValues) {
  //   console.log("In onSubmit in the newuser page", { data });
  //   toast({
  //     title: "You submitted the following values:",
  //     description: (
  //       <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
  //         <code className="text-white">{JSON.stringify(data, null, 2)}</code>
  //       </pre>
  //     ),
  //   });
  // }

  // const { data: session } = useSession
  // console.log("SignInPage(): session
  // console.log("SignInPage(): session
  // console.log("SignInPage(): session
  // console.log("SignInPage(): session

  // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
  const [_crsfToken, setCrsfToken] = useState("abcdef");
  console.log("SignInPage(): setCrsfToken:", setCrsfToken);

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
  console.log("SignInPage(): csrfToken: %s", _crsfToken);

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
              onSubmit={void form.handleSubmit(onSubmit)}
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
                        placeholder="person@example.com"
                        {...field}
                        onChange={void handleEmailChange}
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
                        onChange={handlePasswordChange}
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
                        onChange={handlePasswordConfirmationChange}
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
                        onChange={handleUserNameChange}
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
                  !password ||
                  !passwordConfirmation ||
                  !userEmail ||
                  !userName
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
