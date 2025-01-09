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
  // Probably not needed any more, but just in case one of the servers is slow to
  // start, we'll try a few times.
  const nRetries = 5;
  for (let attempt = 1; attempt <= nRetries; attempt++) {
    const backendOk = await checkBackend();
    const frontendOk = await checkFrontend();
    if (backendOk && frontendOk) {
      break;
    }
    if (attempt < nRetries) {
      console.log(`Attempt ${attempt} failed. Retrying in 1000ms...`);
      await new Promise((res) => setTimeout(res, 1000));
    } else {
      console.error(`Failed to check health after ${nRetries} attempts.`);
      throw new Error(
        `Backend or frontend not up after ${nRetries} attempts. Exiting test.`,
      );
    }
  }
  const backendOk = await checkBackend();
  const frontendOk = await checkFrontend();
  console.log(
    `===> test-login-1:44 ~ backendOk: ${backendOk}, frontendOk: ${frontendOk}`,
  );
  if (!frontendOk || !backendOk) {
    console.error(
      `Backend or frontend not up frontendOk=${frontendOk}, backendOk=${backendOk}.  Exiting test.  Please start backend and frontend.`,
    );
    throw new Error(
      `Backend or frontend not up (not up frontendOk=${frontendOk}, backendOk=${backendOk}).  Exiting test.`,
    );
  }
};
