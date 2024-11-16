"use server";
// import { signIn } from "@/auth";
import { type ProviderDict, type ProviderMap, signIn } from "auth";
// import { signIn } from "next-auth/react";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const SIGNIN_ERROR_URL = "/error";

export async function doSocialLogin2(provider: ProviderDict) {
  //   if (action === null){
  //     throw Error("No action provided");
  //   }
  // console.log("doSocialLogin2: ", providerDict.id);
  // signIn(providerDict.id, {
  //   redirectTo: "/home",
  //   redirect: true,
  // });
  // redirect(redirect_url);
  try {
    return await signIn(provider.id, {
      redirectTo: "",
    });
  } catch (error) {
    // Signin can fail for a number of reasons, such as the user
    // not existing, or the user not having the correct role.
    // In some cases, you may want to redirect to a custom error
    if (error instanceof AuthError) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
    }

    // Otherwise if a redirects happens Next.js can handle it
    // so you can just re-thrown the error and let Next.js handle it.
    // Docs:
    // https://nextjs.org/docs/app/api-reference/functions/redirect#server-component
    throw error;
  }
}

export async function getSocialLoginURLs(providerMap: ProviderMap) {
  const signInURLs: { [key: string]: string } = {};

  for (const provider of Object.values(providerMap).filter(
    (provider) => provider.id !== "credentials" && provider.id !== "sendgrid",
  )) {
    // Not absolutely sure the return from signIn is a string
    const redirectUrl: string = (await signIn(provider.id, {
      redirectTo: "/home",
      redirect: false,
    })) as string;
    signInURLs[provider.id] = redirectUrl;
  }
  console.log("signInURLs", signInURLs);
  return signInURLs;
}
