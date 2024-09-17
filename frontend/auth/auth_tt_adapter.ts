import { httpAdapter } from "next-auth-http-adapter";
import type {
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "next-auth/adapters";
import { ofetch } from "ofetch";
import { z } from "zod";
import type { AdapterProcedure } from "./adapter_procedure";
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

export interface ExtendedAdapterUser extends AdapterUser {
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

function userSerializer(res: ExtendedAdapterUser | null) {
  if (res === null) {
    return null;
  }
  let email_verified = null;
  if (res?.emailVerified) {
    email_verified = new Date(res.emailVerified);
  }
  const serialized_user = {
    id: res?.id,
    name: res?.name,
    email: res?.email,
    image: res?.image,
    emailVerified: email_verified,
    hash: res?.hash, // ugh, "next-auth-http-adapter" will strip this
  };
  return serialized_user;
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

async function userAndSessionSerializer(
  res: Promise<{ session: AdapterSession; user: AdapterUser } | null>,
) {
  const user_and_session_obj = await res;
  const user = userSerializer(
    user_and_session_obj?.user as ExtendedAdapterUser,
  );
  const session = sessionSerializer(user_and_session_obj?.session);
  const seassion_tweaked = { user, session };
  return seassion_tweaked;
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
export async function getUserExtendedByEmail(email: string) {
  const {
    path,
    select: serialize = userSerializer,
    ...fetchOptions
  } = {
    path: `auth/get-user-by-email/${email}/`,
    method: "GET",
    select: userSerializer,
  };
  const res = await ofetch(path, {
    baseURL: _baseURL, // or any other base url
    headers: {
      // biome-ignore lint/style/noNonNullAssertion: Not acutally sure about this assertion suppression
      Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
    },
    body: null,
    ...fetchOptions,
  });
  // return await getUserExtendedByEmailSchema.parseAsync(serialize(res));
  return serialize(res);
}

export const ttHttpAdapter: ReturnType<typeof httpAdapter> = httpAdapter({
  baseURL: _baseURL, // or any other base url
  headers: {
    "x-auth-secret": process.env.NEXTAUTH_SECRET || "",
    "Content-Type": "application/json",
    // Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
    // or set any global headers to be able to authenticate your requests to your backend
  },
  // you can provide any other
  adapterProcedures: {
    createUser(user: Omit<AdapterUser, "id">): AdapterProcedure {
      return {
        path: "auth/signup/",
        method: "POST",
        body: user,
        select: userSerializer,
      };
    },
    getUserById(id: string): AdapterProcedure {
      return {
        path: `auth/get-user/${id}/`,
        method: "GET",
        select: userSerializer,
      };
    },
    getUserByEmail(email: string): AdapterProcedure {
      return {
        path: `auth/get-user-by-email/${email}/`,
        method: "GET",
        select: userSerializer,
      };
    },
    getUserByAccount(params: {
      providerAccountId: string;
      provider: string;
    }): AdapterProcedure {
      const { providerAccountId, provider } = params;
      return {
        path: `auth/get-user-by-account/${encodeURIComponent(
          provider,
        )}/${encodeURIComponent(providerAccountId)}/`,
        method: "GET",
        select: userSerializer,
      };
    },
    updateUser(
      user: Partial<AdapterUser> & Pick<AdapterUser, "id">,
    ): AdapterProcedure {
      return {
        path: "auth/update-user/",
        method: "PATCH",
        body: user,
        select: userSerializer,
      };
    },
    deleteUser(id: string): AdapterProcedure {
      return {
        path: `auth/delete-user/${id}/`,
        method: "DELETE",
      };
    },
    linkAccount(account): AdapterProcedure {
      return {
        path: "auth/link-account/",
        method: "POST",
        body: account,
      };
    },
    unlinkAccount(params: {
      provider: string;
      providerAccountId: string;
    }): AdapterProcedure {
      const { provider, providerAccountId } = params;
      return {
        path: `auth/unlink-account/${encodeURIComponent(
          provider,
        )}/${encodeURIComponent(providerAccountId)}/`,
        method: "DELETE",
      };
    },
    createSession(session: AdapterSession): AdapterProcedure {
      return {
        path: "auth/create-session/",
        method: "POST",
        body: session,
        select: sessionSerializer,
      };
    },
    getSessionAndUser(sessionToken: string): AdapterProcedure {
      return {
        path: `auth/get-session/${sessionToken}`,
        method: "GET",
        select: userAndSessionSerializer,
      };
    },
    updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">,
    ): AdapterProcedure {
      return {
        path: "auth/update-session/",
        method: "PATCH",
        body: session,
        select: sessionSerializer,
      };
    },
    deleteSession(sessionToken: string): AdapterProcedure {
      return {
        path: `auth/delete-session/${sessionToken}/`,
        method: "DELETE",
      };
    },
    createVerificationToken(
      verificationToken: VerificationToken,
    ): AdapterProcedure {
      return {
        path: "auth/create-verification-token/",
        method: "POST",
        body: verificationToken,
      };
    },
    useVerificationToken(params: {
      identifier: string;
      token: string;
    }): AdapterProcedure {
      const { identifier, token } = params;
      return {
        path: "auth/use-verification-token/",
        method: "POST",
        body: { identifier, token },
        select: verificationTokenSerializer,
      };
    },
  },
});
