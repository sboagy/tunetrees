import {httpAdapter} from "next-auth-http-adapter";

function userSerializer(res: any) {
    let email_verified = null;
    if (res.emailVerified) {
        email_verified = new Date(res.emailVerified);
    }
    return {
        id: res.id,
        name: res.name,
        email: res.email,
        image: res.image,
        emailVerified: email_verified,
    };
}

function userAndSessionSerializer(res: any) {
    let email_verified = null;
    if (res.emailVerified) {
        email_verified = new Date(res.emailVerified);
    }
    return {
        id: res.id,
        name: res.name,
        email: res.email,
        image: res.image,
        emailVerified: email_verified,
    };
}


export const ttHttpAdapter = httpAdapter({
    baseURL: "http://localhost:8000", // or any other base url
    headers: {
        Authorization: process.env.REMOTE_AUTH_RPC_TOKEN!,
        // or set any global headers to be able to authenticate your requests to your backend
    },
    // you can provide any other
    adapterProcedures: {
        createUser(user) {
            return {
                path: "auth/signup/",
                method: "POST",
                body: user,
                select: userSerializer,
            };
        },
        getUserById: (id) => ({
            path: `auth/get-user/${id}/`,
            method: "GET",
            select: userSerializer,
        }),
        getUserByEmail: (email) => ({
            path: `auth/get-user-by-email/${encodeURIComponent(email)}/`,
            select: userSerializer,
        }),
        getUserByAccount: ({providerAccountId, provider}) => ({
            path: `auth/get-user-by-account/${encodeURIComponent(
                provider
            )}/${encodeURIComponent(providerAccountId)}/`,
            select: userSerializer,
        }),
        updateUser: (user) => ({
            path: "auth/update-user/",
            method: "PATCH",
            select: userSerializer,
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
        }),
        getSessionAndUser: (sessionToken) => ({
            path: `auth/get-session/${sessionToken}`,
            method: "GET",
        }),
        updateSession: (session) => ({
            path: "auth/update-session/",
            method: "PATCH",
            body: session,
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
