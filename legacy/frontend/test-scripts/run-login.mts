import { globalSetup } from "./login.mts";

try {
  console.log("Starting global setup...");
  await globalSetup();
  console.log("Global setup completed.");
} catch (error) {
  console.error("Error during global setup:", error);
}
