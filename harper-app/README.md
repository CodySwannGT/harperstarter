# Harper application

The Harper component for the `your-project` starter.

## Files

- `config.yaml` — Harper component config. Enables REST, GraphQL schema
  export, the JS resources entrypoint, and static web hosting.
- `schema.graphql` — GraphQL SDL describing the tables. Every `@export`-ed
  type is auto-exposed under `/<TypeName>` over REST.
- `resources.js` — **generated** from `src/harper/resources.ts` by
  `bun run build`. Custom JS resources live here.
- `web/**` — **generated** from `src/web/**` by `bun run build`. Static
  assets shipped alongside the API.

The two generated paths are gitignored. Run `bun run build` after changing
anything under `src/`.

## Local run

```bash
bun run build
bun run start    # `harperdb start`
bun run seed     # inserts a Greeting row
bun run verify   # reads it back
```

Visit <http://127.0.0.1:9926/Greeting> to see the auto-exported table.

## Deploy

`bun run deploy` builds, then packages this directory and deploys to the
configured Harper Fabric component target. See
[`docs/fabric-runbook.md`](../docs/fabric-runbook.md) for the deploy
topology and credentials layout.
