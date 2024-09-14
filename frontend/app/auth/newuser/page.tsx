"use client";

import { providerMap, signIn } from "@/auth";
import Image from "next/image";
import profilePic from "/public/logo4.png";

import { Icons } from "@/components/icons";
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
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

// import { cookies } from "next/headers";
import {
  type AccountFormValues,
  accountFormSchema,
  defaultValues,
} from "@/app/auth/newuser/account-form";
import { PasswordInput } from "@/components/password-input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { newUser } from "./newuser-action";

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

export default function SignInPage() {
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues,
  });

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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              {/* <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Name</FormLabel>
                    <FormControl>
                      <Input placeholder="username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>EMail</FormLabel>
                    <FormControl>
                      <Input placeholder="person@example.com" {...field} />
                    </FormControl>
                    {/* <FormDescription>
                      Must be a valid email address.
                    </FormDescription> */}
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      />
                    </FormControl>
                    {/* <FormDescription>
                      Must be a valid email address.
                    </FormDescription> */}
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      />
                    </FormControl>
                    {/* <FormDescription>
                      Repeat password, must match previous field.
                    </FormDescription> */}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
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
          {Object.values(providerMap)
            .filter(
              (provider) =>
                provider.id !== "credentials" && provider.id !== "sendgrid",
            )
            .map((provider) => (
              <form
                key={provider.id}
                action={(formData) => {
                  console.log("credentials button pushed: %s", formData);
                  if (provider.id === "credentials") {
                    console.log("credentials button pushed");
                    console.log(formData);
                    signIn(provider.id, {
                      redirectTo: "/",
                      username: formData.get("username"),
                      password: formData.get("password"),
                    });
                  } else {
                    signIn(provider.id, { redirectTo: "/" });
                  }
                }}
              >
                <Button type="submit" variant="secondary">
                  {provider.id === "github" && (
                    <>
                      <Icons.gitHub className="mr-2 h-4 w-4" />
                      Github
                    </>
                  )}
                  {provider.id === "google" && (
                    <>
                      <Icons.google className="mr-2 h-4 w-4" />
                      google
                    </>
                  )}
                  {/* <span>Sign in with {provider.name}</span> */}
                </Button>
              </form>
            ))}
          {/* <Button variant="outline">Cancel</Button>
          <Button>Deploy</Button> */}
          {/* <div className="grid grid-cols-2 gap-6">
            <Button variant="outline">
              <Icons.gitHub className="mr-2 h-4 w-4" />
              Github
            </Button>
            <Button variant="outline">
              <Icons.google className="mr-2 h-4 w-4" />
              Google
            </Button>
          </div> */}
        </CardFooter>
      </Card>
    </div>
  );
}
