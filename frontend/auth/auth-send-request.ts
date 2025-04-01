import type { EmailConfig } from "next-auth/providers";

// token: string; theme: Theme; request: Request; }) => Awaitable<void>
export async function sendVerificationRequest(params: {
  identifier: string;
  url: string;
  expires: Date;
  provider: EmailConfig;
  theme: { brandColor?: string; buttonText?: string };
  token: string;
  request: Request;
}) {
  const {
    identifier: to,
    provider,
    url,
    theme,
  }: {
    identifier: string;
    provider: EmailConfig;
    url: string;
    theme: { brandColor?: string; buttonText?: string };
  } = params;
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
  theme: { brandColor?: string; buttonText?: string };
}) {
  const { url, theme } = params;

  const { searchParams } = new URL(url);
  const token = searchParams.get("token");

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
        style="padding: 10px; font-size: 22px; font-weight: bold; line-height: 25px; font-family: Helvetica, Arial, sans-serif; color: ${color.text}; border-bottom: 1px solid #eee;">
        TuneTrees Signup Verification
      </td>
    </tr>

    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif">
                You may invoke this sign-in link to verify your email address:
                <a href="${url}" target="_self">${url}</a></td>
          </tr>
          <tr>
            <td align="center">
              <p style="font-size: 18px; font-family: Helvetica, Arial, sans-serif">
              Or copy and paste (or type) this code into the verify-request page: ${token}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        If you did not request this email by signing up for TuneTrees, you may safely ignore it.
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
  const { searchParams } = new URL(url);
  const token = searchParams.get("token");
  return `Paste this link into your browser to ${host}\n${url}, or use this code as a one-time password: ${token}\n\n`;
}
