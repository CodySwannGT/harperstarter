/**
 * Unit tests for the example `/Hello` Harper resource.
 *
 * `src/harper/resources.ts` extends the Harper-provided global `Resource`
 * class and reads the global `tables` map, both injected by the runtime. The
 * tests stub those globals before importing the module so the resource can be
 * exercised outside a live Harper process.
 * @module tests/resources.test
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

/** Minimal stand-in for a Harper table exposing an async `search`. */
interface StubTable {
  search: ReturnType<typeof vi.fn>;
}

/**
 * Builds an async iterable yielding the supplied rows, mirroring the shape
 * Harper's `table.search()` returns.
 * @param rows - Rows to yield in order.
 * @returns An async iterable over the provided rows.
 */
function asyncRows(rows: ReadonlyArray<unknown>): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const row of rows) {
        yield row;
      }
    },
  };
}

const greetingTable: StubTable = { search: vi.fn() };

beforeAll(() => {
  Object.assign(globalThis, {
    Resource: class {},
    tables: { Greeting: greetingTable },
  });
});

describe("Hello resource", () => {
  it("returns the first greeting that carries a message", async () => {
    greetingTable.search.mockReturnValue(
      asyncRows([{ id: "a" }, { message: "Hi there." }, { message: "Later." }])
    );
    const { Hello } = await import("../src/harper/resources.js");
    const result = await new Hello().get();
    expect(result).toEqual({ message: "Hi there." });
  });

  it("falls back to the default greeting when no row has a message", async () => {
    greetingTable.search.mockReturnValue(asyncRows([{ id: "a" }, {}]));
    const { Hello } = await import("../src/harper/resources.js");
    const result = await new Hello().get();
    expect(result).toEqual({ message: "Hello, world." });
  });

  it("falls back to the default greeting when the table is empty", async () => {
    greetingTable.search.mockReturnValue(asyncRows([]));
    const { Hello } = await import("../src/harper/resources.js");
    const result = await new Hello().get();
    expect(result).toEqual({ message: "Hello, world." });
  });
});
