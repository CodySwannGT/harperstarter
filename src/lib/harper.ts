import { Buffer } from "node:buffer";

/**
 * Connection settings for Harper REST operations.
 */
export interface HarperConfig {
  readonly baseUrl: string;
  readonly authHeader: string;
}

/**
 * Reads Harper connection settings from the environment.
 *
 * For local Harper, defaults match the bootstrap-installed cluster
 * (`http://127.0.0.1:9926`, user `admin`, password `admin-local`).
 * For deployed Fabric clusters, set `HDB_BASE_URL`, `HDB_ADMIN_USERNAME`,
 * `HDB_ADMIN_PASSWORD`.
 */
export function harperConfig(
  env: NodeJS.ProcessEnv = process.env
): HarperConfig {
  const baseUrl = (env.HDB_BASE_URL ?? "http://127.0.0.1:9926").replace(
    /\/+$/,
    ""
  );
  const user = env.HDB_ADMIN_USERNAME ?? "admin";
  const password = env.HDB_ADMIN_PASSWORD ?? "admin-local";
  const authHeader = `Basic ${Buffer.from(`${user}:${password}`).toString(
    "base64"
  )}`;
  return { baseUrl, authHeader };
}
