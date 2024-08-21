"use server";

import { AccountFormValues } from "@/app/auth/newuser/account-form";
import { assertIsDefined } from "@/auth";
import { ExtendedAdapterUser, ttHttpAdapter } from "@/auth/auth_tt_adapter";

export const newUser = async (data: AccountFormValues) => {
  const email = data.email;
  console.log("newUser data: ", data);

  assertIsDefined(ttHttpAdapter.createUser);

  const bcrypt = require("bcryptjs");

  const user: ExtendedAdapterUser = {
    id: "",
    name: data.name,
    email: email,
    emailVerified: null,
    hash: bcrypt.hashSync(data.password, bcrypt.genSaltSync()),
    view_settings: "",
  };

  ttHttpAdapter.createUser(user);
};
