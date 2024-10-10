"use server";

// import { useSearchParams } from "next/navigation";

// enum Error {
//   Configuration = "Configuration",
// }

// export default async function ErrorPage(searchParams: any) {
//   return (
//     <div className="space-y-2">Something bad happened: {searchParams}</div>
//   );
// }

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const error = await Promise.resolve(searchParams.error ?? "1"); // default value is "1"

  return <div>Password does not match. Error code: {error}</div>;
}
