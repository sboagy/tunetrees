/**
 * TuneTrees - WebAuthn/Passkey Authentication Provider
 *
 * Copyright (c) 2024 TuneTrees Software
 */

import type { Provider } from "next-auth/providers";

export interface WebAuthnProviderConfig {
  id: string;
  name: string;
  type: "credentials";
  credentials: {
    assertion: { label: string; type: string };
  };
  authorize: (credentials: any) => Promise<any>;
}

export default function WebAuthnProvider(): Provider {
  return {
    id: "webauthn",
    name: "Passkey",
    type: "credentials",
    credentials: {
      assertion: {
        label: "WebAuthn Assertion",
        type: "hidden",
      },
    },
    async authorize(credentials) {
      if (!credentials?.assertion) {
        return null;
      }

      try {
        // Verify WebAuthn assertion with backend
        const response = await fetch("/api/auth/verify-webauthn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assertion: credentials.assertion,
          }),
        });

        if (response.ok) {
          const user = await response.json();
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }
      } catch (error) {
        console.error("WebAuthn verification error:", error);
      }

      return null;
    },
  };
}
