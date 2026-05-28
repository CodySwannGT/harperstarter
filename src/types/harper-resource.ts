/**
 * Minimal typing for Harper custom REST resources.
 *
 * Harper's runtime exposes a global `tables` map (one entry per @table
 * GraphQL type) and a `Resource` base class. The full surface is documented
 * at https://docs.harperdb.io/docs/developers/components, but a typical
 * starter only needs the two members below.
 */
export interface HarperResourceContext {
  readonly request?: {
    readonly url?: string;
    readonly method?: string;
  };
}

export interface HarperResource {
  get(context?: HarperResourceContext): Promise<unknown> | unknown;
}
