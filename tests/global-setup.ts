/**
 * Vitest global setup for the Harper/Fabric starter.
 *
 * Lisa governance forces `test` / `test:cov` to a bare `vitest run`, dropping
 * the `bun run build && bun run test:setup:playwright` preamble the browser
 * regression tests depend on. This setup reinstates those preconditions so the
 * forced scripts stay self-sufficient across Lisa updates: it builds the
 * deployable Harper component (`harper-app/`) and ensures the Chromium browser
 * used by the web regression tests is installed.
 *
 * Both steps are skipped when `VITEST_SKIP_GLOBAL_SETUP` is set, which keeps
 * fast unit-only runs (and environments that pre-build) cheap.
 *
 * @see https://vitest.dev/config/#globalsetup
 * @module tests/global-setup
 */
import { execFileSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

const BUILD_ARGS = ["run", "build"] as const;
const PLAYWRIGHT_ARGS = ["run", "test:setup:playwright"] as const;

/**
 * Resolves the absolute path to the `bun` executable.
 *
 * The path is resolved up front (rather than letting the OS search `PATH` at
 * spawn time) so the child process is launched from a fixed, known binary
 * instead of whatever a mutable `PATH` happens to resolve to.
 * @returns Absolute path to the `bun` binary.
 */
function resolveBunPath(): string {
  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const candidate = directories
    .map(directory => join(directory, "bun"))
    .find(binary => {
      try {
        accessSync(binary, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  if (!candidate) {
    throw new Error(
      "global-setup: could not locate the `bun` executable on PATH."
    );
  }
  return candidate;
}

/**
 * Runs the documented test preconditions before the Vitest suite executes.
 *
 * Builds the Harper component and installs the Chromium browser used by the
 * web regression tests. Honours `VITEST_SKIP_GLOBAL_SETUP` for fast unit runs.
 * @returns Promise that resolves once preconditions are satisfied.
 */
export default async function setup(): Promise<void> {
  if (process.env.VITEST_SKIP_GLOBAL_SETUP) {
    return;
  }
  const bun = resolveBunPath();
  execFileSync(bun, [...BUILD_ARGS], { stdio: "inherit" });
  execFileSync(bun, [...PLAYWRIGHT_ARGS], { stdio: "inherit" });
  await Promise.resolve();
}
