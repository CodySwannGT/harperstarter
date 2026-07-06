/**
 * Generic smoke-test helpers for the deployed web UI.
 *
 * Deliberately template-minimal: connection/normalization, a check record,
 * retry, a browser-context factory, a post-restart stability gate, and a
 * deployed-version assertion. Add project-specific scenarios in sibling
 * `web_smoke_*.ts` files and compose them from `web_smoke.ts`.
 */
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext, Page } from "playwright";

/** Default smoke target: the bootstrap-installed local Harper cluster. */
const DEFAULT_BASE_URL = "http://127.0.0.1:9926";
const VERSION_MODULE_TIMEOUT = 8000;
const STABILITY_REQUIRED_ROUNDS = 2;
const STABILITY_PROBE_TIMEOUT = 8000;
const STABILITY_ROUND_DELAY = 4000;
const STABILITY_DEADLINE = 120000;
const NAVIGATION_ATTEMPTS = 3;
const NAVIGATION_RETRY_DELAY_MS = 1500;

/**
 * Normalizes the smoke target so route joins never create double slashes.
 * @param baseUrl - Raw smoke target from the environment.
 * @returns The base URL without trailing slash characters.
 */
function normalizeSmokeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/")
    ? normalizeSmokeBaseUrl(baseUrl.slice(0, -1))
    : baseUrl;
}

export const BASE = normalizeSmokeBaseUrl(
  process.env.BASE_URL || DEFAULT_BASE_URL
);
export const SHOTS = resolve("tests/screenshots");
const isLocalDev = /^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE);

/** One smoke assertion produced by a scenario. */
export interface Check {
  readonly label: string;
  readonly passed: boolean;
}

/**
 * Creates a passing smoke assertion.
 * @param label - Human-readable assertion text.
 * @returns A passing check record.
 */
function pass(label: string): Check {
  return { label, passed: true };
}

const fail = (label: string, detail = ""): Check => ({
  label: `${label}${detail ? ` - ${detail}` : ""}`,
  passed: false,
});

/**
 * Converts a boolean expression into a smoke check.
 * @param condition - Whether the assertion passed.
 * @param label - Human-readable assertion text.
 * @param detail - Short detail captured from the page.
 * @returns A pass or fail check.
 */
export function check(condition: boolean, label: string, detail = ""): Check {
  return (
    [fail(label, detail), pass(label)][Number(condition)] ?? fail(label, detail)
  );
}

/**
 * Waits for the supplied duration.
 * @param milliseconds - Time to wait.
 */
async function wait(milliseconds: number): Promise<void> {
  await new Promise(resolveWait => setTimeout(resolveWait, milliseconds));
}

/**
 * Executes one retry attempt and recurses on failure.
 * @param action - Action to execute.
 * @param attempts - Total attempts before rethrowing the last error.
 * @param delayMs - Base delay between attempts.
 * @param attempt - Current attempt number.
 * @returns The action result from the first successful attempt.
 */
async function retryAttempt<T>(
  action: () => Promise<T>,
  attempts: number,
  delayMs: number,
  attempt: number
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (attempt >= attempts) throw error;
    await wait(delayMs * attempt);
    return await retryAttempt(action, attempts, delayMs, attempt + 1);
  }
}

/**
 * Retries an async browser action after short, escalating waits.
 * @param action - Action to execute.
 * @param attempts - Total attempts before rethrowing the last error.
 * @param delayMs - Base delay between attempts.
 * @returns The action result from the first successful attempt.
 */
async function retryAsync<T>(
  action: () => Promise<T>,
  attempts: number,
  delayMs: number
): Promise<T> {
  return await retryAttempt(action, attempts, delayMs, 1);
}

/**
 * Navigates with retries for transient post-deploy connection resets.
 * @param page - Browser page to navigate.
 * @param url - Absolute URL to open.
 * @returns The navigation response, or null when the driver returns none.
 */
export async function smokeGoto(
  page: Page,
  url: string
): Promise<import("playwright").Response | null> {
  return await retryAsync(
    () => page.goto(url, { waitUntil: "domcontentloaded" }),
    NAVIGATION_ATTEMPTS,
    NAVIGATION_RETRY_DELAY_MS
  );
}

/**
 * Opens a browser context with the standard smoke viewport.
 * @param browser - Browser that owns the context.
 * @param viewport - Viewport dimensions for the context.
 * @returns A configured Playwright context.
 */
