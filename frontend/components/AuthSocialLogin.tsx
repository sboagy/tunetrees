import type { ProviderMap } from "@/auth";
import { doSocialLogin2 } from "@/auth/social-login";
import { Label } from "@/components/ui/label";
import { Button } from "./ui/button";
// import { getSocialLoginURLs } from "@/auth/social_login";
// import { doSocialLogin2 } from "@/auth/social_login";

const providerLogoPath = "https://authjs.dev/img/providers";

export function SocialLoginButtons(providerMap: ProviderMap) {
  // const signInURLs: { [key: string]: string } = {};

  return (
    <>
      {Object.values(providerMap)
        .filter(
          (provider) =>
            provider.id !== "credentials" && provider.id !== "sendgrid",
        )
        .map((provider) => (
          <form key={provider.id} action={() => void doSocialLogin2(provider)}>
            <Button type="submit" variant="secondary">
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
          </form>
        ))}
    </>
  );
}
