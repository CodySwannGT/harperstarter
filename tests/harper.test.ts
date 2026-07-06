/**
 * Unit tests for the Harper connection-settings reader.
 *
 * Each case supplies explicit `HDB_TARGET_URL` + `HDB_ADMIN_USERNAME` +
 * `HDB_ADMIN_PASSWORD` so `harperConfig` never falls through to keychain or
 * credentials-file resolution, keeping the assertions deterministic.
 * @module tests/harper.test
 */
import { describe, expect, it } from "vitest";

import { Buffer } from "node:buffer";

import { harperConfig } from "../src/lib/harper.js";

const TARGET = "https://cluster.example.com:9925";

/**
 * Builds the expected base64 `user:credential` auth payload.
 * @param user - Username component.
 * @param credential - Credential component.
 * @returns The expected base64 auth string.
 */
function expectedAuth(user: string, credential: string): string {
  return Buffer.from(`${user}:${credential}`).toString("base64");
}

describe("harperConfig", () => {
  it("uses explicit HDB_* settings for a hosted operations target", () => {
    const config = harperConfig({
      HDB_TARGET_URL: TARGET,
      HDB_ADMIN_USERNAME: "service-account",
      HDB_ADMIN_PASSWORD: "placeholder-test-credential",
    });
    expect(config.target).toBe(TARGET);
    expect(config.auth).toBe(
      expectedAuth("service-account", "placeholder-test-credential")
    );
  });

  it("strips trailing slashes from the operations target", () => {
    const config = harperConfig({
      HDB_TARGET_URL: `${TARGET}///`,
      HDB_ADMIN_USERNAME: "svc",
      HDB_ADMIN_PASSWORD: "secret",
    });
    expect(config.target).toBe(TARGET);
  });

  it("treats an explicit empty target as local unix-socket mode", () => {
    const config = harperConfig({
      HDB_TARGET_URL: "",
      HDB_ADMIN_USERNAME: "svc",
      HDB_ADMIN_PASSWORD: "secret",
      HDB_ROOT: "/tmp/hdb",
    });
    expect(config.target).toBe("");
    expect(config.socket).toBe("/tmp/hdb/operations-server");
  });
});
