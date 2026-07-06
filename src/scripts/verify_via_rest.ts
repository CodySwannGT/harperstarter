#!/usr/bin/env node
/**
 * Table-generic REST verifier.
 *
 * Derives the table list from Harper's `describe_all` (an operations call),
 * then reads each table over the public REST endpoint (`GET /<table>/`) and
 * reports a row count, exercising the data-plane REST surface end to end.
 * Requires a REST target + admin credentials via `HDB_*` or the
 * `HARPER_CLUSTER_URL` / `HARPER_ADMIN_*` resolution in `loadCreds`.
 */
import { basicAuth, restGet } from "../lib/rest.js";
import { op } from "../lib/harper.js";
import { loadCreds } from "./_auth.js";

/** Harper `describe_all` payload: table names are keys under the database. */
interface DescribeAllResult {
  readonly data: Readonly<Record<string, unknown>>;
}

/** Resolved REST target for the verifier. */
interface RestTarget {
  readonly base: string;
  readonly auth: string;
}

/**
 * Removes trailing slashes without a backtracking regex.
 * @param value - URL-like value that may end in slashes.
 * @returns The value without trailing slash characters.
 */
function stripTrailingSlashes(value: string): string {
  return value.endsWith("/") ? stripTrailingSlashes(value.slice(0, -1)) : value;
}

/**
 * Returns strings in locale-aware alphabetical order.
 * @param values - Values to order for stable reporting.
 * @returns A sorted copy of the supplied strings.
 */
function sortStrings(values: Iterable<string>): readonly string[] {
  return [...values].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolves the REST base URL and Basic auth header from env + credentials.
 * @returns The REST target, or throws when required inputs are missing.
 */
function resolveRestTarget(): RestTarget {
  const creds = loadCreds();
  const clusterBase = stripTrailingSlashes(creds.clusterUrl ?? "");
  const base = stripTrailingSlashes(
    process.env.HDB_TARGET_URL ?? (clusterBase ? `${clusterBase}:9925/` : "")
  );
  const username = process.env.HDB_ADMIN_USERNAME ?? creds.username;
  const password = process.env.HDB_ADMIN_PASSWORD ?? creds.password;
  if (!base) {
    throw new Error(
      "REST target required: set HDB_TARGET_URL or HARPER_CLUSTER_URL"
    );
  }
  if (!username || !password) {
    throw new Error(
      "admin credentials required: set HDB_ADMIN_USERNAME/PASSWORD or HARPER_ADMIN_USERNAME/PASSWORD"
    );
  }
  return { base, auth: basicAuth(username, password) };
}

/**
 * Counts rows in one table over REST, printing a padded line when non-empty.
 * @param target - Resolved REST base + auth.
 * @param table - Table name to read.
 * @returns The table's row count.
 */
async function countTable(target: RestTarget, table: string): Promise<number> {
  const rows = await restGet(target.base, table, target.auth);
  if (rows.length)
    console.log(`  ${table.padEnd(35)} ${String(rows.length).padStart(4)}`);
  return rows.length;
}

/**
 * Lists tables via `describe_all` and reports a REST row count for each.
 * @returns Resolves once the count report has printed.
 */
async function main(): Promise<void> {
  const target = resolveRestTarget();
  const described = await op<DescribeAllResult>({ operation: "describe_all" });
  const tables = sortStrings(Object.keys(described.data ?? {}));
  const counts = await Promise.all(
    tables.map(table => countTable(target, table))
  );
  const total = counts.reduce((sum, count) => sum + count, 0);
  console.log(`  ${"TOTAL".padEnd(35)} ${String(total).padStart(4)}`);
}

console.log("\n══ Row counts per table (REST) ══════════════════════════");
await main();
console.log("\nverify_via_rest complete");
