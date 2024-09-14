"use server";
import sgMail from "@sendgrid/mail";
import type { MailDataRequired } from "@sendgrid/mail";

import { signIn as naSignIn, signOut as naSignOut } from ".";

export async function signIn() {
  await naSignIn();
}

export async function signOut() {
  await naSignOut();
}

interface DynamicTemplateData {
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
  dynamicTemplateData?: DynamicTemplateData;
}): Promise<void> {
  const sendgrid_api_key = process.env.TT_AUTH_SENDGRID_API_KEY;
  if (!sendgrid_api_key) {
    throw new Error("TT_AUTH_SENDGRID_API_KEY not set.");
  }
  sgMail.setApiKey(sendgrid_api_key);

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

  try {
    const response = await sgMail.send(mailData);
    console.log("Email sent:", response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}
