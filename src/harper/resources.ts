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

export class Hello extends Resource {
  async get(): Promise<{ message: string }> {
    for await (const row of tables.Greeting.search()) {
      const greeting = row as { message?: string };
      if (greeting.message) return { message: greeting.message };
    }
    return { message: "Hello, world." };
  }
}
