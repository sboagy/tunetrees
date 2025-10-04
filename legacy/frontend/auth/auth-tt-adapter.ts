// import type { Awaitable } from "next-auth/types";

import type {
  Adapter,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from "next-auth/adapters";

import type {
  IAccount,
  ISession,
  IUser,
  IVerificationToken,
} from "@/app/(main)/pages/practice/types";
import type { AdapterUser } from "next-auth/adapters";
import { z } from "zod";
import {
  createSessionInDatabase,
  createUserInDatabase,
  createVerificationTokenInDatabase,
  deleteSessionFromDatabase,
  deleteUserFromDatabase,
  getSessionAndUserFromDatabase,
  getUserByAccountFromDatabase,
  getUserByEmailFromDatabase,
  getUserExtendedByEmailFromDb,
  getUserFromDatabase,
  linkAccountInDatabase,
  unlinkAccountFromDatabase,
  updateSessionInDatabase,
  updateUserInDatabase,
  useVerificationTokenFromDatabase,
} from "./auth-fetch";
import {
  createSessionSchema,
  createUserSchema,
  createVerificationTokenSchema,
  deleteUserSchema,
  getUserByEmailSchema,
  getUserSchema,
  linkAccountSchema,
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

const userExtendedAdapterSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  hash: z.string(),
  emailVerified: z.date().nullable(),
  name: z.string().optional().nullable(),
  image: z.string().optional(),
  view_settings: z.string().optional(),
  phone: z.string().optional().nullable(),
  phoneVerified: z.date().optional().nullable(),
  acceptableDelinquencyWindow: z.number().optional(),
});

export const getUserExtendedByEmailSchema =
  userExtendedAdapterSchema.nullable();

export const getSessionAndUserSchema = z
  .object({
    session: adapterSessionSchema,
    user: userAdapterSchema,
  })
  .nullable();

export interface IExtendedAdapterUser extends AdapterUser {
  hash?: string | null;
  view_settings?: string;
  image?: string;
  phone?: string | null;
  phoneVerified?: Date | null;
  acceptableDelinquencyWindow?: number;
}

export interface IAdapterUserAndSession {
  user: AdapterUser;
  session: AdapterSession;
}

function userSerializer(res: IUser | null): IExtendedAdapterUser | null {
  if (res === null) {
    return null;
  }
  let emailVerified = null;
  if (res?.email_verified) {
    emailVerified = new Date(res.email_verified);
  }
  let phoneVerified = null;
  if (res?.phone_verified) {
    phoneVerified = new Date(res.phone_verified);
  }
  const serializedUser = {
    id: res?.id?.toString() ?? "",
    name: res?.name ?? "",
    email: res?.email ?? "",
    image: res?.image,
    emailVerified: emailVerified,
    hash: res?.hash, // ugh, "next-auth-http-adapter" will strip this
    phone: res?.phone,
    phoneVerified: phoneVerified,
    acceptableDelinquencyWindow: res?.acceptable_delinquency_window,
  };
  return serializedUser;
}

function sessionSerializer(res: ISession | null | undefined): AdapterSession {
  let expires = null;
  if (res?.expires) {
    expires = new Date(res.expires);
  }
  if (!expires || !res?.session_token || !res?.user_id) {
    throw new Error("Invalid session data");
  }
  return {
    expires: expires,
    sessionToken: res?.session_token,
    userId: res?.user_id.toString(),
  };
}

function userAndSessionSerializer(
  res: { session: ISession; user: IUser } | null,
): IAdapterUserAndSession | null {
  if (!res) {
    return null;
  }
  const user = userSerializer(res?.user);
  const session = sessionSerializer(res?.session);
  if (!user) {
    console.log(
      "===> auth-tt-adapter.ts:116 ~ userAndSessionSerializer, user not found, error?",
    );
    return null;
  }
  const seassionTweaked = { user, session };
  return seassionTweaked;
}

function verificationTokenSerializer(
  res: IVerificationToken | null | undefined,
): VerificationToken | null {
  let expires = null;
  if (res?.expires) {
    expires = new Date(res.expires);
  }

  if (!expires || !res?.identifier || !res?.token) {
    throw new Error("Invalid verification token data");
  }

  return {
    identifier: res?.identifier,
    token: res?.token,
    expires: expires,
  };
}

// Removed _baseURL export since it's now defined locally in auth-fetch.ts
// which is the only place that should be making direct API calls to the backend

// The createUser method of ttHttpAdapter will strip the hash off,
// unfortunately, which we need for authentication.  So use this
// custom function instead.
export async function getUserExtendedByEmail(
  email: string,
): Promise<IExtendedAdapterUser | null> {
  const payload = await getUserExtendedByEmailFromDb(email);
  const serialized = userSerializer(payload);

  const parsed = getUserExtendedByEmailSchema.parse(serialized);
  return parsed;
}

