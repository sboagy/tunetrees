/** Classify only known transport/service failures for E2E polling. */
export function isTransientRemoteRead(status: number, code: string): boolean {
  if (status === 401 || status === 403) return false;
  if (code) return ["PGRST000", "PGRST001", "PGRST002"].includes(code);
  return [0, 408, 429, 502, 503, 504].includes(status);
}
