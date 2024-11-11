// "use server";
// import { useEffect, useState } from "react";
// import { getCsrfToken } from "next-auth/react";
import { cookies } from "next/headers";
import { Input } from "./ui/input";

export function CSRFInput() {
  // const [csrfToken, setCsrfToken] = useState("");

  // useEffect(() => {
  //   getCsrfToken().then(setCsrfToken);
  // }, []);

  // const sleep = (ms: number) =>
  //   new Promise((resolve) => setTimeout(resolve, ms));

  cookies()
    .then((cookie) => {
      const csrfToken = cookie
        .get("__Host-authjs.csrf-token")
        ?.value.split("|")[0];

      // let csrfToken = "abcdef";
      console.log("CSRFInput(): csrfToken: %s", csrfToken);

      return (
        <Input
          type="hidden"
          // required={false}
          name="csrfToken"
          defaultValue={csrfToken}
          // value={csrfToken}
        />
      );
    })
    .catch((error) => {
      console.error("CSRFInput(): error: %s", error);
      throw error;
    });
}
