"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { getCsrfToken, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import type { ControllerRenderProps } from "react-hook-form";

// import {
//   type AccountFormValues,
//   accountFormSchema,
// } from "@/app/auth/newuser/account-form";
import { PasswordInput } from "@/components/PasswordInput";
import { SMSVerificationOption } from "@/components/auth/sms-verification-option";
import { useRouter } from "next/navigation";
import { emailSchema } from "@/app/auth/auth-types";
import { getUser } from "@/app/auth/login/validate-signin";
import { newUser } from "@/app/auth/newuser/newuser-actions";
import {
  accountFormSchema,
  type AccountFormValues,
} from "@/app/auth/newuser/account-form";

// This can come from your database or API.
// const defaultValues: Partial<AccountFormValues> = {
//   // name: "Your name",
//   // dob: new Date("2023-01-23"),
// };

export function AccountForm() {
  const { data: session, update } = useSession();
  let email = session?.user?.email;

  // const searchParams = useSearchParams();
  // let email = searchParams.get("email") || "";

  const [_crsfToken, setCrsfToken] = useState("");

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      user_id: session?.user?.id || "", // Ensure id has an initial value
      email: email || "", // Ensure email has an initial value
      password: "", // Add initial value for password
      password_confirmation: "", // Add initial value for password_confirmation
      name: session?.user?.name || "", // Add initial value for name, empty string if null
      phone: (session?.user as { phone?: string } | undefined)?.phone || "", // Add initial value for phone
      csrfToken: "", // Initialize with empty string
    },
  });

  // Runs once after initial render: The effect runs only once, after the component has rendered for the first time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void (async () => {
      const token = await getCsrfToken();
      if (token) {
        setCrsfToken(token);
        form.setValue("csrfToken", token); // Update form's csrfToken value
      }
    })();
  }, []);

  // Fetch user data from database to populate form fields, especially phone number
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    void (async () => {
      if (email) {
        console.log("Initial fetch: Getting user data for email:", email);
        const userData = await getUser(email);
        console.log("Initial fetch: Got user data:", userData);
        if (userData) {
          // Update form fields with database data
          if (userData.phone) {
            console.log("Initial fetch: Setting phone to:", userData.phone);
            form.setValue("phone", userData.phone);
            setStoredPhoneNumber(userData.phone);
          }
          if (userData.name) {
            form.setValue("name", userData.name);
          }
          console.log(
            "Initial fetch: phoneVerified status:",
            userData.phoneVerified,
          );
          setPhoneVerified(!!userData.phoneVerified);
        }
      }
    })();
  }, [email, form]);

  if (email === "" && typeof window !== "undefined") {
    const searchParams = new URLSearchParams(window.location.search);
    email = searchParams.get("email") || email;
  }

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordConfirmationError, setPasswordConfirmationError] = useState<
    string | null
  >(null);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState<boolean>(false);
  const [storedPhoneNumber, setStoredPhoneNumber] = useState<string>("");

  // Function to refresh user data from database
  const refreshUserData = useCallback(async () => {
    if (email) {
      console.log("refreshUserData: Fetching user data for email:", email);
      const userData = await getUser(email);
      console.log("refreshUserData: Got user data:", userData);
      if (userData) {
        // Update form fields with latest database data
        if (userData.phone) {
          form.setValue("phone", userData.phone);
          setStoredPhoneNumber(userData.phone);
        }
        if (userData.name) {
          form.setValue("name", userData.name);
        }
        // Update session with latest phone verification status
        console.log(
          "refreshUserData: Updating session with phone_verified:",
          !!userData.phoneVerified,
        );
        setPhoneVerified(!!userData.phoneVerified);
        await update({
          user: {
            phone: userData.phone,
            phone_verified: !!userData.phoneVerified,
          },
        });
      }
    }
  }, [email, form, update]);

  const validateEmail = useCallback((email: string): boolean => {
    if (email === "") {
      setEmailError(null);
      return false;
    }

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.issues[0].message);
      return false;
    }
    setEmailError(null);
    return true;
  }, []);

  useEffect(() => {
    validateEmail(form.getValues("email"));
  }, [form, validateEmail]);

  const handleEmailChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "email">,
  ) => {
    const newEmail = e.target.value;
    console.log("handleEmailChange: email:", newEmail);
    field.onChange(e); // Update the form state
    validateEmail(newEmail);

    if (newEmail) {
      const user = await getUser(newEmail);
      if (user) {
        setEmailError("Email already in use");
      }
    }
  };

  function check_password() {
    const pw = form.getValues("password");
    const pwc = form.getValues("password_confirmation");
    if (!pw || !pwc) {
      setPasswordError(null);
      setPasswordConfirmationError(null);
    } else if (pw === pwc) {
      setPasswordError(null);
      setPasswordConfirmationError(null);
    } else {
      setPasswordConfirmationError("Passwords do not match");
    }
  }

  const handlePasswordChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "password">,
  ) => {
    console.log("handlePasswordChange: password:", e.target.value);
    field.onChange(e); // Update the form state
    check_password();
    void form.trigger("password");
  };

  const handlePasswordConfirmationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "password_confirmation">,
  ) => {
    console.log(
      "handlePasswordConfirmationChange: password_confirmation:",
      e.target.value,
    );
    field.onChange(e); // Update the form state
    check_password();
  };

  const handleUserNameChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "name">,
  ) => {
    console.log("handleUserNameChange: name:", e.target.value);
    field.onChange(e); // Update the form state
  };

  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: ControllerRenderProps<AccountFormValues, "phone">,
  ) => {
    const newPhone = e.target.value;
    console.log("handlePhoneChange: phone:", newPhone);
    field.onChange(e); // Update the form state

    // Force form to update immediately
    form.setValue("phone", newPhone);

    // Show verification if user enters a different phone number
    const trimmedPhone = newPhone.trim();
    if (trimmedPhone && trimmedPhone !== storedPhoneNumber) {
      setShowPhoneVerification(true);
      setPhoneVerified(false); // New number needs verification
    } else if (trimmedPhone === storedPhoneNumber) {
      setShowPhoneVerification(false);
      setPhoneVerified(true); // Same as stored verified number
    } else {
      setShowPhoneVerification(false);
      setPhoneVerified(false); // Empty field
    }
  };

  const router = useRouter();

  const onSubmit = async (data: AccountFormValues) => {
    console.log("onSubmit called with data:", data);
    const host = window.location.host;

    const result = await newUser(data, host);
    console.log(`newUser status result ${result.status}`);

    if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
      const linkBackURL = result.linkBackURL;
      // Store the linkBackURL in local storage for testing purposes
      if (typeof window !== "undefined") {
        localStorage.setItem("linkBackURL", linkBackURL);
      } else {
        console.log(
          "onSubmit(): window is undefined, cannot store linkBackURL for playwright tests",
        );
      }
    }

    router.push(`/auth/verify-request?email=${data.email}`);
  };

  console.log("SignInPage(): csrfToken: %s", _crsfToken);

  // const handleCancel = () => {
  //   // tune.deleted = true indicates this is a new tune, so it's
  //   // safe and proper to delete on cancel.
  //   if (typeof window !== "undefined") {
  //     window.location.href = "/";
  //   }
  // };

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          void form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-6"
      >
        <FormField
          control={form.control}
          name="csrfToken"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  placeholder="csrfToken"
                  type="hidden"
                  {...field}
                  value={_crsfToken} // Use the state variable here
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* <FormField
          control={form.control}
          name="user_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground">
                User ID (for reference)
              </FormLabel>
              <FormControl>
                <Input
                  type="string"
                  placeholder="user_id"
                  {...field}
                  disabled
                  readOnly
                  className="opacity-75 cursor-text select-text"
                  onClick={(e) => e.currentTarget.select()}
                  data-testid="user_id"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /> */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>EMail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="person@example.com"
                  {...field}
                  onChange={(e) => void handleEmailChange(e, field)}
                  required
                  className={emailError ? "border-red-500" : ""}
                  autoFocus
                  data-testid="user_email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {emailError && (
          <p className="text-red-500 text-sm" role="alert">
            {emailError}
          </p>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput
                  id="password"
                  placeholder="password"
                  autoComplete="new-password"
                  {...field}
                  onChange={(e) => handlePasswordChange(e, field)}
                  data-testid="user_password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {passwordError && (
          <p className="text-red-500 text-sm" role="alert">
            {passwordError}
          </p>
        )}
        <FormField
          control={form.control}
          name="password_confirmation"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput
                  id="password_confirmation"
                  placeholder="repeat password"
                  autoComplete="new-password"
                  {...field}
                  onChange={(e) => handlePasswordConfirmationChange(e, field)}
                  data-testid="user_password_verification"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {passwordConfirmationError && (
          <p className="text-red-500 text-sm" role="alert">
            {passwordConfirmationError}
          </p>
        )}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Your name"
                  {...field}
                  onChange={(e) => handleUserNameChange(e, field)}
                  data-testid="user_name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number (Optional)</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  {...field}
                  onChange={(e) => handlePhoneChange(e, field)}
                  data-testid="user_phone"
                />
              </FormControl>
              <FormMessage />
              {phoneVerified && form.watch("phone") && (
                <p className="text-sm text-green-600">
                  ✓ Phone number verified - SMS password reset available
                </p>
              )}
              {field.value && !phoneVerified && (
                <p className="text-sm text-yellow-600">
                  Phone number not verified. SMS password reset will not be
                  available.
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Phone Verification Section - Only show when user enters a different number */}
        {showPhoneVerification && form.watch("phone") && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/5">
            <h3 className="text-sm font-medium">Verify New Phone Number</h3>
            <p className="text-sm text-muted-foreground">
              You've entered a new phone number. Please verify it to enable SMS
              password reset.
            </p>
            {(() => {
              const currentPhone = form.watch("phone");
              console.log(
                "SMSVerificationOption receiving initialPhone:",
                currentPhone,
              );
              return null;
            })()}
            <SMSVerificationOption
              initialPhone={form.watch("phone")}
              userEmail={session?.user?.email || ""}
              onVerificationSuccess={(phone) => {
                console.log("New phone verified:", phone);
                setShowPhoneVerification(false);
                form.setValue("phone", phone);
                setStoredPhoneNumber(phone);
                setPhoneVerified(true);
                // Refresh user data to get updated phone data
                void refreshUserData();
              }}
              onError={(error) => {
                console.error("Phone verification error:", error);
              }}
              buttonText="Send Verification Code"
              description="We'll send a verification code to confirm your new phone number"
              isSignup={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPhoneVerification(false);
                // Reset to stored phone number
                form.setValue("phone", storedPhoneNumber);
                setPhoneVerified(!!storedPhoneNumber);
              }}
            >
              Cancel
            </Button>
          </div>
        )}

        <Button
          type="submit"
          variant="secondary"
          disabled={
            !_crsfToken ||
            !!emailError ||
            !!passwordError ||
            !!passwordConfirmationError ||
            !form.getValues("password") ||
            !form.getValues("password_confirmation") ||
            !form.getValues("email") ||
            !form.getValues("name")
          }
          className="flex justify-center items-center px-4 mt-2 space-x-2 w-full h-12"
        >
          Update account
        </Button>
      </form>
      {/* <div className="flex gap-2 items-center ml-12 mr-12 mt-6 -mb-2">
        <div className="flex-1 bg-neutral-300 h-[1px]" />
        <span className="text-xs leading-4 uppercase text-neutral-500">
          or sign up with
        </span>
        <div className="flex-1 bg-neutral-300 h-[1px]" />
      </div> */}
    </Form>
  );
}
