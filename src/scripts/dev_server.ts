/**
 * Local Harper component runner for the starter template.
 *
 * In a real project this would orchestrate `harperdb start`, watch
 * `harper-app/`, and rebuild on change. The starter intentionally just
 * delegates to `harperdb start` so you can wire your own watcher.
 */

import { spawn } from "node:child_process";

const child = spawn("harperdb", ["start"], { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 0));
