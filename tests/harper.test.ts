/**
 * Unit tests for the Harper connection-settings reader.
 * @module tests/harper.test
 */
import { describe, expect, it } from "vitest";

import { Buffer } from "node:buffer";

import { harperConfig } from "../src/lib/harper.js";

const CLUSTER_URL = "https://cluster.example.com";

/**
 * Builds the expected `Basic` auth header for a `user:credential` pair.
 *
 * Base64 encoding is performed here (not by the unit under test) so the
 * assertion stays decoupled while keeping no pre-encoded literal in the file.
 * @param user - Username component of the credential pair.
 * @param credential - Credential component of the credential pair.
 * @returns The expected `Authorization` header value.
 */
function expectedAuthHeader(user: string, credential: string): string {
  return `Basic ${Buffer.from(`${user}:${credential}`).toString("base64")}`;
}

describe("harperConfig", () => {
  it("uses the local bootstrap defaults when no env vars are set", () => {
    const config = harperConfig({});
    expect(config.baseUrl).toBe("http://127.0.0.1:9926");
    expect(config.authHeader).toBe(expectedAuthHeader("admin", "admin-local"));
  });

  it("reads base URL and credentials from the provided environment", () => {
    const username = "service-account";
    const credential = "placeholder-test-credential";
    const config = harperConfig({
      HDB_BASE_URL: CLUSTER_URL,
      HDB_ADMIN_USERNAME: username,
      HDB_ADMIN_PASSWORD: credential,
    });
    expect(config.baseUrl).toBe(CLUSTER_URL);
    expect(config.authHeader).toBe(expectedAuthHeader(username, credential));
  });

  it("strips a single trailing slash from the base URL", () => {
    const config = harperConfig({ HDB_BASE_URL: `${CLUSTER_URL}/` });
    expect(config.baseUrl).toBe(CLUSTER_URL);
  });

  it("strips multiple trailing slashes from the base URL", () => {
    const config = harperConfig({ HDB_BASE_URL: `${CLUSTER_URL}///` });
    expect(config.baseUrl).toBe(CLUSTER_URL);
  });

  it("leaves a base URL without a trailing slash unchanged", () => {
    const config = harperConfig({ HDB_BASE_URL: CLUSTER_URL });
    expect(config.baseUrl).toBe(CLUSTER_URL);
  });

  it("treats an empty HDB_BASE_URL as an explicit empty base URL", () => {
    // Nullish coalescing only substitutes the default for `undefined`/`null`,
    // so an explicit empty string is preserved (matching the original reader).
    const config = harperConfig({ HDB_BASE_URL: "" });
    expect(config.baseUrl).toBe("");
  });
});
