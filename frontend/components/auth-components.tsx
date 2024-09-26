import { signIn, signOut } from "auth";
import { redirect } from "next/navigation";
import { Button } from "./ui/button";

export function SignIn(props: React.ComponentPropsWithRef<typeof Button>) {
  console.log("Constructing the SignIn button");
  return (
    <form
      action={() => {
        // const session = await auth();
        console.log("Handling SignIn request");
        // await signIn();
        redirect("/auth/login");
      }}
    >
      <Button variant="outline" {...props}>
        Sign in
      </Button>
    </form>
  );
}

// export function NewUser(props: React.ComponentPropsWithRef<typeof Button>) {
//   console.log("Constructing the SignIn button");
//   return (
//     <form
//       action={async () => {
//         "use server";
//         // const session = await auth();
//         console.log("Handling SignIn request");
//         await signIn("credentials", {
//           callbackUrl: "http://localhost:3000/home",
//         });
//         // redirect("/auth/login");
//       }}
//     >
//       <Button variant="outline" {...props}>
//         Sign in
//       </Button>
//     </form>
//   );
// }

export function NewUser(
  props: React.ComponentPropsWithRef<typeof Button>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  crsf_token: string,
) {
  console.log("Constructing the New User button");
  // Consider "Sign Up" instead of "New User".  AI prefers "Sign Up".
  // But it feels like "New User" better conveys the intent of becoming
  // a new TuneTrees user, other than "sign up" for a subscription
  // or something.  Also, "New user" contrasts better with "Sign In".
  return (
    <form
      action="/auth/newuser"
      onSubmit={(event) => {
        event.preventDefault();
        console.log("Handling New User request");
        redirect("/auth/newuser");
      }}
    >
      <Button variant="outline" {...props}>
        New user
      </Button>
    </form>
  );
}

export function DemoUser(props: React.ComponentPropsWithRef<typeof Button>) {
  console.log("Constructing the DemoUser button");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        // const session = await auth();
        console.log("Handling Demo User request");
        void signIn();
      }}
    >
      <Button variant="outline" {...props}>
        Demo user
      </Button>
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
      action={() => {
        // const session = await auth();
        console.log("Handling SignOut request");
        void signOut();
      }}
      className="w-full"
    >
      <Button variant="ghost" {...props}>
        Sign Out
      </Button>
    </form>
  );
}

export function UserSettingsMenuItem(
  props: React.ComponentPropsWithRef<typeof Button>,
) {
  console.log("Constructing the UserSettingsMenuItem button");
  return (
    <form
      action={() => {
        // const session = await auth();
        console.log("Handling User Settings request");
        redirect("/user-settings");
      }}
      className="w-full"
    >
      <Button variant="ghost" {...props}>
        User Settings
      </Button>
    </form>
  );
}

export function ManagePlaylistMenuItem(
  props: React.ComponentPropsWithRef<typeof Button>,
) {
  console.log("Constructing the ManagePlaylist button");
  return (
    <form
      action={() => {
        // const session = await auth();
        console.log("Handling User Settings request");
        redirect("/user-settings");
      }}
      className="w-full"
    >
      <Button variant="ghost" {...props}>
        Manage Playlist
      </Button>
    </form>
  );
}
