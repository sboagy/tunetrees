import { z } from "zod";

export const loginFormSchema = z.object({
  csrfToken: z
    .string()
    .min(2, {
      message: "User Name must be at least 2 characters.",
    })
    .max(30, {
      message: "User Name must not be longer than 30 characters.",
    }),
  // username: z
  //     .string()
  //     .min(2, {
  //         message: "User Name must be at least 2 characters.",
  //     })
  //     .max(30, {
  //         message: "User Name must not be longer than 30 characters.",
  //     }),
  password: z
    .string()
    .min(2, {
      message: "Password must be at least 2 characters.",
    })
    .max(30, {
      message: "Password must not be longer than 30 characters.",
    }),

  email: z
    .string()
    .min(2, {
      message: "Email must be at least 2 characters.",
    })
    .max(30, {
      message: "Email must not be longer than 30 characters.",
    }),
  //   dob: z.date({
  //     required_error: "A date of birth is required.",
  //   }),
  //   language: z.string({
  //     required_error: "Please select a language.",
  //   }),
});
export type LoginFormValues = z.infer<typeof loginFormSchema>;
// This can come from your database or API.
export const defaultValues: Partial<LoginFormValues> = {
  // name: "Your name",
  // dob: new Date("2023-01-23"),
};
