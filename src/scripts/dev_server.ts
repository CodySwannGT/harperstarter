/**
 * Local Harper component runner for the starter template.
 *
 * In a real project this would orchestrate `harperdb start`, watch
 * `harper-app/`, and rebuild on change. The starter intentionally just
 * delegates to `harperdb start` so you can wire your own watcher.
 */

import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * Resolves an executable on `PATH` to its absolute location.
 *
 * The binary is resolved up front so the child process launches from a fixed,
 * known path instead of trusting whatever a mutable `PATH` resolves at spawn
 * time.
 * @param command - Bare executable name to locate (e.g. `harperdb`).
 * @returns Absolute path to the executable.
 */
function resolveExecutable(command: string): string {
  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const candidate = directories
    .map(directory => join(directory, command))
    .find(binary => {
      try {
        accessSync(binary, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
  if (!candidate) {
    throw new Error(`dev_server: could not locate \`${command}\` on PATH.`);
  }
  return candidate;
}

const child = spawn(resolveExecutable("harperdb"), ["start"], {
  stdio: "inherit",
});
child.on("exit", code => process.exit(code ?? 0));
