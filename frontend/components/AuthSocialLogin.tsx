"use client";

import type { ProviderDict, ProviderMap } from "@/auth";
import { doSocialLogin2 } from "@/auth/social-login";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "./ui/loading-button";
import { useState } from "react";

const providerLogoPath = "https://authjs.dev/img/providers";

export function SocialLoginButtons(providerMap: ProviderMap) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialLogin = async (provider: ProviderDict) => {
    setLoadingProvider(provider.id);
    try {
      await doSocialLogin2(provider);
    } catch (error) {
      console.error("Social login error:", error);
    } finally {
      setLoadingProvider(null);
    }
  };

  return (
    <>
      {Object.values(providerMap)
        .filter(
          (provider) =>
            provider.id !== "credentials" &&
            provider.id !== "sendgrid" &&
            provider.id !== "token-credential",
        )
        .map((provider) => (
          <LoadingButton
            key={provider.id}
            type="button"
            variant="secondary"
            loading={loadingProvider === provider.id}
            disabled={loadingProvider !== null}
            onClick={() => void handleSocialLogin(provider)}
            data-testid={`social-login-${provider.id}`}
          >
            <>
              <img
                loading="lazy"
                height={24}
                width={24}
                id="provider-logo"
                src={`${providerLogoPath}/${provider.id}.svg`}
                alt={provider.name}
              />
              <Label className="ml-3">
                {loadingProvider === provider.id
                  ? "Connecting..."
                  : provider.name}
              </Label>
            </>
          </LoadingButton>
        ))}
    </>
  );
}
