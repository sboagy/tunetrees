"use client";

import { providerMap, signIn } from "@/auth";
import Image from "next/image";
import profilePic from "/public/logo4.png";

// import { useSession } from "next-auth/react";
import { useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Icons } from "@/components/icons";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// import { cookies } from "next/headers";
import {
  accountFormSchema,
  AccountFormValues,
  defaultValues,
} from "@/app/auth/newuser/account-form";
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

  // const [password, setPassword] = useState("");

  const onSubmit = useCallback(async (data: AccountFormValues) => {
    const result = await newUser(data);
    console.log(result);
    // do something with result
  }, []);

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

  // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
  const _crsfToken = "abcdef";
  // const _crsfToken = getCsrfToken();
  console.log("SignInPage(): csrfToken: %s", _crsfToken);

  return (
    <div className="flex items-center justify-center mb-0">
      <Card className="w-[24em]">
        <CardHeader>
          <CardTitle className="flex justify-center">
            <Image
              src={profilePic}
              alt="Home"
              width={48}
              height={48}
              // height={48}
              className="min-w-8"
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
                      <Input
                        placeholder="csrfToken"
                        type="hidden"
                        defaultValue="abcdef"
                        {...field}
                      />
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
              <button
                type="submit"
                className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12 text-base font-light text-white rounded transition focus:ring-2 focus:ring-offset-2 focus:outline-none bg-zinc-800 hover:bg-zinc-900 focus:ring-zinc-800"
              >
                Sign Up
              </button>
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
            .filter((provider) => provider.id !== "credentials")
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
                <Button
                  type="submit"
                  className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12 text-base font-light text-white rounded transition focus:ring-2 focus:ring-offset-2 focus:outline-none bg-zinc-800 hover:bg-zinc-900 focus:ring-zinc-800"
                >
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
