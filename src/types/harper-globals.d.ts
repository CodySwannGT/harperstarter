// Harper exposes `tables` and `Resource` as globals inside resources.js.
// These declarations let TypeScript compile src/harper/resources.ts.

declare const tables: Record<string, HarperTable>;
declare const Resource: HarperResourceConstructor;

/** A single Harper table as exposed on the global `tables` map. */
interface HarperTable {
  search(query?: Record<string, unknown>): AsyncIterable<unknown>;
  put(record: Record<string, unknown>): Promise<unknown>;
  get(id: string): Promise<unknown>;
}

/** Constructor side of the global Harper `Resource` base class. */
interface HarperResourceConstructor {
  new (): HarperResourceInstance;
}

/** Instance side of a Harper resource, populated by Harper at request time. */
interface HarperResourceInstance {
  // Populated by Harper at request time.
}
