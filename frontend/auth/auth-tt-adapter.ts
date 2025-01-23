// import type { Awaitable } from "next-auth/types";

import type { Adapter, AdapterAccount } from "next-auth/adapters";

import type {
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import { z } from "zod";
import {
  createSessionSchema,
  createUserSchema,
  createVerificationTokenSchema,
  deleteSessionSchema,
  deleteUserSchema,
  getUserByEmailSchema,
  getUserSchema,
  linkAccountSchema,
  unlinkAccountSchema,
  updateSessionSchema,
  updateUserSchema,
  useVerificationRequestSchema,
} from "./http-adapter/validation";
export const adapterSessionSchema = z.object({
  expires: z.date(),
  sessionToken: z.string(),
  userId: z.string(),
});

const userAdapterSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.date().nullable(),
  name: z.string().optional().nullable(),
  image: z.string().optional(),
});

export const getSessionAndUserSchema = z
  .object({
    session: adapterSessionSchema,
    user: userAdapterSchema,
  })
  .nullable();

export interface IExtendedAdapterUser extends AdapterUser {
  hash?: string | null;
  view_settings?: string;
}

const userExtendedAdapterSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  hash: z.string(),
  emailVerified: z.date().nullable(),
  name: z.string().optional().nullable(),
  image: z.string().optional(),
  view_settings: z.string().optional(),
});

export const getUserExtendedByEmailSchema =
  userExtendedAdapterSchema.nullable();

function userSerializer(res: IExtendedAdapterUser | null) {
  if (res === null) {
    return null;
  }
  let emailVerified = null;
  if (res?.emailVerified) {
    emailVerified = new Date(res.emailVerified);
  }
  const serializedUser = {
    id: res?.id,
    name: res?.name,
    email: res?.email,
    image: res?.image,
    emailVerified: emailVerified,
    hash: res?.hash, // ugh, "next-auth-http-adapter" will strip this
  };
  return serializedUser;
}

function sessionSerializer(res: AdapterSession | null | undefined) {
  let expires = null;
  if (res?.expires) {
    expires = new Date(res.expires);
  }
  return {
    expires: expires,
    sessionToken: res?.sessionToken,
    userId: res?.userId,
  };
}

function userAndSessionSerializer(
  res: { session: AdapterSession; user: AdapterUser } | null,
) {
  if (!res) {
    return null;
  }
  const user = userSerializer(res?.user as IExtendedAdapterUser);
  const session = sessionSerializer(res?.session);
  const seassionTweaked = { user, session };
  return seassionTweaked;
  // try{
  //   let parsed = await getSessionAndUserSchema.parseAsync(seassion_tweaked);
  //   console.log("userAndSessionSerializer, parsed:");
  //   console.log(parsed);
  //   return parsed;
  // }
  // catch(e){
  //   console.error(e);
  //   throw e
  // }
}

function verificationTokenSerializer(
  res: VerificationToken | null | undefined,
) {
  let expires = null;
  if (res?.expires) {
    expires = new Date(res.expires);
  }

  return {
    identifier: res?.identifier,
    token: res?.token,
    expires: expires,
  };
}

const _baseURL = process.env.NEXT_BASE_URL;

// The createUser method of ttHttpAdapter will strip the hash off,
// unfortunately, which we need for authentication.  So use this
// custom function instead.
export async function getUserExtendedByEmail(
  email: string,
): Promise<IExtendedAdapterUser | null> {
  const path = `${_baseURL}/auth/get-user-by-email/${email}`;
  const res = await fetch(path, {
    method: "GET",
    headers: {
      // biome-ignore lint/style/noNonNullAssertion: Not actually sure about this assertion suppression
      Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
      Accept: "application/json",
    },
  });
  const payload = await res.json();
  const serialized = userSerializer(payload);

  const parsed = getUserExtendedByEmailSchema.parse(serialized);
  return parsed;
}

