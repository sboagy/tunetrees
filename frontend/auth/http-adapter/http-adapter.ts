import type { Adapter, AdapterAccount } from "next-auth/adapters";

import { HttpAdpaterManager } from "./manager";
import type { AdapterManagerConfig } from "./types";

export function httpAdapter(opts: AdapterManagerConfig): Adapter {
  const manager = new HttpAdpaterManager(opts);
  return {
    async createUser(user) {
      console.log("===> auth http-adapter.ts:10 ~ createUser");
      return await manager.createUser(user);
    },
    async getUser(id) {
      try {
        console.log("===> auth http-adapter.ts:14 ~ getUser", id);
        return await manager.getUserById(id);
      } catch (error) {
        console.error("===> auth http-adapter.ts:16 ~ error", error);
        return null;
      }
    },
    async getUserByEmail(email) {
      try {
        console.log("===> auth http-adapter.ts:24 ~ getUserByEmail");
        return await manager.getUserByEmail(email);
      } catch {
        console.log("===> auth http-adapter.ts:24 ~ error");
        return null;
      }
    },
    async getUserByAccount(payload) {
      try {
        console.log("===> auth http-adapter.ts:33 ~ getUserByAccount");
        return await manager.getUserByAccount(payload);
      } catch {
        console.log("===> auth http-adapter.ts:32 ~ error");
        return null;
      }
    },
    async updateUser(user) {
      console.log("===> auth http-adapter.ts:41 ~ updateUser");
      return await manager.updateUser(user);
    },
    async deleteUser(userId) {
      try {
        console.log("===> auth http-adapter.ts:46 ~ deleteUser");
        return await manager.deleteUser(userId);
      } catch {
        console.log("===> auth http-adapter.ts:43 ~ error");
        return null;
      }
    },
    async linkAccount(
      account: AdapterAccount,
    ): Promise<AdapterAccount | null | undefined> {
      try {
        console.log("===> auth http-adapter.ts:57 ~ linkAccount");
        return await manager.linkAccount(account);
      } catch {
        console.log("===> auth http-adapter.ts:51 ~ error");
        return null;
      }
    },
    async unlinkAccount(args) {
      console.log("===> auth http-adapter.ts:65 ~ unlinkAccount");
      await manager.unlinkAccount(args);
      return;
    },
    async createSession(session) {
      console.log("===> auth http-adapter.ts:70 ~ createSession", session);
      return await manager.createSession(session);
    },
    async getSessionAndUser(sessionToken) {
      try {
        console.log(
          "===> auth http-adapter.ts:75 ~ getSessionAndUser",
          sessionToken,
        );
        return await manager.getSessionAndUser(sessionToken);
      } catch (error) {
        if (error instanceof Error) {
          console.log("===> auth http-adapter.ts:66 ~ error: ", error.message);
        } else {
          console.log("===> auth http-adapter.ts:66 ~ error: ", error);
        }
        return null;
      }
    },
    async updateSession(session) {
      try {
        console.log("===> auth http-adapter.ts:84 ~ updateSession", session);
        return await manager.updateSession(session);
      } catch {
        console.log("===> auth http-adapter.ts:74 ~ error");
        return null;
      }
    },
    async deleteSession(sessionToken) {
      console.log("===> auth http-adapter.ts:92 ~ deleteSession", sessionToken);
      await manager.deleteSession(sessionToken);
      return null;
    },
    async createVerificationToken(verificationToken) {
      try {
        console.log(
          "===> auth http-adapter.ts:98 ~ createVerificationToken",
          verificationToken,
        );
        return await manager.createVerificationToken(verificationToken);
      } catch {
        console.error("===> auth http-adapter.ts:86 ~ error");
        return null;
      }
    },
    async useVerificationToken(params) {
      try {
        console.log(
          "===> auth http-adapter.ts:107 ~ useVerificationToken",
          params,
        );
        return await manager.useVerificationToken(params);
      } catch {
        console.error("===> auth http-adapter.ts:94 ~ error");
        return null;
      }
    },
  };
}
