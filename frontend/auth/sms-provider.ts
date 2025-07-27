// SMS Provider for NextAuth.js
// This integrates SMS verification with the NextAuth.js authentication flow

import { Provider } from "next-auth/providers";

interface ISMSProfile {
  id: string;
  phone: string;
  name?: string;
  email?: string;
}

interface ISMSAccount {
  provider: "sms";
  type: "sms";
  providerAccountId: string;
}

interface ISMSCredentials {
  phone: string;
  code: string;
}

export interface ISMSProvider extends Provider {
  id: "sms";
  name: "SMS";
  type: "credentials";
  credentials: {
    phone: { label: "Phone"; type: "tel" };
    code: { label: "Code"; type: "text" };
  };
  authorize: (
    credentials: ISMSCredentials | undefined,
  ) => Promise<ISMSProfile | null>;
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
    async authorize(credentials) {
      if (!credentials?.phone || !credentials?.code) {
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
            phone: credentials.phone,
            code: credentials.code,
          }),
        });

        if (!response.ok) {
          console.error("SMS verification failed:", response.status);
          return null;
        }

        const user = await response.json();

        if (user && user.id) {
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
