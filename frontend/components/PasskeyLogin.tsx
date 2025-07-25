"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Fingerprint, Key } from "lucide-react";

interface IUser {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
}

interface IPasskeyLoginProps {
  onSuccess?: (user: IUser) => void;
}

export function PasskeyLogin({ onSuccess }: IPasskeyLoginProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const authenticate = async () => {
    if (!window.PublicKeyCredential) {
      toast({
        title: "Not Supported",
        description: "Passkeys are not supported in this browser",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Get authentication options from backend
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const optionsResponse = await fetch(
        `${backendUrl}/webauthn/authentication/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!optionsResponse.ok) {
        throw new Error("Failed to get authentication options");
      }

      const { data } = await optionsResponse.json();
      const options = data.options;

      // Convert challenge and credential IDs from base64
      const challengeBuffer = new Uint8Array(
        atob(options.challenge)
          .split("")
          .map((char) => char.charCodeAt(0)),
      );

      const allowCredentials = options.allowCredentials?.map((cred: any) => ({
        ...cred,
        id: new Uint8Array(
          atob(cred.id)
            .split("")
            .map((char) => char.charCodeAt(0)),
        ),
      }));

      // Start WebAuthn authentication
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: challengeBuffer,
          timeout: options.timeout,
          rpId: options.rpId,
          allowCredentials,
          userVerification: options.userVerification,
        },
      })) as PublicKeyCredential;

      if (!credential) {
        throw new Error("Authentication was cancelled");
      }

      // Convert credential response to format expected by backend
      const response = credential.response as AuthenticatorAssertionResponse;

      const authData = new Uint8Array(response.authenticatorData);
      const clientDataJSON = new TextDecoder().decode(response.clientDataJSON);
      const signature = new Uint8Array(response.signature);
      const userHandle = response.userHandle
        ? new Uint8Array(response.userHandle)
        : null;

      const credentialForBackend = {
        id: credential.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        response: {
          authenticatorData: btoa(String.fromCharCode(...authData)),
          clientDataJSON: btoa(clientDataJSON),
          signature: btoa(String.fromCharCode(...signature)),
          userHandle: userHandle
            ? btoa(String.fromCharCode(...userHandle))
            : null,
        },
        type: credential.type,
      };

      // Verify with backend
      const verifyResponse = await fetch("/api/auth/verify-webauthn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ assertion: credentialForBackend }),
      });

      if (verifyResponse.ok) {
        const user = await verifyResponse.json();
        toast({
          title: "Success",
          description: "Successfully authenticated with passkey",
        });
        onSuccess?.(user);
      } else {
        const error = await verifyResponse.json();
        toast({
          title: "Error",
          description: error.error || "Passkey authentication failed",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Passkey authentication error:", error);
      if (error.name === "NotAllowedError") {
        toast({
          title: "Authentication Cancelled",
          description: "Passkey authentication was cancelled",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to authenticate with passkey",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Passkey Authentication
        </CardTitle>
        <CardDescription>
          Use your passkey (fingerprint, face, or security key) to sign in
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={authenticate} disabled={loading} className="w-full">
          <Key className="h-4 w-4 mr-2" />
          {loading ? "Authenticating..." : "Sign in with Passkey"}
        </Button>
      </CardContent>
    </Card>
  );
}
