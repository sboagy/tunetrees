"use client";
import type { JSX } from "react";
import Head from "next/head";
// import { useSearchParams } from "next/navigation";
// import { Suspense, useEffect, useState } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { useRouter } from "next/navigation"; // Use the next/navigation module for client-side navigation
import { useSearchParams } from "next/navigation";

export default function VerifyRequest(): JSX.Element {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();

  const handleOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = (e.target as HTMLFormElement).verificationCode.value;
    console.log("Submitted verification code:", code);

    // Use the email from searchParams instead of URL parameters
    if (email) {
      fetch(`/api/verify-user?email=${encodeURIComponent(email)}&token=${code}`)
        .then((response) => {
          if (response?.ok && response?.statusText === "OK") {
            console.log("Verification successful");
            // redirect("/home");
            router.push("/");
            router.refresh();
            return;
          }
          throw new Error(`Verification failed: ${response.statusText}`);
        })
        // .then(() => {
        //   console.error("Unexpected empty response!  Verification failed.");
        // })
        .catch((error) => {
          console.error("Error verifying code:", error);
          // Handle error (show message to user, etc)
        });
    } else {
      console.error("Email parameter is missing from the URL");
    }
  };

  return (
    <div>
      <Head>
        <title>Verify Your Request</title>
      </Head>
      <main>
        <h1>Please check Your Email to log in</h1>
        <p>
          A link has been sent to your email address via the Email provider you
          specified.
        </p>
        <p>Please check your email and either click the link</p>
        <p>or enter the verification code below:</p>
        <br />
        <br />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            margin: "1rem 0",
          }}
        >
          <form
            onSubmit={(e) => {
              handleOnSubmit(e);
            }}
          >
            <InputOTP
              maxLength={6}
              id="verificationCode"
              name="verificationCode"
              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
              placeholder="6-digit code"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <br />
            <button
              type="submit"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "4px",
                border: "none",
                backgroundColor: "#0070f3",
                color: "white",
                cursor: "pointer",
              }}
            >
              Submit Code
            </button>
          </form>
        </div>
      </main>
      <style jsx>{`
        div {
          flex-direction: column;
          align-items: center;
          height: 100vh;
        }
        main {
          text-align: center;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
          margin-bottom: 1rem;
        }
      `}</style>
    </div>
  );
}