export function ttHttpAdapter(): Adapter {
  return {
    async createUser(user) {
      try {
        const res = await fetch(`${_baseURL}/auth/signup/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(user),
        });
        const payload = await res.json();
        const serialized = userSerializer(payload);
        return createUserSchema.parse(serialized) as AdapterUser;
      } catch (error) {
        console.error("===> auth-tt-adapter.ts:173 ~ ", error);
        throw new Error("User creation failed");
      }
    },
    async getUser(id) {
      try {
        const res = await fetch(`${_baseURL}/auth/get-user/${id}/`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });
        if (!res) {
          return null;
        }
        const payload = await res.json();
        const serialized = userSerializer(payload);
        return getUserSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async getUserByEmail(email) {
      try {
        const res = await fetch(`${_baseURL}/auth/get-user-by-email/${email}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });
        if (!res) {
          return null;
        }
        const payload = await res.json();
        const serialized = userSerializer(payload);
        return getUserByEmailSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async getUserByAccount({ providerAccountId, provider }) {
      try {
        const res = await fetch(
          `${_baseURL}/auth/get-user-by-account/${encodeURIComponent(
            provider,
          )}/${encodeURIComponent(providerAccountId)}/`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );
        if (!res) {
          return null;
        }
        const payload = await res.json();
        const serialized = userSerializer(payload);
        return getUserSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async updateUser(user) {
      try {
        const res = await fetch(`${_baseURL}/auth/update-user/`, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(user),
        });
        const payload = await res.json();
        const serialized = userSerializer(payload);
        return updateUserSchema.parse(serialized) as AdapterUser;
      } catch (error) {
        console.error("===> auth-tt-adapter.ts:251 ~ ", error);
        throw new Error("User creation failed");
      }
    },
    async deleteUser(userId) {
      try {
        const res = await fetch(`${_baseURL}/auth/delete-user/${userId}/`, {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        });
        if (!res) {
          return null;
        }
        const payload = await res.json();
        return deleteUserSchema.parse(payload);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async linkAccount(account) {
      try {
        const res = await fetch(`${_baseURL}/auth/link-account/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(account),
        });
        const payload = await res.json();
        const parsedRes = linkAccountSchema.parse(payload);
        if (parsedRes && parsedRes.type === "credentials") {
          parsedRes.type = "oauth"; // or any valid AdapterAccountType
        }
        return parsedRes as AdapterAccount | null | undefined;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async unlinkAccount({
      providerAccountId,
    }: Pick<AdapterAccount, "providerAccountId" | "provider">) {
      try {
        const res = await fetch(
          `${_baseURL}/auth/unlink-account/${providerAccountId}/`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
            },
          },
        );
        const payload = await res.json();
        const parsedRes = unlinkAccountSchema.parse(payload);
        console.log("===> auth-tt-adapter2.ts:252 ~ ", parsedRes);
        return;
      } catch (error) {
        console.log("===> auth-tt-adapter.ts:312 ~ ", error);
        throw new Error("unlink account failed");
      }
    },
    async createSession({ sessionToken, userId, expires }) {
      try {
        const session = {
          sessionToken,
          userId,
          expires,
        };
        const res = await fetch(`${_baseURL}/auth/create-session/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(session),
        });
        const payload = await res.json();
        const serialized = sessionSerializer(payload);
        const parsedRes = createSessionSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.log("===> auth-tt-adapter.ts:336 ~ ", error);
        throw new Error("create session failed");
      }
    },
    async getSessionAndUser(sessionToken) {
      try {
        const res = await fetch(
          `${_baseURL}/auth/get-session/${sessionToken}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );
        const payload = await res.json();
        if (!payload) {
          return null;
        }
        const serialized = userAndSessionSerializer(payload);
        return getSessionAndUserSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async updateSession({ sessionToken, expires, userId }) {
      try {
        const session = {
          sessionToken,
          expires,
          userId,
        };
        const res = await fetch(`${_baseURL}/auth/update-session/`, {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(session),
        });
        const payload = await res.json();
        const serialized = sessionSerializer(payload);
        return updateSessionSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async deleteSession(sessionToken) {
      try {
        const res = await fetch(
          `${_baseURL}/auth/delete-session/${sessionToken}/`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
            },
          },
        );
        if (!res) {
          return null;
        }
        const payload = await res.json();
        return deleteSessionSchema.parse(payload);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async createVerificationToken({ identifier, expires, token }) {
      try {
        const verificationToken = {
          identifier,
          expires,
          token,
        };
        const res = await fetch(`${_baseURL}/auth/create-verification-token/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(verificationToken),
        });
        const payload = await res.json();
        const serialized = verificationTokenSerializer(payload);
        const parsedRes = createVerificationTokenSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async useVerificationToken({ identifier, token }) {
      try {
        const verificationToken = {
          identifier,
          token,
        };
        const res = await fetch(`${_baseURL}/auth/use-verification-token/`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(verificationToken),
        });
        const payload = await res.json();
        const serialized = verificationTokenSerializer(payload);
        const parsedRes = useVerificationRequestSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.error(error);
        return null;
      }
    },

    // =========================
    // async getAccount(provider, providerAccountId) {
    //   console.log(
    //     "===> auth-tt-adapter2.ts:368 ~ ",
    //     provider,
    //     providerAccountId,
    //   );

    //   return await Promise.resolve(null);
    // },

    // async getAuthenticator(id) {
    //   console.log("===> auth-tt-adapter2.ts:379 ~ ", id);
    //   return await Promise.resolve(null);
    // },

    // async createAuthenticator(
    //   authenticator: AdapterAuthenticator,
    // ): Promise<AdapterAuthenticator> {
    //   console.log("===> auth-tt-adapter2.ts:383 ~ ", authenticator);
    //   return await Promise.resolve(authenticator);
    // },

    // async listAuthenticatorsByUserId(userId) {
    //   console.log("===> auth-tt-adapter2.ts:395 ~ ", userId);
    //   return await Promise.resolve([]);
    // },

    // async updateAuthenticatorCounter(
    //   credentialID: AdapterAuthenticator["credentialID"],
    //   newCounter: AdapterAuthenticator["counter"],
    // ): Promise<AdapterAuthenticator> {
    //   return await Promise.resolve({
    //     credentialID,
    //     counter: newCounter,
    //   } as AdapterAuthenticator);
    // },
  };
}
