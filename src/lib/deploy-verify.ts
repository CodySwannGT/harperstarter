/**
 * Post-deploy freshness + route-readiness verification for a Harper Fabric
 * component. Parameterized (cluster URL, expected version, routes) so it stays
 * project-agnostic and unit-testable.
 */
import { describeRouteError } from "./deploy-http.js";

const ROUTE_READINESS_ATTEMPTS = 6;
const ROUTE_READINESS_INTERVAL_MS = 5000;
const ROUTE_READINESS_TIMEOUT_MS = 15000;
const FRESHNESS_POLL_ATTEMPTS = 18;
const FRESHNESS_POLL_INTERVAL_MS = 5000;

/**
 * Fetches a URL with a bounded timeout so a stalled route fails fast.
 * @param url - URL to fetch.
 * @param timeoutMs - Abort timeout in milliseconds.
 * @returns The fetch Response.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json, text/javascript, */*" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Extracts `APP_VERSION` from the generated browser version module.
 * @param source - JavaScript module text from `/version.js`.
 * @returns The version string, or an empty string when malformed.
 */
export function parseVersionModule(source: string): string {
  return /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(source)?.[1] ?? "";
}

/**
 * Reads the deployed `/version.js` marker.
 * @param clusterUrl - Base URL for the deployed Harper component.
 * @returns The observed `APP_VERSION`, or an empty string when unavailable.
 */
async function observedVersion(clusterUrl: string): Promise<string> {
  const response = await fetchWithTimeout(
    `${clusterUrl}/version.js`,
    ROUTE_READINESS_TIMEOUT_MS
  ).catch(() => null);
  return response?.ok ? parseVersionModule(await response.text()) : "";
}

/**
 * Polls `/version.js` until it matches this build or the budget is exhausted,
 * giving cluster replication time to propagate the component.
 * @param clusterUrl - Base URL for the deployed Harper component.
 * @param expected - Version this build should serve.
 * @param attempts - Remaining poll attempts.
 * @returns The last observed version.
 */
async function pollDeployedVersion(
  clusterUrl: string,
  expected: string,
  attempts: number
): Promise<string> {
  const observed = await observedVersion(clusterUrl);
  if (observed === expected && observed !== "") return observed;
  if (attempts <= 1) return observed;
  console.log(
    `  /version.js → ${observed || "missing"} (expected ${expected}); waiting for replication … (${attempts - 1} left)`
  );
  await new Promise(resolve => setTimeout(resolve, FRESHNESS_POLL_INTERVAL_MS));
  return pollDeployedVersion(clusterUrl, expected, attempts - 1);
}

/**
 * Verifies a public GET route returns 200, polling to absorb the cold-start
 * latency a freshly restarted route shows on its first request.
 * @param clusterUrl - Base URL for the deployed Harper component.
 * @param path - Absolute path to check.
 * @param attempts - Remaining poll attempts.
 * @returns Resolves once the route answers 200, else throws after the budget.
 */
async function verifyPublicRoute(
  clusterUrl: string,
  path: string,
  attempts = ROUTE_READINESS_ATTEMPTS
): Promise<void> {
  const outcome = await fetchWithTimeout(
    `${clusterUrl}${path}`,
    ROUTE_READINESS_TIMEOUT_MS
  ).then(
    response => ({ ready: response.ok, detail: `HTTP ${response.status}` }),
    (error: unknown) => ({ ready: false, detail: describeRouteError(error) })
  );
  if (outcome.ready) return;
  if (attempts <= 1) {
    throw new Error(`${path} did not become ready: ${outcome.detail}`);
  }
  console.log(
    `  ${path} not ready (${outcome.detail}); retrying … (${attempts - 1} left)`
  );
  await new Promise(resolve =>
    setTimeout(resolve, ROUTE_READINESS_INTERVAL_MS)
  );
  return verifyPublicRoute(clusterUrl, path, attempts - 1);
}

/**
 * Verifies the public runtime is serving this build, then that every configured
 * route is healthy. Throws on a version mismatch or an unready route so the
 * caller can trigger recovery.
 * @param clusterUrl - Base URL for the deployed Harper component.
 * @param expected - Version this build should serve.
 * @param routes - Absolute route paths to verify.
 */
export async function verifyRuntime(
  clusterUrl: string,
  expected: string,
  routes: readonly string[]
): Promise<void> {
  const observed = await pollDeployedVersion(
    clusterUrl,
    expected,
    FRESHNESS_POLL_ATTEMPTS
  );
  console.log(
    `▶ ${clusterUrl}/version.js → ${observed || "missing"} (expected ${expected})`
  );
  if (observed !== expected) {
    throw new Error(
      `deployed version mismatch: expected ${expected}, observed ${observed || "missing"}`
    );
  }
  for (const route of routes) {
    await verifyPublicRoute(clusterUrl, route);
  }
  console.log(`▶ verified routes: ${routes.join(", ")}`);
}
