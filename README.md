# your-project

A Harper Fabric application starter, scaffolded by the
[`harperstarter`](https://github.com/CodySwannGT/harperstarter) template.

After cloning from the template, replace every `your-project` /
`Your Project` / `your-org` token with your actual project name and owning
GitHub org. The minimal touch points are:

- `package.json` — `name`
- `server.json` — `name`, `title`, `description`, `repository`, `remotes`
- `.lisa.config.json` — `github.org`, `github.repo`
- `wiki/lisa-wiki.config.json` — `org`
- `wiki/start-here.md` — owner line
- `harper-app/README.md` — title

This repository is operated through its Lisa LLM Wiki.

- Start here: [wiki/start-here.md](wiki/start-here.md)
- Contract: [wiki/schema/llm-wiki-contract.md](wiki/schema/llm-wiki-contract.md)

## Quick start

```bash
bun install
bun run bootstrap   # installs Harper locally + builds + starts
bun run seed
bun run verify
```

Then visit <http://127.0.0.1:9926/> for the "Hello, world." page and
<http://127.0.0.1:9926/Greeting> for the auto-exported table.

## Repo layout

- `harper-app/` — Harper component root packaged by Fabric.
  - `config.yaml`, `schema.graphql` — checked in.
  - `resources.js`, `web/**/*.js` — **generated** by `bun run build`.
- `src/` — TypeScript source of truth.
- `docs/fabric-runbook.md` — operational log for your Fabric deploy.
- `wiki/` — Lisa LLM Wiki contract + persona files.

## Local verification

```bash
bun run build
bun run typecheck
bun run test
```
