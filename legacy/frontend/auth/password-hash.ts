"use server";

function is_server() {
  return !(typeof window !== "undefined" && window.document);
}

export const hashPassword = async (rawPassword: string): Promise<string> => {
  if (!is_server()) {
    throw new Error("Password hashing must run on the server!");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require("bcryptjs");

  const hash: string = await bcrypt.hash(rawPassword, bcrypt.genSaltSync());
  return hash;
};
