"use server";

// These functions are called from auth/auth-tt-adapter.ts which object may be executed on the
// server or the client, depending on the context, so we need to have fetch calls in this file
// to force the call to be made from the server, since the client does not have access to the
// backend tunetrees API.
//
// In addition these wrappers provide extra typing to make sure the types passed too or from
// the backend API match the expected types.

import type {
  IAccount,
  ISession,
  IUser,
  IVerificationToken,
} from "@/app/(main)/pages/practice/types";

const _baseURL = process.env.TT_API_BASE_URL;

export async function updateUserInDatabase(
  userId: number,
  user4db: Partial<IUser>,
): Promise<IUser> {
  const user4dbString = JSON.stringify(user4db);
  const url = `${_baseURL}/auth/update-user/${userId}`;
  // For some very very strange reason, fetchWithTimeout is not working here.
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: user4dbString,
  });
  const payload: IUser = await res.json();
  return payload;
}

export async function getUserExtendedByEmailFromDb(
  email: string,
): Promise<IUser | null> {
  const path = `${_baseURL}/auth/get-user-by-email/${email}`;
  const res = await fetch(path, {
    method: "GET",
    headers: {
      Authorization: process.env.REMOTE_AUTH_RPC_TOKEN ?? "",
      Accept: "application/json",
    },
  });
  return (await res.json()) as IUser;
}

export async function createUserInDatabase(user: IUser): Promise<IUser> {
  const res = await fetch(`${_baseURL}/auth/signup/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(user),
  });
  return (await res.json()) as IUser;
}

export async function getUserFromDatabase(id: string): Promise<IUser | null> {
  const res = await fetch(`${_baseURL}/auth/get-user/${id}/`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!res) return null;
  return (await res.json()) as IUser;
}

export async function getUserByEmailFromDatabase(
  email: string,
): Promise<IUser | null> {
  const res = await fetch(`${_baseURL}/auth/get-user-by-email/${email}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!res) return null;
  return (await res.json()) as IUser;
}

export async function getUserByAccountFromDatabase(
  provider: string,
  providerAccountId: string,
): Promise<IUser | null> {
  const res = await fetch(
    `${_baseURL}/auth/get-user-by-account/${encodeURIComponent(provider)}/${encodeURIComponent(providerAccountId)}/`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!res) return null;
  return (await res.json()) as IUser;
}

export async function deleteUserFromDatabase(userId: string): Promise<null> {
  const res = await fetch(`${_baseURL}/auth/delete-user/${userId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });
  if (!res) return null;
  return null;
}

export async function linkAccountInDatabase(
  account: IAccount,
): Promise<IAccount> {
  const res = await fetch(`${_baseURL}/auth/link-account/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(account),
  });
  return (await res.json()) as IAccount;
}

export async function unlinkAccountFromDatabase(
  providerAccountId: string,
): Promise<null> {
  const res = await fetch(
    `${_baseURL}/auth/unlink-account/${providerAccountId}/`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    },
  );
  if (!res || !res.ok) {
    throw new Error(`Failed to unlink account: ${providerAccountId}`);
  }
  return null;
}

export async function createSessionInDatabase(session: {
  sessionToken: string;
  userId: string;
  expires: Date;
}): Promise<ISession> {
  const res = await fetch(`${_baseURL}/auth/create-session/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(session),
  });
  return (await res.json()) as ISession;
}

export async function getSessionAndUserFromDatabase(
  sessionToken: string,
): Promise<{ session: ISession; user: IUser } | null> {
  const path = `${_baseURL}/auth/get-session/${sessionToken}`;
  const res = await fetch(path, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  if (!res) return null;
  return (await res.json()) as { session: ISession; user: IUser };
}

export async function updateSessionInDatabase(
  session: ISession,
): Promise<ISession> {
  const res = await fetch(`${_baseURL}/auth/update-session/`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(session),
  });
  return (await res.json()) as ISession;
}

export async function deleteSessionFromDatabase(
  sessionToken: string,
): Promise<null> {
  const res = await fetch(`${_baseURL}/auth/delete-session/${sessionToken}/`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });
  if (!res || !res.ok) {
    throw new Error(`Failed to delete session: ${sessionToken}`);
  }
  return null;
}

export async function createVerificationTokenInDatabase(verificationToken: {
  identifier: string;
  expires: Date;
  token: string;
}): Promise<IVerificationToken> {
  const res = await fetch(`${_baseURL}/auth/create-verification-token/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(verificationToken),
  });
  return (await res.json()) as IVerificationToken;
}

export async function useVerificationTokenFromDatabase(verificationToken: {
  identifier: string;
  token: string;
}): Promise<IVerificationToken | null> {
  const res = await fetch(`${_baseURL}/auth/use-verification-token/`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(verificationToken),
  });
  return (await res.json()) as IVerificationToken;
}
