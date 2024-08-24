"use client";
import Head from "next/head";
import { useSearchParams } from "next/navigation";
import type React from "react";

const VerifyRequest: React.FC = () => {
  const searchParams = useSearchParams();
  const provider = searchParams.get("provider");
  const type = searchParams.get("type");

  return (
    <div>
      <Head>
        <title>Verify Your Request</title>
      </Head>
      <main>
        <h1>Please check Your Email to log in</h1>
        <p>
          A {type} link has been sent to your email address via {provider}.
          Please check your email and click the link to proceed.
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
