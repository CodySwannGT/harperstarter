#!/usr/bin/env node
/**
 * Table-generic seeder.
 *
 * Every top-level key in `src/data/seed-data.json` is treated as a Harper
 * table name and every value as the rows to upsert into it, so adding a table
 * to the seed file needs no code change here. Writes go through the operations
 * API (`upsert`), which targets local Harper's Unix socket by default and a
 * deployed cluster when `HARPER_CLUSTER_URL` + admin credentials are set.
 */
import seedData from "../data/seed-data.json" with { type: "json" };
import { describeTarget, upsert } from "../lib/harper.js";

console.error(`[seed] target: ${describeTarget()}`);

for (const [table, records] of Object.entries(seedData)) {
  const rows = records as ReadonlyArray<Record<string, unknown>>;
  const touched = await upsert(
    table,
    rows.map(row => ({ ...row }))
  );
  console.log(`  upsert ${table}: ${rows.length} (${touched} touched)`);
}

console.log("\nseed complete");
