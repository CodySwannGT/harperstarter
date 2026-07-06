/**
 * Shared HTTP failure classifiers for the deploy + freshness gate. Kept
 * dependency-free so both the deploy orchestration and the verification helper
 * describe transport failures the same way.
 */

/**
 * Detects a request aborted by our own AbortController timeout.
 * @param error - Unknown thrown value from fetch/AbortController.
 * @returns True when the request was aborted by a timeout.
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Detects a dropped connection (the socket closes before a response).
 * @param error - Unknown thrown value from fetch.
 * @returns True when the request likely closed before responding.
 */
export function isFetchDisconnect(error: unknown): boolean {
  return error instanceof TypeError && error.message === "fetch failed";
}

/**
 * Summarizes a request failure for logs without leaking stacks.
 * @param error - Unknown thrown value from fetch/AbortController.
 * @returns A short, human-readable cause.
 */
export function describeRouteError(error: unknown): string {
  if (isAbortError(error)) return "request timed out";
  if (isFetchDisconnect(error)) return "connection dropped";
  return error instanceof Error ? error.message : String(error);
}