export async function newContext(
  browser: Browser,
  viewport: Readonly<{ height: number; width: number }>
): Promise<BrowserContext> {
  return await browser.newContext({ viewport, ignoreHTTPSErrors: true });
}

/**
 * Resolves after the given delay.
 * @param ms - Milliseconds to wait.
 * @returns A promise that resolves after `ms`.
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Probes the root route once; healthy when it returns a 2xx within the budget.
 * @param page - Browser page whose request context is reused.
 * @returns True when the root route responded OK.
 */
async function probeRootRound(page: Page): Promise<boolean> {
  return await page.request
    .get(`${BASE}/`, { timeout: STABILITY_PROBE_TIMEOUT })
    .then(response => response.ok())
    .catch(() => false);
}

/**
 * Recursively polls the root route until it is healthy for the required number
 * of consecutive rounds, or the deadline passes (then proceeds best-effort).
 * @param page - Browser page whose request context is reused.
 * @param healthyRounds - Consecutive healthy rounds observed so far.
 * @param deadline - Epoch ms after which to stop waiting and proceed.
 * @returns Resolves once stable or the deadline passes.
 */
async function awaitStable(
  page: Page,
  healthyRounds: number,
  deadline: number
): Promise<void> {
  if (healthyRounds >= STABILITY_REQUIRED_ROUNDS) {
    console.log(`✓ deployed cluster stable (${healthyRounds} healthy rounds)`);
    return;
  }
  if (Date.now() >= deadline) {
    console.log("⚠ cluster did not stabilize before deadline; proceeding");
    return;
  }
  const healthy = await probeRootRound(page);
  await delay(STABILITY_ROUND_DELAY);
  return awaitStable(page, healthy ? healthyRounds + 1 : 0, deadline);
}

/**
 * Gates the deploy smoke on cluster stability after a Harper restart. The smoke
 * runs immediately after the deploy restarts Harper, during which the Fabric
 * edge intermittently stalls requests; this polls the root route until it
 * responds cleanly for several consecutive rounds (also paying cold-start).
 * Best-effort: proceeds after a deadline and never throws. Skipped locally.
 * @param page - Browser page whose request context is reused.
 */
export async function awaitDeployedClusterStable(page: Page): Promise<void> {
  if (isLocalDev) return;
  await awaitStable(page, 0, Date.now() + STABILITY_DEADLINE);
}

/**
 * Extracts `APP_VERSION` from the generated browser version module.
 * @param source - JavaScript module text from `/version.js`.
 * @returns The version string, or an empty string when malformed.
 */
function parseVersionModule(source: string): string {
  return /APP_VERSION\s*=\s*["']([^"']+)["']/.exec(source)?.[1] ?? "";
}

/**
 * Resolves the version this smoke run should observe on the deployed runtime.
 *
 * Prefers `SMOKE_EXPECTED_VERSION` (set by the deploy workflow to the freshly
 * released version), falling back to the local `package.json` version so the
 * check is still meaningful when run by hand against local Harper.
 * @returns The expected `APP_VERSION`, or an empty string when unavailable.
 */
async function expectedRuntimeVersion(): Promise<string> {
  const fromEnv = process.env.SMOKE_EXPECTED_VERSION;
  if (fromEnv) return fromEnv;
  const manifest = JSON.parse(
    await readFile("package.json", "utf8")
  ) as Readonly<{ version?: string }>;
  return manifest.version ?? "";
}

/**
 * Asserts the deployed `/version.js` marker matches the expected release.
 * @param page - Browser page whose request context is reused.
 * @returns A smoke assertion for the deployed runtime version.
 */
export async function smokeExpectedRuntimeVersion(page: Page): Promise<Check> {
  const label = "deploy runtime: /version.js matches expected release";
  const expected = await expectedRuntimeVersion();
  if (!expected) return pass(`${label} (no expected version configured)`);
  const observed = await page.request
    .get(`${BASE}/version.js`, { timeout: VERSION_MODULE_TIMEOUT })
    .then(async response =>
      response.ok() ? parseVersionModule(await response.text()) : ""
    )
    .catch(() => "");
  return check(
    observed === expected,
    label,
    `expected ${expected}, observed ${observed || "missing"}`
  );
}
