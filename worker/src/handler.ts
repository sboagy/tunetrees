import generatedWorker from "./index";
import { getCorsHeaders, handleMediaRequest, type MediaWorkerEnv } from "./media";

const worker: ExportedHandler<MediaWorkerEnv> = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    const mediaResponse = await handleMediaRequest(request, env);
    if (mediaResponse) {
      return mediaResponse;
    }

    void ctx;
    return generatedWorker.fetch(request, env);
  },
};

export default worker;
