import {httpAdapter} from "next-auth-http-adapter";
import {AdapterSession, AdapterUser} from "next-auth/adapters";
import {z} from "zod";
import {ofetch} from "ofetch";

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
  hash: string;
}

const userExtendedAdapterSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  hash: z.string(),
  emailVerified: z.date().nullable(),
  name: z.string().optional().nullable(),
  image: z.string().optional(),
});

export const getUserExtendedByEmailSchema = userExtendedAdapterSchema.nullable();


function userSerializer(res: ExtendedAdapterUser | null) {
  let email_verified = null;
  if (res?.emailVerified) {
    email_verified = new Date(res.emailVerified);
  }
  let serialized_user = {
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
    res: Promise<{ session: AdapterSession; user: AdapterUser } | null>
) {
  const user_and_session_obj = await res
  const user = userSerializer(
      (user_and_session_obj?.user) as ExtendedAdapterUser
  );
  const session = sessionSerializer(user_and_session_obj?.session);
  const seassion_tweaked = {user, session};
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
      Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
    },
  });
  return await getUserExtendedByEmailSchema.parseAsync(serialize(res));
}

export const ttHttpAdapter = httpAdapter({
  baseURL: _baseURL, // or any other base url
  headers: {
    Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
    // or set any global headers to be able to authenticate your requests to your backend
  },
  // you can provide any other
  adapterProcedures: {
    createUser(user: AdapterUser) {
      return {
        path: "auth/signup/",
        method: "POST",
        body: user,
        select: userSerializer as any,
      };
    },
    getUserById: (id: string) => ({
      path: `auth/get-user/${id}/`,
      method: "GET",
      select: userSerializer as any,
    }),
    getUserByEmail: (email: string) => ({
      path: `auth/get-user-by-email/${email}/`,
      method: "GET",
      select: userSerializer as any,
    }),
    getUserByAccount: ({providerAccountId, provider}) => ({
      path: `auth/get-user-by-account/${encodeURIComponent(
          provider
      )}/${encodeURIComponent(providerAccountId)}/`,
      method: "GET",
      select: userSerializer as any,
    }),
    updateUser: (user) => ({
      path: "auth/update-user/",
      method: "PATCH",
      select: userSerializer as any,
    }),
    deleteUser: (id) => ({
      path: `auth/delete-user/${id}/`,
      method: "DELETE",
    }),
    linkAccount: (account) => ({
      path: "auth/link-account/",
      method: "POST",
      body: account,
    }),
    unlinkAccount: ({provider, providerAccountId}) => ({
      path: `auth/unlink-account/${encodeURIComponent(
          provider
      )}/${encodeURIComponent(providerAccountId)}/`,
      method: "DELETE",
    }),
    createSession: (session) => ({
      path: "auth/create-session/",
      method: "POST",
      body: session,
      select: sessionSerializer as any,
    }),
    getSessionAndUser: (sessionToken) => ({
      path: `auth/get-session/${sessionToken}`,
      method: "GET",
      select: userAndSessionSerializer as any,
    }),
    updateSession: (session) => ({
      path: "auth/update-session/",
      method: "PATCH",
      body: session,
      select: sessionSerializer as any
    }),
    deleteSession: (sessionToken) => ({
      path: `auth/delete-session/${sessionToken}/`,
      method: "DELETE",
    }),
    createVerificationToken: (verificationToken) => ({
      path: "auth/create-verification-token/",
      method: "POST",
      body: verificationToken,
    }),
    useVerificationToken: (params) => ({
      path: "auth/use-verification-token/",
      method: "POST",
      body: params,
    }),
  },
});
