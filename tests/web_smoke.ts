#!/usr/bin/env node
/**
 * Generic Playwright smoke test for the deployed web UI.
 *
 * Template-minimal by design: it asserts the root page loads with real
 * content and that the deployed `/version.js` marker matches the expected
 * release. Grow it by adding `web_smoke_*.ts` scenarios and composing them
 * into `runScenarios` below. Screenshots land in `tests/screenshots`.
 */
import { mkdir } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright";
import {
  BASE,
  SHOTS,
  awaitDeployedClusterStable,
  check,
  newContext,
  smokeExpectedRuntimeVersion,
  smokeGoto,
  type Check,
} from "./web_smoke_support.js";

const ROOT_CONTENT_TIMEOUT = 30000;

/** Rendered facts read from the root document after load. */
interface RootRenderFacts {
  readonly bodyLength: number;
  readonly hasHeading: boolean;
}

/**
 * Verifies the root route loads and renders real content, not a blank shell.
 * @param page - Browser page shared by the smoke scenarios.
 * @returns Smoke assertions for the root page load.
 */
async function smokeRoot(page: Page): Promise<readonly Check[]> {
  const response = await smokeGoto(page, `${BASE}/`).catch(() => null);
  return response
    ? await rootContentChecks(page, response)
    : [check(false, "root: GET / responds 2xx", "navigation failed")];
}

/**
 * Waits for the root document to render content, then reads it.
 * @param page - Browser page rendering the root route.
 * @returns The rendered root document facts.
 */
async function readRootFacts(page: Page): Promise<RootRenderFacts> {
  await page
    .waitForFunction(
      () => document.body.innerText.trim().length > 0,
      undefined,
      { timeout: ROOT_CONTENT_TIMEOUT }
    )
    .catch(() => undefined);
  return await page.evaluate(
    (): RootRenderFacts => ({
      bodyLength: document.body.innerText.trim().length,
      hasHeading: Boolean(document.querySelector("h1")),
    })
  );
}

/**
 * Reads the loaded root document and produces its content assertions.
 * @param page - Browser page rendering the root route.
 * @param response - The successful root navigation response.
 * @returns Smoke assertions for the root page content.
 */
async function rootContentChecks(
  page: Page,
  response: import("playwright").Response
): Promise<readonly Check[]> {
  const facts = await readRootFacts(page);
  await page.screenshot({ path: `${SHOTS}/01-root.png`, fullPage: true });
  return [
    check(
      response.ok(),
      "root: GET / responds 2xx",
      `status ${response.status()}`
    ),
    check(
      facts.bodyLength > 0,
      "root: page renders body content",
      `body length ${facts.bodyLength}`
    ),
    check(facts.hasHeading, "root: page renders a heading"),
  ];
}

/**
 * Runs the ordered smoke scenarios in a single browser session.
 * @param page - Browser page shared by the scenarios.
 * @returns All smoke assertions.
 */
async function runScenarios(page: Page): Promise<readonly Check[]> {
  return [await smokeExpectedRuntimeVersion(page), ...(await smokeRoot(page))];
}

/**
 * Prints the aggregate smoke result and sets the process exit code on failure.
 * @param checks - All checks collected during the smoke journey.
 */
function printResults(checks: readonly Check[]): void {
  const failures = checks.filter(result => !result.passed);
  console.log("\n──────── SMOKE TEST RESULTS ────────");
  for (const result of checks)
    console.log(`  ${result.passed ? "✓" : "✗"} ${result.label}`);
  console.log(
    `──────── ${failures.length === 0 ? "PASS" : "FAIL"} (${checks.length - failures.length}/${checks.length}) ────────\n`
  );
  console.log("Screenshots written to", SHOTS);
  process.exitCode = failures.length ? 1 : 0;
}

/**
 * Runs the smoke scenarios against a freshly launched browser.
 * @param browser - Browser used for the smoke session.
 */
async function runAgainst(browser: Browser): Promise<void> {
  const context = await newContext(browser, { width: 1280, height: 900 });
  try {
    const page = await context.newPage();
    await mkdir(SHOTS, { recursive: true });
    console.log("▶ smoke against", BASE);
    await awaitDeployedClusterStable(page);
    printResults(await runScenarios(page));
  } finally {
    await context.close();
  }
}

/**
 * Launches the browser and runs every smoke scenario once.
 */
async function main(): Promise<void> {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-http2"],
  });
  try {
    await runAgainst(browser);
  } finally {
    await browser.close();
  }
}

main().catch((err: unknown) => {
  console.error(
    "smoke runner crashed:",
    err instanceof Error ? err.stack || err.message : err
  );
  process.exitCode = 2;
});
