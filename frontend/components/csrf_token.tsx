"use server";
// import { useEffect, useState } from "react";
// import { getCsrfToken } from "next-auth/react";
import {cookies} from "next/headers";

export async function CSRFInput() {
    // const [csrfToken, setCsrfToken] = useState("");

    // useEffect(() => {
    //   getCsrfToken().then(setCsrfToken);
    // }, []);

    // const sleep = (ms: number) =>
    //   new Promise((resolve) => setTimeout(resolve, ms));

    let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
    console.log("CSRFInput(): csrfToken: %s", csrfToken);

    return (
        <input type="hidden" name="csrfToken" defaultValue={csrfToken}/>
    );
}
