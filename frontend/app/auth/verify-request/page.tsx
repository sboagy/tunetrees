"use client";
import Head from "next/head";
// import { useSearchParams } from "next/navigation";
import type React from "react";
// import { Suspense, useEffect, useState } from "react";

const VerifyRequest: React.FC = () => {
  // function message() {
  //   const [type, setType] = useState<string | null>(null);
  //   const [provider, setProvider] = useState<string | null>(null);
  //   const searchParams = useSearchParams();

  //   useEffect(() => {
  //     setType(searchParams.get("type"));
  //     setProvider(searchParams.get("provider"));
  //   }, [searchParams]);
  //   return (
  //     <p>
  //       A {type} link has been sent to your email address via
  //       {provider}. Please check your email and click the link to proceed.
  //     </p>
  //   );
  // }

  // useEffect(() => {
  //   // Your JavaScript snippet here
  //   console.log(
  //     "VerifyRequest (1), window.location.href: %s",
  //     window.location.href,
  //   );
  //   // window.location.href = "https://localhost:3000";
  //   // You can add any other JavaScript code you need to run on page load
  //   console.log(
  //     "VerifyRequest (2), changed window.location.href: %s",
  //     window.location.href,
  //   );
  // }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div>
      <Head>
        <title>Verify Your Request</title>
      </Head>
      <main>
        <h1>Please check Your Email to log in</h1>
        {/* <Suspense>{message()}</Suspense> */}
        <p>
          A link has been sent to your email address via the Email provider you
          specified. Please check your email and click the link to proceed.
        </p>
      </main>
      <style jsx>{`
        div {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background-color: #f9f9f9;
        }
        main {
          text-align: center;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
          margin-bottom: 1rem;
          color: #333;
        }
        p {
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default VerifyRequest;
