#!/usr/bin/env node
/**
 * Table-generic verifier.
 *
 * Derives the table list from Harper's `describe_all` rather than a hardcoded
 * list, then reports a row count per table plus a total. Adding a table to the
 * schema needs no change here.
 */
import { describeTarget, op, sql } from "../lib/harper.js";

/** Harper `describe_all` payload: table names are keys under the database. */
interface DescribeAllResult {
  readonly data: Readonly<Record<string, unknown>>;
}

/** `COUNT(*)` row returned by Harper SQL. */
interface CountRow {
  readonly [key: string]: unknown;
  readonly n: number;
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
 * Counts rows in one table, printing a padded line.
 * @param table - Table name in the `data` database.
 * @returns The table's row count.
 */
async function countTable(table: string): Promise<number> {
  const rows = await sql<CountRow>(`SELECT COUNT(*) AS n FROM data.${table}`);
  const n = rows[0]?.n ?? 0;
  console.log(`  ${table.padEnd(35)} ${String(n).padStart(4)}`);
  return n;
}

/**
 * Lists tables via `describe_all` and reports a row count for each.
 * @returns Resolves once the count report has printed.
 */
async function main(): Promise<void> {
  const described = await op<DescribeAllResult>({ operation: "describe_all" });
  const tables = sortStrings(Object.keys(described.data ?? {}));
  const counts = await Promise.all(tables.map(countTable));
  const total = counts.reduce((sum, count) => sum + count, 0);
  console.log(`  ${"TOTAL".padEnd(35)} ${String(total).padStart(4)}`);
}

console.error(`[verify] target: ${describeTarget()}`);
console.log("\n══ Row counts per table ═════════════════════════════════");
await main();
console.log("\nverify complete");
