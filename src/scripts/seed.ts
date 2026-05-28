import { readFile } from "node:fs/promises";
import { harperConfig } from "../lib/harper.js";

interface SeedFile {
  readonly greetings: ReadonlyArray<{
    readonly id: string;
    readonly message: string;
  }>;
}

async function main(): Promise<void> {
  const config = harperConfig();
  const seed = JSON.parse(
    await readFile("src/data/seed-data.json", "utf8")
  ) as SeedFile;

  for (const greeting of seed.greetings) {
    const response = await fetch(`${config.baseUrl}/Greeting/${greeting.id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: config.authHeader,
      },
      body: JSON.stringify(greeting),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `seed PUT /Greeting/${greeting.id} failed: ${response.status} ${body}`
      );
    }
    console.log(`seeded Greeting ${greeting.id}`);
  }
}

await main();
