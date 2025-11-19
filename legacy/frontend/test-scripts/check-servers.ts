import https from "node:https";
import axios from "axios";

export const checkBackend = async (): Promise<boolean> => {
  try {
    const response = await axios.get(
      "http://localhost:8000/hello/testFromFrontendTest2SpecTS",
    );
    return response.status === 200;
  } catch {
    return false;
  }
};

export const checkFrontend = async (): Promise<boolean> => {
  try {
    const frontendBase = (
      process.env.PLAYWRIGHT_BASE_URL || "https://localhost:3000"
    ).replace(/\/$/, "");
    const url = `${frontendBase}/api/health`;
    const isHttps = url.startsWith("https://");
    const response = await axios.get(
      url,
      isHttps
        ? { httpsAgent: new https.Agent({ rejectUnauthorized: false }) }
        : undefined,
    );
    return response.status === 200;
  } catch (error) {
    console.error("Error checking frontend health:", error);
    return false;
  }
};

export const checkHealth = async (): Promise<void> => {
  // Probably not needed any more, but just in case one of the servers is slow to
  // start, we'll try a few times.
  const nRetries = process.env.CI ? 10 : 8;
  const waitMs = process.env.CI ? 2000 : 1500;
  for (let attempt = 1; attempt <= nRetries; attempt++) {
    const backendOk = await checkBackend();
    const frontendOk = await checkFrontend();
    if (backendOk && frontendOk) {
      console.log(
        `===> check-servers ~ health OK on attempt ${attempt}: backendOk=${backendOk}, frontendOk=${frontendOk}`,
      );
      return; // Success; don't re-check again to avoid flakiness
    }
    if (attempt < nRetries) {
      console.log(
        `Attempt ${attempt} failed (backendOk=${backendOk}, frontendOk=${frontendOk}). Retrying in ${waitMs}ms...`,
      );
      await new Promise((res) => setTimeout(res, waitMs));
    } else {
      console.error(`Failed to check health after ${nRetries} attempts.`);
      throw new Error(
        `Backend or frontend not up after ${nRetries} attempts. Exiting test.`,
      );
    }
  }
};
