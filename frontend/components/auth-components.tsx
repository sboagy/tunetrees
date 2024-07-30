import {signIn, signOut} from "auth";
import {Button} from "./ui/button";
import {redirect} from "next/navigation";

export function SignIn(props: React.ComponentPropsWithRef<typeof Button>) {
    console.log("Constructing the SignIn button");
    return (
        <form
            action={async () => {
                "use server";
                // const session = await auth();
                console.log("Handling SignIn request");
                await signIn();
            }}
        >
            <Button {...props}>Sign In</Button>
        </form>
    );
}

export function NewUser(props: React.ComponentPropsWithRef<typeof Button>) {
    console.log("Constructing the NewUser button");
    return (
        <form
            action={async () => {
                "use server";
                // const session = await auth();
                console.log("Handling New User request");
                redirect("/auth/newuser");
            }}
        >
            <Button {...props}>New User</Button>
        </form>
    );
}

export function DemoUser(props: React.ComponentPropsWithRef<typeof Button>) {
    console.log("Constructing the DemoUser button");
    return (
        <form
            action={async () => {
                "use server";
                // const session = await auth();
                console.log("Handling Demo User request");
                await signIn();
            }}
        >
            <Button {...props}>Demo User</Button>
        </form>
    );
}


// export function SignIn() {
//   return (
//     <form
//       action={async (formData) => {
//         "use server"
//         await signIn("credentials", formData)
//       }}
//     >
//       <label>
//         Email
//         <input name="email" type="email" />
//       </label>
//       <label>
//         Password
//         <input name="password" type="password" />
//       </label>
//       <button>Sign In</button>
//     </form>
//   )
// }

export function SignOut(props: React.ComponentPropsWithRef<typeof Button>) {
    console.log("Constructing the SignOut button");
    return (
        <form
            action={async () => {
                "use server";
                // const session = await auth();
                console.log("Handling SignOut request");
                await signOut();
            }}
            className="w-full"
        >
            <Button variant="ghost" className="w-full p-0" {...props}>
                Sign Out
            </Button>
        </form>
    );
}
