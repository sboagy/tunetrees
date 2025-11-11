"use client";
import { signIn } from "auth";
import { useRouter } from "next/navigation"; // Use the next/navigation module for client-side navigation
import { signOut } from "next-auth/react";
import { Button } from "./ui/button";

export function SignIn(props: React.ComponentPropsWithRef<typeof Button>) {
  const router = useRouter();
  // console.log("Constructing the SignIn button");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("Handling SignIn request");
    router.push("/auth/login");
  };

  return (
    <form onSubmit={handleSubmit}>
      <Button variant="outline" {...props}>
        Sign in
      </Button>
    </form>
  );
}

export function NewUser(
  props: React.ComponentPropsWithRef<typeof Button>,

  // crsf_token: string,
) {
  const router = useRouter();
  // console.log("Constructing the New User button");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("Handling New User request");
    router.push("/auth/newuser");
  };

  // Consider "Sign Up" instead of "New User".  AI prefers "Sign Up".
  // But it feels like "New User" better conveys the intent of becoming
  // a new TuneTrees user, other than "sign up" for a subscription
  // or something.  Also, "New user" contrasts better with "Sign In".
  return (
    <form onSubmit={handleSubmit}>
      <Button variant="outline" {...props}>
        New user
      </Button>
    </form>
  );
}

export function DemoUser(props: React.ComponentPropsWithRef<typeof Button>) {
  // console.log("Constructing the DemoUser button");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // const session = await auth();
    console.log("Handling Demo User request");
    void signIn();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Button variant="outline" {...props}>
        Demo user
      </Button>
    </form>
  );
}

export function SignOut(props: React.ComponentPropsWithRef<typeof Button>) {
  // console.log("Constructing the SignOut button");

  const handleClick = () => {
    console.log("Handling SignOut request");
    signOut()
      .then((result) => {
        console.log("SignOut result", result);
      })
      .catch((error) => {
        console.error("SignOut error", error);
      });
  };

  return (
    <Button variant="ghost" onClick={handleClick} {...props}>
      Sign Out
    </Button>
  );
}

export function UserSettingsMenuItem(
  props: React.ComponentPropsWithRef<typeof Button>,
) {
  const router = useRouter();
  // console.log("Constructing the UserSettingsMenuItem button");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("Handling User Settings request");
    router.push("/user-settings");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <Button
        variant="ghost"
        data-testid="tt-user-settings-menu-item"
        {...props}
      >
        User Settings
      </Button>
    </form>
  );
}

// Dedicated user menu trigger for tests (stable selector)
