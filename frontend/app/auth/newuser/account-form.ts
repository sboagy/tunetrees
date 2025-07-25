import { z } from "zod";

export const accountFormSchema = z
  .object({
    csrfToken: z.string().max(128, {
      message: "csrfToken must not be longer than 128 characters.",
    }),
    // username: z
    //     .string()
    //     .min(2, {
    //         message: "User Name must be at least 2 characters.",
    //     })
    //     .max(30, {
    //         message: "User Name must not be longer than 30 characters.",
    //     }),
    user_id: z.string().optional(),
    password: z
      .string()
      .min(2, {
        message: "Password must be at least 2 characters.",
      })
      .max(30, {
        message: "Password must not be longer than 30 characters.",
      }),
    password_confirmation: z
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
    name: z
      .string()
      .min(2, {
        message: "Name must be at least 2 characters.",
      })
      .max(30, {
        message: "Name must not be longer than 30 characters.",
      }),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || /^\+?[1-9]\d{1,14}$/.test(val), {
        message: "Please enter a valid phone number",
      }),
    //   dob: z.date({
    //     required_error: "A date of birth is required.",
    //   }),
    //   language: z.string({
    //     required_error: "Please select a language.",
    //   }),
  })
  .superRefine(({ password_confirmation, password }, ctx) => {
    if (password_confirmation !== password) {
      ctx.addIssue({
        code: "custom",
        message: "The passwords did not match",
        path: ["password_confirmation"],
      });
    }
  });
export type AccountFormValues = z.infer<typeof accountFormSchema>;
// This can come from your database or API.
export const defaultValues: Partial<AccountFormValues> = {
  // name: "Your name",
  // dob: new Date("2023-01-23"),
};
