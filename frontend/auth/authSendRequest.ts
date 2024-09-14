/* eslint-disable @typescript-eslint/no-explicit-any */
import type { EmailConfig } from "next-auth/providers";

// token: string; theme: Theme; request: Request; }) => Awaitable<void>
export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  expires: Date;
  provider: EmailConfig;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  theme: any;
  token: string;
  request: Request;
}) {
  const { identifier: to, provider, url, theme } = params;
  const { host } = new URL(url);
  console.log("sendVerificationRequest: to: %s", to);
  console.log("sendVerificationRequest: url: %s", url);
  console.log("sendVerificationRequest: host: %s", host);
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: provider.from },
      subject: `Sign in to ${host}`,
      content: [
        { type: "text/plain", value: verification_mail_text({ url, host }) },
        {
          type: "text/html",
          value: verification_mail_html({ url, host, theme }),
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Sendgrid error: ${await res.text()}`);
}

export function verification_mail_html(params: {
  url: string;
  host: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  theme: any;
}) {
  const { url, host, theme } = params;

  const escapedHost = host.replace(/\./g, "&#8203;.");

  const brandColor = theme.brandColor || "#346df1";
  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: (theme as { buttonText?: string }).buttonText || "#fff",
  };

  return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="border-radius: 5px;" bgcolor="${color.buttonBackground}"><a href="${url}"
                target="_self"
                style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${color.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${color.buttonBorder}; display: inline-block; font-weight: bold;">Sign
                in</a></td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
`;
}

// Email Text body (fallback for email clients that don't render HTML, e.g. feature phones)
export function verification_mail_text({
  url,
  host,
}: {
  url: string;
  host: string;
}) {
  return `Sign in to ${host}\n${url}\n\n`;
}
