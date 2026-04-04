export function getRequiredSharedTestPassword(): string {
  const password =
    process.env.TEST_USER_PASSWORD ?? process.env.ALICE_TEST_PASSWORD;

  if (password && password.trim().length > 0) {
    return password;
  }

  throw new Error(
    "TEST_USER_PASSWORD or ALICE_TEST_PASSWORD must be set in the environment."
  );
}

export function createGeneratedTestPassword(): string {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `tt-${Date.now()}-${randomSuffix}-Aa1!`;
}