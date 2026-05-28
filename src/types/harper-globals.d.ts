// Harper exposes `tables` and `Resource` as globals inside resources.js.
// These declarations let TypeScript compile src/harper/resources.ts.

declare const tables: Record<string, HarperTable>;
declare const Resource: HarperResourceConstructor;

interface HarperTable {
  search(query?: Record<string, unknown>): AsyncIterable<unknown>;
  put(record: Record<string, unknown>): Promise<unknown>;
  get(id: string): Promise<unknown>;
}

interface HarperResourceConstructor {
  new (): HarperResourceInstance;
}

interface HarperResourceInstance {
  // Populated by Harper at request time.
}
