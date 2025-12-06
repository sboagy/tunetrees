"use client";

import { Suspense } from "react";
import LoginDialog from "./page";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginDialog />
    </Suspense>
  );
}
