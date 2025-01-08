import axios from "axios";
import https from "node:https";

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
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Ignore self-signed certificate errors
    });
    const response = await axios.get("https://localhost:3000/api/health", {
      httpsAgent,
    });
    return response.status === 200;
  } catch (error) {
    console.error("Error checking frontend health:", error);
    return false;
  }
};

export const checkHealth = async (): Promise<void> => {
  const backendOk = await checkBackend();
  const frontendOk = await checkFrontend();
  console.log(
    `===> test-login-1:44 ~ backendOk: ${backendOk}, frontendOk: ${frontendOk}`,
  );
  if (!frontendOk || !backendOk) {
    console.error(
      "Backend or frontend not up.  Exiting test.  Please start backend and frontend.",
    );
    throw new Error("Backend or frontend not up.  Exiting test.");
  }
};
