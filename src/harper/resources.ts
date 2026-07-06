/**
 * Custom JS resources for the Harper component.
 *
 * Compiled to `harper-app/resources.js` by `bun run build`. Harper auto-
 * exposes everything exported via the `Resource` base class at
 * `/<ClassName>`.
 *
 * The example below adds a `/Hello` endpoint that returns the most-recent
 * Greeting row. Replace it with the resources your application needs.
 */

/** Response body served by the `/Hello` resource. */
interface HelloPayload {
  readonly message: string;
}

/** A `Greeting` table row as stored by Harper. */
interface GreetingRecord {
  readonly message?: string;
}

/**
 * Example Harper REST resource exposed at `/Hello`.
 *
 * Returns the most-recent `Greeting` row, falling back to a static message
 * when the table is empty. Replace it with the resources your app needs.
 */
export class Hello extends Resource {
  /**
   * Resolves the greeting message served at `GET /Hello`.
   * @returns The first available greeting message, or a default greeting.
   */
  async get(): Promise<HelloPayload> {
    // Bounded, sorted query drained in full with `Array.fromAsync`. Returning
    // early from a `for await (… of table.search())` loop abandons the
    // iterator and leaks its open read transaction, so always drain the
    // stream — here bounded to a single row via `limit` so we never scan the
    // whole table. `sort` picks the most-recent Greeting by insert time.
    const [latest] = (await Array.fromAsync(
      tables.Greeting.search({
        sort: { attribute: "createdAt", descending: true },
        limit: 1,
      })
    )) as readonly GreetingRecord[];
    return { message: latest?.message ?? "Hello, world." };
  }
}
