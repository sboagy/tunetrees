import { test } from "@playwright/test";

export const BASE_URL = {
  toString() {
    try {
      // 1. Ask Playwright for the currently running project's config
      // This works because this code runs INSIDE the test execution context
      const url = test.info().project.use.baseURL;

      // 2. Return it, or fall back to dev if something goes wrong
      // Callers append paths starting with "/"; doubled slashes do not match routes.
      return (url || "http://localhost:5173").replace(/\/+$/, "");
    } catch {
      // Fallback for when this file is accessed outside of a test (e.g. during imports)
      return "http://localhost:5173";
    }
  },
};
