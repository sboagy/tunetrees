"use client";

import { Suspense } from "react";

function ErrorPageContent({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const error = searchParams.error ?? "1"; // default value is "1"
  return <div>Password does not match. Error code: {error}</div>;
}

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorPageContent searchParams={await searchParams} />
    </Suspense>
  );
}
