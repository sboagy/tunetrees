export async function fetchWithTimeout(
  resource: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<Response> {
  const { timeout = 16000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => {
    console.log("Timeout triggered for:", resource);
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    console.log("Request completed for:", resource);
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("Request aborted due to timeout:", resource);
    } else {
      console.error("Fetch error:", error);
    }
    throw error;
  } finally {
    clearTimeout(id);
    console.log("Timeout cleared for:", resource);
  }
}
