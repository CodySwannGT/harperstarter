/**
 * Unit tests for the deploy HTTP failure classifiers.
 * @module tests/deploy_http.test
 */
import { describe, expect, it } from "vitest";

import {
  describeRouteError,
  isAbortError,
  isFetchDisconnect,
} from "../src/lib/deploy-http.js";

/** The message Node's fetch throws when the connection drops. */
const FETCH_FAILED = "fetch failed";

/**
 * Builds an Error whose `name` is `AbortError`, mirroring an aborted request.
 * @returns An abort-like error.
 */
function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}

describe("isAbortError", () => {
  it("detects an AbortError by name", () => {
    expect(isAbortError(abortError())).toBe(true);
  });

  it("rejects other errors and non-errors", () => {
    expect(isAbortError(new Error("boom"))).toBe(false);
    expect(isAbortError("aborted")).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });
});

describe("isFetchDisconnect", () => {
  it("detects the 'fetch failed' TypeError", () => {
    expect(isFetchDisconnect(new TypeError(FETCH_FAILED))).toBe(true);
  });

  it("rejects other type errors and non-errors", () => {
    expect(isFetchDisconnect(new TypeError("other"))).toBe(false);
    expect(isFetchDisconnect(new Error(FETCH_FAILED))).toBe(false);
    expect(isFetchDisconnect(null)).toBe(false);
  });
});

describe("describeRouteError", () => {
  it("summarizes known transport failures", () => {
    expect(describeRouteError(abortError())).toBe("request timed out");
    expect(describeRouteError(new TypeError(FETCH_FAILED))).toBe(
      "connection dropped"
    );
  });

  it("falls back to the error message or its string form", () => {
    expect(describeRouteError(new Error("weird 500"))).toBe("weird 500");
    expect(describeRouteError(42)).toBe("42");
  });
});
