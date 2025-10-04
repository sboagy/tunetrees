"use server";
import type { MailDataRequired } from "@sendgrid/mail";
import sgMail from "@sendgrid/mail";

import { signIn as naSignIn, signOut as naSignOut } from ".";

export async function signIn() {
  await naSignIn();
}

export async function signOut() {
  await naSignOut();
}

interface IDynamicTemplateData {
  verificationLink: string;
  // Add other properties as needed
}

export async function sendGrid(options: {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: IDynamicTemplateData;
}): Promise<void> {
  const sendgridApiKey = process.env.TT_AUTH_SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error("TT_AUTH_SENDGRID_API_KEY not set.");
  }
  sgMail.setApiKey(sendgridApiKey);

  const mailData: MailDataRequired = {
    to: options.to,
    from: options.from,
    subject: options.subject,
    content: [
      {
        type: "text/plain",
        value: options.text || "",
      },
      {
        type: "text/html",
        value: options.html || "",
      },
    ],
    dynamicTemplateData: options?.dynamicTemplateData,
  };

  if (process.env.NEXT_PUBLIC_MOCK_EMAIL_CONFIRMATION === "true") {
    console.log(
      "===> send-grid.ts:48 ~ sendGrid -- Skipping email send since using mock external APIs",
    );
  } else {
    try {
      const response = await sgMail.send(mailData);
      console.log("Email sent:", response);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }
}
