import {providerMap, signIn} from "@/auth";
import Image from "next/image";
// import { cookies } from "next/headers";
import {CSRFInput} from "../../../components/csrf_token";
// import { signIn } from "@/auth/helpers";
// import { getServerSideProps } from "next/dist/build/templates/pages";

// const csrfToken = cookies().get("authjs.csrf-token")?.value ?? "";
// const csrfToken = cookies().get("__Host-authjs.csrf-token")?.value ?? "";

// const csrfToken2 = cookies().get("next-auth.csrf-token")?.value.split("|")[0];
// const csrfToken = requestCookies.get(isProduction ? '__Host-authjs.csrf-token' : 'authjs.csrf-token');
// const csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
// const csrfToken2 = await getCsrfToken();

// const cookies_dict = cookies();

// export async function getServerSideProps(context: GetServerSidePropsContext) {
//   return {
//     props: {
//       csrfToken: await getCsrfToken(),
//     },
//   };
// }

export default async function SignInPage() {
//   let server_side_props =  getServerSideProps()
//   let cookies_list = cookies();
    //   let csrfToken = await getCsrfToken();
    // let csrfToken = cookies().get("__Host-authjs.csrf-token")?.value.split("|")[0];
    return (
        <div className="flex-1 overflow-hidden relative w-full h-full">
            <Image
                src="/logo.png"
                alt="Pattern Background"
                height={300}
                width={300}
                className="object-cover fixed top-0 left-0 w-screen h-screen bg-white -z-10"
            />
            {/* <div
        aria-label="Slate cover background"
        className="absolute left-0 top-0 z-10 flex h-[275%] w-[150%] translate-x-[-70%] translate-y-[-28%] rotate-[0deg] items-center bg-zinc-700 md:translate-y-[-68%] md:rotate-[0deg]"
      ></div> */}
            <div
                aria-label="Slate cover background"
                className="z-20 flex w-full items-center justify-center md:ml-[70%] md:w-[22rem] bg-zinc-700 "
            >
                <div className="flex flex-col justify-center items-center w-80 text-xl ">
                    <p>&nbsp;</p>
                    <p>&nbsp;</p>
                    <h2 className="flex items-center mb-4 space-x-2 text-3xl font-light text-zinc-600">
                        <Image
                            src="/logo.png"
                            alt="Home"
                            width="32"
                            height="32"
                            className="min-w-8"
                        />
                        <span className="text-4xl font-medium text-white">User Login</span>
                    </h2>
                    <div className="flex flex-col gap-2 p-6 m-8 w-full bg-white rounded shadow-lg">
                        {Object.values(providerMap).map((provider) => (
                            <form
                                className="[&>div]:last-of-type:hidden"
                                key={provider.id}

                                action={async (formData) => {
                                    "use server";
                                    console.log("credentials button pushed: %s", formData);
                                    if (provider.id === "credentials") {
                                        console.log("credentials button pushed");
                                        console.log(formData);
                                        await signIn(provider.id, {
                                            redirectTo: "/",
                                            username: formData.get("username"),
                                            password: formData.get("password"),
                                        });
                                    } else {
                                        await signIn(provider.id, {redirectTo: "/"});
                                    }
                                }}
                            >
                                {provider.id === "credentials" && (
                                    <>
                                        {/* <input type="hidden" name="csrfToken" value={csrfToken} /> */}
                                        <CSRFInput/>
                                        <label className="text-base font-light text-neutral-800">
                                            Username or Email
                                            <input
                                                className="block flex-1 p-3 w-full font-normal rounded-md border border-gray-200 transition sm:text-sm placeholder:font-light placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-zinc-500"
                                                required
                                                placeholder="User Name"
                                                name="username"
                                                type="text"
                                            />
                                        </label>

                                        <label className="text-base font-light text-neutral-800">
                                            Password
                                            <input
                                                className="block flex-1 p-3 w-full font-normal rounded-md border border-gray-200 transition sm:text-sm placeholder:font-light placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-zinc-500"
                                                required
                                                placeholder="password"
                                                name="password"
                                                type="password"
                                            />
                                        </label>
                                    </>
                                )}
                                <button
                                    type="submit"
                                    className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12 text-base font-light text-white rounded transition focus:ring-2 focus:ring-offset-2 focus:outline-none bg-zinc-800 hover:bg-zinc-900 focus:ring-zinc-800"
                                >
                                    <span>Sign in with {provider.name}</span>
                                </button>
                                {/* {provider.id === "credentials" && (
                  <>
                    <div className="flex gap-2 items-center my-4">
                      <div className="flex-1 bg-neutral-300 h-[1px]" />
                      <span className="text-xs leading-4 uppercase text-neutral-500">
                        or
                      </span>
                      <div className="flex-1 bg-neutral-300 h-[1px]" />
                    </div>
                    <button
                      type="submit"
                      className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12 text-base font-light text-white rounded transition focus:ring-2 focus:ring-offset-2 focus:outline-none bg-zinc-800 hover:bg-zinc-900 focus:ring-zinc-800"
                    >
                      <span>Register New User</span>
                    </button>
                    <div className="flex gap-2 items-center my-4">
                      <div className="flex-1 bg-neutral-300 h-[1px]" />
                      <span className="text-xs leading-4 uppercase text-neutral-500">
                        or
                      </span>
                      <div className="flex-1 bg-neutral-300 h-[1px]" />
                    </div>
                    <button
                      type="submit"
                      className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12 text-base font-light text-white rounded transition focus:ring-2 focus:ring-offset-2 focus:outline-none bg-zinc-800 hover:bg-zinc-900 focus:ring-zinc-800"
                    >
                      <span>Use Demo User</span>
                    </button>
                  </>
                )} */}
                                <div className="flex gap-2 items-center my-4">
                                    <div className="flex-1 bg-neutral-300 h-[1px]"/>
                                    <span className="text-xs leading-4 uppercase text-neutral-500">
                    or
                  </span>
                                    <div className="flex-1 bg-neutral-300 h-[1px]"/>
                                </div>
                            </form>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
