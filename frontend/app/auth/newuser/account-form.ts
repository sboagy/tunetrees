import { z } from "zod";
import { isPasswordValid } from "@/lib/password-utils";

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
      .min(8, {
        message: "Password must be at least 8 characters.",
      })
      .max(128, {
        message: "Password must not be longer than 128 characters.",
      })
      .refine(isPasswordValid, {
        message: "Password must meet at least 3 security requirements.",
      }),
    password_confirmation: z
      .string()
      .min(8, {
        message: "Password must be at least 8 characters.",
      })
      .max(128, {
        message: "Password must not be longer than 128 characters.",
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
      .refine(
        (phone) => {
          if (!phone || phone.trim() === "") return true; // Optional field
          // Basic phone validation - allow international formats
          const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
          return phoneRegex.test(phone.replace(/[\s\-()]/g, ""));
        },
        {
          message: "Please enter a valid phone number",
        },
      ),
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
