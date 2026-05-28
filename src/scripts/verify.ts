import { harperConfig } from "../lib/harper.js";

interface GreetingRow {
  readonly id: string;
  readonly message: string;
}

async function main(): Promise<void> {
  const config = harperConfig();
  const response = await fetch(`${config.baseUrl}/Greeting/`, {
    headers: { authorization: config.authHeader },
  });
  if (!response.ok) {
    throw new Error(`GET /Greeting failed: ${response.status}`);
  }
  const rows = (await response.json()) as ReadonlyArray<GreetingRow>;
  if (rows.length === 0) {
    throw new Error(
      "verify: no Greeting rows found. Run `bun run seed` first."
    );
  }
  console.log(`verify: found ${rows.length} Greeting row(s)`);
  for (const row of rows) console.log(`  - ${row.id}: ${row.message}`);

  const helloResponse = await fetch(`${config.baseUrl}/Hello`);
  if (!helloResponse.ok) {
    throw new Error(`GET /Hello failed: ${helloResponse.status}`);
  }
  const hello = (await helloResponse.json()) as { message: string };
  console.log(`verify: /Hello → ${hello.message}`);
}

await main();
