import { Buffer } from "node:buffer";
import { env as processEnv } from "node:process";

/**
 * Connection settings for Harper REST operations.
 */
interface HarperConfig {
  readonly baseUrl: string;
  readonly authHeader: string;
}

/** Default base URL of the bootstrap-installed local Harper cluster. */
const DEFAULT_BASE_URL = "http://127.0.0.1:9926";
/** Default admin user of the bootstrap-installed local Harper cluster. */
const DEFAULT_ADMIN_USER = "admin";
/** Default admin credential of the bootstrap-installed local Harper cluster. */
const DEFAULT_LOCAL_ADMIN_CREDENTIAL = "admin-local";

/**
 * Strips any trailing slashes from a base URL.
 *
 * Recurses from the end one character at a time, avoiding the
 * backtracking-prone `/\/+$/` regex that static analysis flags as super-linear
 * while staying free of mutable bindings.
 * @param value - Base URL that may carry one or more trailing slashes.
 * @returns The base URL with every trailing slash removed.
 */
function stripTrailingSlashes(value: string): string {
  if (value.length === 0 || value.charAt(value.length - 1) !== "/") {
    return value;
  }
  return stripTrailingSlashes(value.slice(0, -1));
}

/**
 * Reads Harper connection settings from the environment.
 *
 * For local Harper, defaults match the bootstrap-installed cluster
 * (`http://127.0.0.1:9926`, user `admin`, credential `admin-local`).
 * For deployed Fabric clusters, set `HDB_BASE_URL`, `HDB_ADMIN_USERNAME`,
 * `HDB_ADMIN_PASSWORD`.
 * @param env - Environment variable map to read settings from; defaults to the
 *   current process environment.
 * @returns Resolved Harper base URL and Basic auth header.
 */
export function harperConfig(
  env: NodeJS.ProcessEnv = processEnv
): HarperConfig {
  const baseUrl = stripTrailingSlashes(env.HDB_BASE_URL ?? DEFAULT_BASE_URL);
  const user = env.HDB_ADMIN_USERNAME ?? DEFAULT_ADMIN_USER;
  const credential = env.HDB_ADMIN_PASSWORD ?? DEFAULT_LOCAL_ADMIN_CREDENTIAL;
  const authHeader = `Basic ${Buffer.from(`${user}:${credential}`).toString(
    "base64"
  )}`;
  return { baseUrl, authHeader };
}