function createTuneTreesHttpAdapter(): Adapter {
  return {
    async createUser(user) {
      console.log("===> auth-tt-adapter.ts:164 ~ createUser");
      try {
        const user4db: IUser = {
          email: user.email,
          name: user.name ?? "",
          image: user.image ?? "",
          email_verified: user.emailVerified?.toISOString(),
        };
        if ("hash" in user) {
          user4db.hash = user.hash as string;
        }
        if ("image" in user) {
          user4db.image = user.image as string;
        }
        const userExt = user as IExtendedAdapterUser;
        if (userExt.phone) {
          user4db.phone = userExt.phone;
        }
        if (userExt.phoneVerified) {
          user4db.phone_verified = userExt.phoneVerified.toISOString();
        }
        if (userExt.acceptableDelinquencyWindow) {
          user4db.acceptable_delinquency_window =
            userExt.acceptableDelinquencyWindow;
        }

        const payload = await createUserInDatabase(user4db);
        const serialized = userSerializer(payload);

        // In Zod, the parse method will validate the input object against
        // the schema and remove any fields that are not explicitly defined
        // in the schema. This means that the resulting object will only
        // contain the fields specified in createUserSchema.
        return createUserSchema.parse(serialized) as AdapterUser;
      } catch (error) {
        console.error("===> auth-tt-adapter.ts:173 ~ ", error);
        throw new Error("User creation failed");
      }
    },
    async getUser(id) {
      console.log("===> auth-tt-adapter.ts:183 ~ getUser");
      try {
        const payload = await getUserFromDatabase(id);
        if (!payload) {
          return null;
        }
        const serialized = userSerializer(payload);
        return getUserSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async getUserByEmail(email) {
      console.log("===> auth-tt-adapter.ts:203 ~ email");
      try {
        const payload = await getUserByEmailFromDatabase(email);
        if (!payload) {
          return null;
        }
        const serialized = userSerializer(payload);
        return getUserByEmailSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async getUserByAccount({ providerAccountId, provider }) {
      console.log("===> auth-tt-adapter.ts:222 ~ getUserByAccount");
      try {
        const payload = await getUserByAccountFromDatabase(
          provider,
          providerAccountId,
        );
        if (!payload) {
          return null;
        }
        const serialized = userSerializer(payload);
        return getUserSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async updateUser(user) {
      console.log("===> auth-tt-adapter.ts:247 ~ updateUser");

      try {
        const user4db: IUser = {};
        if (user.emailVerified) {
          user4db.email_verified = user.emailVerified?.toISOString();
        }
        if (user.email) {
          user4db.email = user.email;
        }
        if (user.name) {
          user4db.name = user.name;
        }
        if (user.image) {
          user4db.image = user.image;
        }
        const userExt = user as IExtendedAdapterUser;
        if (userExt.hash) {
          user4db.hash = userExt.hash;
        }
        if (userExt.phone) {
          user4db.phone = userExt.phone;
        }
        if (userExt.phoneVerified) {
          user4db.phone_verified = userExt.phoneVerified.toISOString();
        }
        if (userExt.acceptableDelinquencyWindow) {
          user4db.acceptable_delinquency_window =
            userExt.acceptableDelinquencyWindow;
        }
        const isServer = typeof window === "undefined";
        console.log("===> auth-tt-adapter.ts:268 ~ isServer", isServer);
        const payload = await updateUserInDatabase(Number(user.id), user4db);
        const serialized = userSerializer(payload);
        return updateUserSchema.parse(serialized) as AdapterUser;
      } catch (error) {
        console.error("===> auth-tt-adapter.ts:251 ~ ", error);
        throw new Error("User creation failed");
      }
    },
    async deleteUser(userId) {
      console.log("===> auth-tt-adapter.ts:266 ~ deleteUser");
      try {
        const payload = await deleteUserFromDatabase(userId);
        if (!payload) {
          return null;
        }
        return deleteUserSchema.parse(payload);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async linkAccount(account) {
      console.log("===> auth-tt-adapter.ts:285 ~ linkAccount");
      try {
        const account4DB: IAccount = {
          provider_account_id: account.providerAccountId,
          provider: account.provider,
          user_id: String(account.userId),
          type: account.type as string,
          ...(account.scope && { scope: account.scope }),
          ...(account.accessToken && {
            access_token: account.accessToken as string,
          }),
          ...(account.tokenType && { token_type: account.tokenType as string }),
          ...(account.idToken && { id_token: account.idToken as string }),
          ...(account.expires && { expires_at: Number(account.expires) }),
          ...(account.sessionState && {
            session_state: account.sessionState as string, // need to serialize object to string?
          }),
          ...(account.refreshToken && {
            refresh_token: account.refreshToken as string, // need to serialize object to string?
          }),
        };
        const payload = await linkAccountInDatabase(account4DB);
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
      console.log("===> auth-tt-adapter.ts:309 ~ unlinkAccount");
      try {
        const payload = await unlinkAccountFromDatabase(providerAccountId);
        // const parsedRes = unlinkAccountSchema.parse(payload);
        console.log("===> auth-tt-adapter2.ts:252 ~ ", payload);
        return;
      } catch (error) {
        console.log("===> auth-tt-adapter.ts:312 ~ ", error);
        throw new Error("unlink account failed");
      }
    },
    async createSession({ sessionToken, userId, expires }) {
      console.log("===> auth-tt-adapter.ts:331 ~ createSession");
      try {
        const session = {
          sessionToken,
          userId,
          expires,
        };
        const payload = await createSessionInDatabase(session);
        const serialized = sessionSerializer(payload);
        const parsedRes = createSessionSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.log("===> auth-tt-adapter.ts:336 ~ ", error);
        throw new Error("create session failed");
      }
    },
    async getSessionAndUser(sessionToken) {
      console.log("===> auth-tt-adapter.ts:355 ~ getSessionAndUser");
      try {
        const payload = await getSessionAndUserFromDatabase(sessionToken);
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
    async updateSession({ sessionToken, userId, expires }: AdapterSession) {
      console.log("===> auth-tt-adapter.ts:378 ~ updateSession");
      try {
        const session: ISession = {
          session_token: sessionToken,
          expires: expires.toISOString(),
          user_id: Number(userId),
        };
        const payload = await updateSessionInDatabase(session);
        const serialized = sessionSerializer(payload);
        return updateSessionSchema.parse(serialized);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async deleteSession(sessionToken) {
      console.log("===> auth-tt-adapter.ts:402 ~ deleteSession");
      try {
        const payload = await deleteSessionFromDatabase(sessionToken);
        if (!payload) {
          return null;
        }
        return null;
        // return deleteSessionSchema.parse(payload);
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async createVerificationToken({ identifier, expires, token }) {
      console.log("===> auth-tt-adapter.ts:424 ~ createVerificationToken");
      try {
        const verificationToken = {
          identifier,
          expires,
          token,
        };
        const payload =
          await createVerificationTokenInDatabase(verificationToken);
        const serialized = verificationTokenSerializer(payload);
        const parsedRes = createVerificationTokenSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    async useVerificationToken({ identifier, token }) {
      console.log("===> auth-tt-adapter.ts:449 ~ useVerificationToken");
      try {
        const verificationToken = {
          identifier,
          token,
        };
        const payload =
          await useVerificationTokenFromDatabase(verificationToken);
        const serialized = verificationTokenSerializer(payload);
        const parsedRes = useVerificationRequestSchema.parse(serialized);
        return parsedRes;
      } catch (error) {
        console.error(error);
        return null;
      }
    },

    // ===== It's not clear if I need the following methods for
    // strategy: "database", so they are commented out for now. =====
    //   async getAccount(provider, providerAccountId) {
    //     console.log("===> auth-tt-adapter.ts:475 ~ getAccount");
    //     console.log(
    //       "===> auth-tt-adapter2.ts:368 ~ ",
    //       provider,
    //       providerAccountId,
    //     );

    //     return await Promise.resolve(null);
    //   },

    //   async getAuthenticator(id) {
    //     console.log("===> auth-tt-adapter.ts:486 ~ getAuthenticator");
    //     console.log("===> auth-tt-adapter2.ts:379 ~ ", id);
    //     return await Promise.resolve(null);
    //   },

    //   async createAuthenticator(
    //     authenticator: AdapterAuthenticator,
    //   ): Promise<AdapterAuthenticator> {
    //     console.log(
    //       "===> auth-tt-adapter2.ts:383 ~ createAuthenticator",
    //       authenticator,
    //     );
    //     return await Promise.resolve(authenticator);
    //   },

    //   async listAuthenticatorsByUserId(userId) {
    //     console.log(
    //       "===> auth-tt-adapter2.ts:395 ~ listAuthenticatorsByUserId",
    //       userId,
    //     );
    //     return await Promise.resolve([]);
    //   },

    //   async updateAuthenticatorCounter(
    //     credentialID: AdapterAuthenticator["credentialID"],
    //     newCounter: AdapterAuthenticator["counter"],
    //   ): Promise<AdapterAuthenticator> {
    //     console.log("===> auth-tt-adapter.ts:491 ~ updateAuthenticatorCounter");
    //     return await Promise.resolve({
    //       credentialID,Í
    //       counter: newCounter,
    //     } as AdapterAuthenticator);
    //   },
  };
}

export const ttHttpAdapter = createTuneTreesHttpAdapter();
