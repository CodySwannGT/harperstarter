import { harperConfig } from "../lib/harper.js";

/** A `Greeting` row returned by `GET /Greeting`. */
interface GreetingRow {
  readonly id: string;
  readonly message: string;
}

/** Response body returned by the `/Hello` resource. */
interface HelloPayload {
  readonly message: string;
}

/**
 * Fetches and validates the seeded `Greeting` rows from Harper.
 * @param config - Resolved Harper connection settings.
 * @returns Promise resolving to the non-empty list of Greeting rows.
 */
async function fetchGreetings(
  config: ReturnType<typeof harperConfig>
): Promise<ReadonlyArray<GreetingRow>> {
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
  return rows;
}

/**
 * Fetches the `/Hello` resource and returns its rendered message.
 * @param config - Resolved Harper connection settings.
 * @returns Promise resolving to the greeting message served at `/Hello`.
 */
async function fetchHelloMessage(
  config: ReturnType<typeof harperConfig>
): Promise<string> {
  const helloResponse = await fetch(`${config.baseUrl}/Hello`);
  if (!helloResponse.ok) {
    throw new Error(`GET /Hello failed: ${helloResponse.status}`);
  }
  const hello = (await helloResponse.json()) as HelloPayload;
  return hello.message;
}

/**
 * Verifies the local Harper deployment by checking the seeded greetings and
 * the `/Hello` resource, logging a human-readable summary.
 * @returns Promise that resolves once verification has completed.
 */
async function main(): Promise<void> {
  const config = harperConfig();
  const rows = await fetchGreetings(config);
  const helloMessage = await fetchHelloMessage(config);
  console.log(`verify: found ${rows.length} Greeting row(s)`);
  for (const row of rows) console.log(`  - ${row.id}: ${row.message}`);
  console.log(`verify: /Hello → ${helloMessage}`);
}

await main();
