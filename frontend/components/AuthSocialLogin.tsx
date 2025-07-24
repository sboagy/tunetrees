"use client";
import type { ProviderMap, ProviderDict } from "@/auth";
import { doSocialLogin2 } from "@/auth/social-login";
import { Label } from "@/components/ui/label";
import { Button } from "./ui/button";
import { useState } from "react";
// import { getSocialLoginURLs } from "@/auth/social_login";
// import { doSocialLogin2 } from "@/auth/social_login";

const providerLogoPath = "https://authjs.dev/img/providers";

export function SocialLoginButtons(providerMap: ProviderMap) {
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleSocialLogin = async (
    providerId: string,
    provider: ProviderDict,
  ) => {
    setLoadingProvider(providerId);
    try {
      await doSocialLogin2(provider);
    } catch (error) {
      console.error("Social login error:", error);
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
          <Button
            key={provider.id}
            type="button"
            variant="secondary"
            loading={loadingProvider === provider.id}
            loadingText={`Signing in with ${provider.name}...`}
            disabled={loadingProvider !== null}
            onClick={() => {
              void handleSocialLogin(provider.id, provider);
            }}
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
              <Label className="ml-3">{provider.name}</Label>
            </>
          </Button>
        ))}
    </>
  );
}
