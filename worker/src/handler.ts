import {
  type GoogleOAuthWorkerEnv,
  handleGoogleOAuthRequest,
} from "./google-oauth";
import generatedWorker from "./index";
import {
  getCorsHeaders,
  handleMediaRequest,
  type MediaWorkerEnv,
} from "./media";

type WorkerEnv = MediaWorkerEnv & GoogleOAuthWorkerEnv;

const worker: ExportedHandler<WorkerEnv> = {
  async fetch(request, env, _ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    const googleOAuthResponse = await handleGoogleOAuthRequest(request, env);
    if (googleOAuthResponse) {
      return googleOAuthResponse;
    }

    const mediaResponse = await handleMediaRequest(request, env);
    if (mediaResponse) {
      return mediaResponse;
    }

    return generatedWorker.fetch(request, env);
  },
};

export default worker;
