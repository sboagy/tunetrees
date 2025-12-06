// SMS Provider for NextAuth.js
// This integrates SMS verification with the NextAuth.js authentication flow

import type { User } from "next-auth";
import type { CredentialsConfig } from "next-auth/providers/credentials";

export interface ISMSProvider extends CredentialsConfig {
  id: "sms";
  name: "SMS";
  type: "credentials";
  credentials: {
    phone: { label: "Phone"; type: "tel" };
    code: { label: "Code"; type: "text" };
  };
  authorize: (
    credentials: Partial<Record<string, unknown>>,
    request: Request,
  ) => Promise<User | null>;
}

export function SMSProvider(config: { apiUrl?: string }): ISMSProvider {
  return {
    id: "sms",
    name: "SMS",
    type: "credentials",
    credentials: {
      phone: { label: "Phone", type: "tel" },
      code: { label: "Code", type: "text" },
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async authorize(credentials, request) {
      const phone = credentials?.phone as string | undefined;
      const code = credentials?.code as string | undefined;

      if (!phone || !code) {
        return null;
      }

      try {
        const apiUrl =
          config.apiUrl ||
          process.env.NEXT_PUBLIC_API_URL ||
          "http://localhost:8000";

        const response = await fetch(`${apiUrl}/sms/verify-login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phone,
            code: code,
          }),
        });

        if (!response.ok) {
          console.error("SMS verification failed:", response.status);
          return null;
        }

        const user = await response.json();

        if (user?.id) {
          return {
            id: user.id,
            phone: user.phone,
            name: user.name,
            email: user.email,
          };
        }

        return null;
      } catch (error) {
        console.error("SMS authentication error:", error);
        return null;
      }
    },
  };
}

export default SMSProvider;
