/**
 * TuneTrees - SMS Authentication Provider
 *
 * Copyright (c) 2024 TuneTrees Software
 */

import type { Provider } from "next-auth/providers";

export interface SMSProviderConfig {
  id: string;
  name: string;
  type: "credentials";
  credentials: {
    phone: { label: string; type: string; placeholder: string };
    code: { label: string; type: string; placeholder: string };
  };
  authorize: (credentials: any) => Promise<any>;
  sendVerificationRequest?: (params: {
    identifier: string;
    url: string;
    expires: Date;
    provider: SMSProviderConfig;
    token: string;
  }) => Promise<void>;
}

export default function SMSProvider(options: {
  apiKey?: string;
  from?: string;
  sendVerificationRequest?: SMSProviderConfig["sendVerificationRequest"];
}): Provider {
  return {
    id: "sms",
    name: "SMS",
    type: "credentials",
    credentials: {
      phone: {
        label: "Phone Number",
        type: "tel",
        placeholder: "+1234567890",
      },
      code: {
        label: "Verification Code",
        type: "text",
        placeholder: "123456",
      },
    },
    async authorize(credentials) {
      if (!credentials?.phone || !credentials?.code) {
        return null;
      }

      try {
        // Verify SMS code with backend
        const response = await fetch("/api/auth/verify-sms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: credentials.phone,
            code: credentials.code,
          }),
        });

        if (response.ok) {
          const user = await response.json();
          return {
            id: user.id,
            phone: user.phone,
            name: user.name,
          };
        }
      } catch (error) {
        console.error("SMS verification error:", error);
      }

      return null;
    },
    sendVerificationRequest: options.sendVerificationRequest,
  };
}
