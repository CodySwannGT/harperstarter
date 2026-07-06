#!/usr/bin/env node
/**
 * Deploy the local `harper-app/` component to a Harper Fabric cluster.
 *
 * Primary path: the instance's direct Operations API on `:9925`, derived from
 * `HARPER_CLUSTER_URL`. It lands straight on the public serving node and
 * bypasses the Fabric Studio proxy (which intermittently 500s
 * "Instance domain socket does not exist"). GitHub-hosted runners can reach
 * `:9925`, so it is the primary CI path too. Force the Studio control-plane
 * proxy fallback with `DEPLOY_VIA=studio`.
 *
 * Post-deploy the script verifies the runtime is serving this build: it polls
 * `/version.js` until it matches this package's version, then checks every
 * route in `DEPLOY_VERIFY_ROUTES` (default `/`) returns 200. A stale serving
 * node triggers one direct re-deploy + restart recovery pass.
 *
 * Credentials come from `HARPER_ADMIN_USERNAME` / `HARPER_ADMIN_PASSWORD`;
 * the target from `HARPER_CLUSTER_URL` (and `HARPER_CLUSTER_ID` for the Studio
 * fallback). See `src/scripts/_auth.ts` for resolution order.
 *
 * Usage:
 *   bun run deploy
 *   PROJECT=my-app DIR=./harper-app bun run deploy
 *   DEPLOY_VERIFY_ROUTES="/,/Hello" bun run deploy
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Buffer } from "node:buffer";
import { loadCreds, StudioSession } from "./_auth.js";
import { isFreshnessCheckableDirectDeployFailure } from "../lib/deploy-result.js";
import { recoverPublicRuntime } from "../lib/deploy-runtime-recovery.js";
import { verifyRuntime } from "../lib/deploy-verify.js";
import {
  describeRouteError,
  isAbortError,
  isFetchDisconnect,
} from "../lib/deploy-http.js";

const TAR_PATH = "/usr/bin/tar";
const PACKAGE_JSON = "package.json";
const DIR = process.env.DIR || "harper-app";
const RESTART_TIMEOUT_MS = numberEnv("HARPER_RESTART_TIMEOUT_MS", 60000);
const DEPLOY_TIMEOUT_MS = numberEnv("HARPER_DEPLOY_TIMEOUT_MS", 420000);
const creds = loadCreds();

/**
 * Reads a positive-integer environment override, falling back on invalid input.
 * @param key - Environment variable name.
 * @param fallback - Default used when unset, non-numeric, or non-positive.
 * @returns The resolved millisecond value.
 */
