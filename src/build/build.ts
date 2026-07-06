import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const HARPER_WEB_DIR = "harper-app/web";
const HARPER_APP_DIR = "harper-app";
const DIST_WEB_DIR = "dist/web";
const PACKAGE_JSON = "package.json";
const VERSION_MODULE = "version.js";
const execFileAsync = promisify(execFile);

/** Minimal package fields needed for generated browser metadata. */
interface PackageManifest {
  readonly version?: string;
}

/**
 * Bundles generated browser modules into Harper's static web root and writes
 * the version marker.
 * @returns Promise that resolves after generated web files are deploy-ready.
 */
async function copyGeneratedWeb(): Promise<void> {
  await mkdir(HARPER_WEB_DIR, { recursive: true });
  await removeGeneratedWebJavaScript(HARPER_WEB_DIR);
  await bundleWebEntrypoints();
  await writeGeneratedVersionModule();
}

/**
 * Removes previously generated browser JavaScript so a deploy cannot retain a
 * stale helper module after the page entries are re-bundled.
 * @param dir - Static web directory to clean recursively.
 * @returns Promise that resolves once stale JavaScript is removed.
 */
async function removeGeneratedWebJavaScript(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeGeneratedWebJavaScript(path);
      continue;
    }
    if (entry.name.endsWith(".js")) await rm(path, { force: true });
  }
}

/**
 * Discovers the browser entrypoints to bundle: every top-level `*.js` compiled
 * into `dist/web` (excluding the generated version marker). Globbing the
 * compiled output keeps the build project-agnostic — adding a page needs no
 * change here.
 * @returns Absolute-relative entrypoint paths under `dist/web`.
 */
async function webEntrypoints(): Promise<readonly string[]> {
  const entries = await readdir(DIST_WEB_DIR, {
    withFileTypes: true,
  }).catch(() => []);
  return entries
    .filter(
      entry =>
        entry.isFile() &&
        entry.name.endsWith(".js") &&
        entry.name !== VERSION_MODULE
    )
    .map(entry => join(DIST_WEB_DIR, entry.name));
}

/**
 * Uses Bun's browser bundler to collapse each page entrypoint into one
 * deployable module. Bundling inlines transitive imports, so the Fabric
 * serving node never fields a cold-boot burst of dozens of concurrent
 * ES-module requests — which also makes per-import cache-busting moot.
 * @returns Promise that resolves once every entrypoint is bundled.
 */
async function bundleWebEntrypoints(): Promise<void> {
  const entrypoints = await webEntrypoints();
  if (entrypoints.length > 0) {
    await execFileAsync(
      "bun",
      [
        "build",
        ...entrypoints,
        "--target=browser",
        "--format=esm",
        "--root",
        DIST_WEB_DIR,
        "--entry-naming",
        "[dir]/[name].[ext]",
        "--outdir",
        HARPER_WEB_DIR,
      ],
      { maxBuffer: 1024 * 1024 * 10 }
    );
  }
}

/**
 * Writes the package version into the browser web root at build time so the
 * deploy freshness gate and smoke can assert the served build.
 * @returns Promise that resolves once the version module is refreshed.
 */
async function writeGeneratedVersionModule(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(PACKAGE_JSON, "utf8")
  ) as PackageManifest;
  const version = manifest.version || "0.0.0";
  await writeFile(
    join(HARPER_WEB_DIR, VERSION_MODULE),
    `export const APP_VERSION = ${JSON.stringify(version)};\n`
  );
}

/**
 * Copies all compiled Harper resource modules into the Fabric component root.
 *
 * Also mirrors `dist/lib/` into `harper-app/lib/` so harper resources can
 * safely `import { ... } from "../lib/..."` from shared helpers in
 * `src/lib/`. Without this, Fabric refuses to load `resources.js` because
 * the relative `../lib/*.js` path resolves to a directory that doesn't
 * exist in the deployed component root.
 * @returns Promise that resolves after resource entrypoint and helpers are copied.
 */
async function copyHarperResources(): Promise<void> {
  await mkdir(HARPER_APP_DIR, { recursive: true });
  await cp("dist/harper", HARPER_APP_DIR, {
    recursive: true,
    filter: source => source.endsWith(".js") || !source.includes("."),
  });
  try {
    await cp("dist/lib", join(HARPER_APP_DIR, "lib"), {
      recursive: true,
      filter: source => source.endsWith(".js") || !source.includes("."),
    });
    // Rewrite parent-dir lib imports to same-dir lib imports inside the
    // component root. `dist/harper/foo.js`'s compiled `../lib/bar.js`
    // would otherwise resolve to `<repo-root>/lib/...` (one level above
    // `harper-app/`) because Node ESM follows the file's real path, not
    // the symlinked component path Fabric expects. Pointing the same
    // imports at `./lib/` keeps everything within `harper-app/` so the
    // deployed component is self-contained.
    await rewriteParentLibImports(HARPER_APP_DIR);
  } catch (error) {
    throw new Error(
      `build: failed to mirror dist/lib → ${join(HARPER_APP_DIR, "lib")} and rewrite parent-lib imports (likely a missing dist/lib from a skipped tsc, or a FS permission error): ${String(error)}`,
      { cause: error }
    );
  }
}

/**
 * Replaces `from "../lib/..."` with `from "./lib/..."` in every JS file
 * directly under the Harper component root. The component root is flat —
 * the `lib/` mirror lives as a sibling of the resource files — so the
 * rewrite is shallow by design (we deliberately do not recurse into
 * `web/` or `node_modules/`).
 * @param dir - Component root containing the copied harper resources.
 * @returns Promise that resolves after all relevant imports are rewritten.
 */
async function rewriteParentLibImports(dir: string): Promise<void> {
  const importRe =
    /(\bfrom\s+["']|\bimport\s*\(\s*["']|\bimport\s+["'])\.\.\/lib\//g;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const path = join(dir, entry.name);
    const source = await readFile(path, "utf8");
    const rewritten = source.replace(importRe, "$1./lib/");
    if (rewritten !== source) await writeFile(path, rewritten);
  }
}

// Copies compiled Harper resources into the component root expected by Fabric.
const main = async (): Promise<void> => {
  await copyHarperResources();
  await copyGeneratedWeb();

  // tsc may leave empty source subdirectories in dist; keep dist readable.
  for (const dir of ["dist/harper", "dist/web"]) {
    try {
      const entries = await readdir(dir);
      if (entries.length === 0) await rm(dir, { recursive: true, force: true });
    } catch {
      // Directory cleanup is cosmetic.
    }
  }

  console.log(
    `built Harper JS resources into ${join(HARPER_APP_DIR, "resources.js")} and web/*.js`
  );
};

await main();
