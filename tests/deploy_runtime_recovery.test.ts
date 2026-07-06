/**
 * Unit tests for the stale-public-runtime recovery routine.
 * @module tests/deploy_runtime_recovery.test
 */
import { describe, expect, it, vi } from "vitest";

import { recoverPublicRuntime } from "../src/lib/deploy-runtime-recovery.js";

describe("recoverPublicRuntime", () => {
  it("deploys, restarts, and verifies the public runtime", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actions = {
      deployPublicRuntime: vi.fn(async () => 200),
      restartPublicRuntime: vi.fn(async () => 200),
      verifyRuntime: vi.fn(async () => {}),
    };

    await expect(
      recoverPublicRuntime(new Error("stale bundle"), actions)
    ).resolves.toBe(true);
    expect(actions.deployPublicRuntime).toHaveBeenCalledOnce();
    expect(actions.restartPublicRuntime).toHaveBeenCalledOnce();
    expect(actions.verifyRuntime).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("stops when the direct public deploy fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actions = {
      deployPublicRuntime: vi.fn(async () => 500),
      restartPublicRuntime: vi.fn(async () => 200),
      verifyRuntime: vi.fn(async () => {}),
    };

    await expect(recoverPublicRuntime("unreachable", actions)).resolves.toBe(
      false
    );
    expect(actions.restartPublicRuntime).not.toHaveBeenCalled();
    expect(actions.verifyRuntime).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("stops when the public restart fails after a successful deploy", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actions = {
      deployPublicRuntime: vi.fn(async () => 200),
      restartPublicRuntime: vi.fn(async () => 503),
      verifyRuntime: vi.fn(async () => {}),
    };

    await expect(recoverPublicRuntime("stale", actions)).resolves.toBe(false);
    expect(actions.deployPublicRuntime).toHaveBeenCalledOnce();
    expect(actions.restartPublicRuntime).toHaveBeenCalledOnce();
    expect(actions.verifyRuntime).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("reports failure when final verification still rejects", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const actions = {
      deployPublicRuntime: vi.fn(async () => 200),
      restartPublicRuntime: vi.fn(async () => 200),
      verifyRuntime: vi.fn(async () => {
        throw new Error("runtime unavailable");
      }),
    };

    await expect(
      recoverPublicRuntime(new Error("stale"), actions)
    ).resolves.toBe(false);
    expect(actions.verifyRuntime).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "public runtime recovery attempt failed:",
      "runtime unavailable"
    );
    warn.mockRestore();
  });
});