function numberEnv(key: string, fallback: number): number {
  const parsed = Number(process.env[key] ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads a string field from `package.json`.
 * @param field - The field to read (`name` or `version`).
 * @param fallback - Value used when the field is absent.
 * @returns The resolved field value.
 */
function packageField(field: "name" | "version", fallback: string): string {
  const manifest = JSON.parse(
    readFileSync(PACKAGE_JSON, "utf8")
  ) as PackageManifest;
  return manifest[field] || fallback;
}

/** Minimal `package.json` fields this script reads. */
interface PackageManifest {
  readonly name?: string;
  readonly version?: string;
}

const PROJECT = process.env.PROJECT || packageField("name", "harper-app");

/**
 * Post-deploy freshness routes, parameterized so projects gate on the routes
 * that matter to them without editing this script.
 * @returns Absolute route paths to verify, defaulting to `["/"]`.
 */
function verifyRoutes(): readonly string[] {
  const configured = (process.env.DEPLOY_VERIFY_ROUTES ?? "")
    .split(",")
    .map(route => route.trim())
    .filter(Boolean);
  return configured.length > 0 ? configured : ["/"];
}

/** Deployment archive metadata needed for upload and progress output. */
interface DeployPackage {
  readonly bytes: number;
  readonly payload: string;
  readonly payloadBytes: number;
}

/** Minimal Fabric response shape returned by deploy_component / restart. */
interface DeployResult {
  readonly body: unknown;
  readonly status: number;
}

/**
 * Builds the deploy archive while excluding local-only dependencies and caches.
 * @param dir - Harper component directory to package.
 * @returns The compressed archive bytes ready to send to Fabric.
 */
function buildTarball(dir: string): Buffer {
  const tmp = mkdtempSync(join(tmpdir(), "hdb-deploy-"));
  const out = join(tmp, "pkg.tar.gz");
  const args = [
    "--exclude=./node_modules",
    "--exclude=./.git",
    "--exclude=./.harperdb",
    "--exclude=./tests/screenshots",
    "--exclude=./._*",
    "--exclude=./**/._*",
    "-czf",
    out,
    "-C",
    dir,
    ".",
  ];
  const r = spawnSync(TAR_PATH, args, {
    stdio: "inherit",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  if (r.status !== 0) throw new Error(`tar failed (${r.status})`);
  const bytes = readFileSync(out);
  rmSync(tmp, { recursive: true, force: true });
  return bytes;
}

/**
 * Formats byte counts for the short deployment progress log.
 * @param n - Number of bytes to display.
 * @returns A compact byte, kilobyte, or megabyte label.
 */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

/**
 * Builds the base64 payload and byte counts used by Fabric deployment.
 * @returns Archive metadata for logging and upload.
 */
function buildDeployPackage(): DeployPackage {
  const tgz = buildTarball(DIR);
  const payload = tgz.toString("base64");
  return { bytes: tgz.length, payload, payloadBytes: payload.length };
}

/**
 * Converts the public cluster URL into the direct Operations API endpoint.
 * @returns Public node Operations API URL on `:9925`.
 */
function directOpsUrl(): string {
  const url = new URL(creds.clusterUrl ?? "");
  return `${url.protocol}//${url.hostname}:9925/`;
}

/**
 * Builds the Basic auth header for the public node's Operations API.
 * @returns A `Basic <base64>` Authorization header value.
 */
function directAuthHeader(): string {
  const encoded = Buffer.from(`${creds.username}:${creds.password}`).toString(
    "base64"
  );
  return `Basic ${encoded}`;
}

/**
 * Runs an operation directly against the public Harper node's `:9925` API.
 * @param operation - Harper operation name.
 * @param extra - Additional operation fields.
 * @param timeoutMs - Optional request timeout.
 * @returns Status and parsed response body.
 */
async function directClusterOp(
  operation: string,
  extra: Readonly<Record<string, unknown>> = {},
  timeoutMs?: number
): Promise<DeployResult> {
  const controller =
    timeoutMs === undefined ? undefined : new AbortController();
  const timeout =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetch(directOpsUrl(), {
      method: "POST",
      headers: {
        Authorization: directAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation, ...extra }),
      signal: controller?.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    return { status: response.status, body };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/**
 * Prints a Fabric deployment/restart result and exposes its status.
 * @param dep - Fabric response.
 * @returns The HTTP status returned by Fabric.
 */
function logDeployResult(dep: DeployResult): number {
  console.log(`  status: ${dep.status}`);
  console.log(`  body:   ${JSON.stringify(dep.body).slice(0, 300)}`);
  return dep.status;
}

/**
 * Announces then submits the direct `:9925` component deploy.
 * @param payload - Base64-encoded deployment archive.
 * @returns Harper's direct deploy response.
 */
async function announceDirectDeploy(payload: string): Promise<DeployResult> {
  console.log(`▶ direct deploy_component ${directOpsUrl()} project=${PROJECT}`);
  return await directClusterOp(
    "deploy_component",
    { project: PROJECT, payload, restart: true },
    DEPLOY_TIMEOUT_MS
  );
}

/**
 * Deploys the component directly to the public node's Operations API.
 * @returns The HTTP status returned by Harper.
 */
async function deployPublicRuntime(): Promise<number> {
  const deployPackage = buildDeployPackage();
  const result = await announceDirectDeploy(deployPackage.payload);
  const status = logDeployResult(result);
  if (isFreshnessCheckableDirectDeployFailure(status, result.body)) {
    console.warn(
      "  direct deploy reached the origin node but replication failed; continuing to runtime freshness checks"
    );
    return await restartPublicRuntime();
  }
  return status;
}

/**
 * Restarts the public node after a direct deploy.
 * @returns The HTTP status returned by Harper, or 200 on a tolerated timeout.
 */
async function restartPublicRuntime(): Promise<number> {
  try {
    return logDeployResult(
      await directClusterOp("restart", {}, RESTART_TIMEOUT_MS)
    );
  } catch (error) {
    if (!isAbortError(error) && !isFetchDisconnect(error)) throw error;
    const reason = isAbortError(error)
      ? `timed out after ${RESTART_TIMEOUT_MS}ms`
      : "dropped the Operations API connection";
    console.log(
      `  restart request ${reason}; continuing to data-plane readiness checks`
    );
    return 200;
  }
}

/**
 * Announces then submits the component through the Fabric Studio proxy.
 * @param studio - Authenticated Studio session.
 * @param deployPackage - Prepared deploy archive metadata.
 * @returns Fabric deployment response.
 */
async function announceStudioDeploy(
  studio: StudioSession,
  deployPackage: DeployPackage
): Promise<DeployResult> {
  console.log(`▶ packaging ${DIR}/`);
  console.log(
    `  package: ${fmtBytes(deployPackage.bytes)} → ${fmtBytes(deployPackage.payloadBytes)} base64`
  );
  console.log(`▶ deploy_component project=${PROJECT}`);
  return (await studio.clusterOp(creds.clusterId ?? "", "deploy_component", {
    project: PROJECT,
    payload: deployPackage.payload,
    restart: "rolling",
    replicated: true,
  })) as DeployResult;
}

/**
 * Packages and submits the component through the Fabric Studio proxy.
 * @param studio - Authenticated Studio session.
 * @returns Fabric deployment response.
 */
async function deployComponent(studio: StudioSession): Promise<DeployResult> {
  const deployPackage = buildDeployPackage();
  const result = await announceStudioDeploy(studio, deployPackage);
  logDeployResult(result);
  return result;
}

/**
 * Attempts the primary direct `:9925` deploy, reporting whether it succeeded.
 * @returns True when the direct deploy returned HTTP 200.
 */
async function tryDirectDeploy(): Promise<boolean> {
  if (process.env.DEPLOY_VIA === "studio") {
    console.log("▶ DEPLOY_VIA=studio — skipping the direct ops deploy");
    return false;
  }
  if (!creds.clusterUrl) {
    console.warn("  HARPER_CLUSTER_URL not set — cannot use the direct path");
    return false;
  }
  try {
    const status = await deployPublicRuntime();
    if (status === 200) return true;
    console.warn(`  direct ops deploy returned ${status}`);
    return false;
  } catch (error) {
    if (!isFetchDisconnect(error) && !isAbortError(error)) throw error;
    console.warn(`  direct ops API unreachable (${describeRouteError(error)})`);
    return false;
  }
}

/**
 * Logs in to Studio for the control-plane fallback.
 * @returns An authenticated Studio session.
 */
async function loginStudio(): Promise<StudioSession> {
  const studio = await new StudioSession(creds).login();
  console.log(`▶ Studio login as ${creds.username}`);
  return studio;
}

/**
 * Deploys through the Fabric Studio control-plane proxy fallback.
 * @returns Whether the Studio deploy succeeded.
 */
async function deployViaStudio(): Promise<boolean> {
  if (!creds.clusterId) {
    console.error(
      "  Studio fallback requires HARPER_CLUSTER_ID; cannot deploy"
    );
    return false;
  }
  const studio = await loginStudio();
  const result = await deployComponent(studio);
  // deploy_component already restarts the runtime (restart: "rolling"); the
  // freshness gate is the real correctness guard, so we do not block on an
  // explicit second restart here.
  return result.status === 200;
}

/**
 * Deploys the component, preferring the direct Operations API and falling back
 * to the Studio proxy.
 * @returns Whether the component was deployed successfully.
 */
async function deployAndRestart(): Promise<boolean> {
  if (await tryDirectDeploy()) return true;
  console.warn("  falling back to the Studio control-plane proxy deploy");
  return await deployViaStudio();
}

/**
 * Verifies the deployed runtime, recovering the public node once on failure.
 * @param clusterUrl - Base URL for the deployed Harper component.
 * @returns 0 when the runtime is healthy, 1 when recovery also failed.
 */
async function verifyOrRecover(clusterUrl: string): Promise<number> {
  const expected = packageField("version", "0.0.0");
  const routes = verifyRoutes();
  try {
    await verifyRuntime(clusterUrl, expected, routes);
    return 0;
  } catch (error) {
    const recovered = await recoverPublicRuntime(error, {
      deployPublicRuntime,
      restartPublicRuntime,
      verifyRuntime: () => verifyRuntime(clusterUrl, expected, routes),
    });
    return recovered ? 0 : 1;
  }
}

/**
 * Runs credential validation, component upload, and the post-deploy health
 * check, returning the process exit code.
 * @returns 0 on success, non-zero on failure.
 */
async function main(): Promise<number> {
  if (!creds.username || !creds.password) {
    console.error(
      "missing HARPER_ADMIN_USERNAME / HARPER_ADMIN_PASSWORD (env, keychain, or ~/.harper-fabric-credentials)"
    );
    return 2;
  }
  if (!(await deployAndRestart())) return 1;
  if (!creds.clusterUrl) {
    console.log(
      "  (HARPER_CLUSTER_URL not set; skipping post-deploy verification)"
    );
    return 0;
  }
  return await verifyOrRecover(creds.clusterUrl);
}

main()
  .then(code => {
    if (code !== 0) process.exit(code);
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
  });
