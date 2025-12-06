"use server";

// import bcrypt from "bcrypt";

// export async function matchPasswordWithHash(
//   rawPassword: string,
//   hashedPassword: string
// ): Promise<boolean>

function is_server() {
  return !(typeof window !== "undefined" && window.document);
}

export const matchPasswordWithHash = async (
  rawPassword: string,
  hashedPassword: string,
) => {
  if (!is_server()) {
    throw new Error("Why is this not running on the server!!!");
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require("bcryptjs");

  const match: boolean = await bcrypt.compare(rawPassword, hashedPassword);
  return match;
};

// const matchPasswordWithHash = (
//   plainPassword: string,
//   hashedPassword: string
// ) => {
//   return new Promise((resolve) => {
//     const bcrypt = require("bcrypt");
//     return bcrypt.compare(plainPassword, hashedPassword);
//   });
// };
