@AGENTS.md

<!-- Lisa: import the canonical AGENTS.md so Claude Code loads the same guidance every other agent reads. -->

# Working in this repo

## LLM Wiki

This repo has a Lisa LLM Wiki at `wiki/`. Treat
`wiki/schema/llm-wiki-contract.md` as the durable operating contract for wiki
ingestion, querying, linting, setup, migration, and onboarding. Use the
`lisa-wiki-*` skills for wiki operations.

This is a Harper/Fabric project managed by Lisa's `harper-fabric` project
type. Reusable stack rules live in Lisa; this file keeps only
your-project-specific operational facts.

## Project identity

- Repo: `your-org/your-project`
- Harper component root: `harper-app/`
- TypeScript source: `src/`
- Generated deploy JavaScript: `harper-app/resources.js` and
  `harper-app/web/**/*.js`
- Generated deploy JavaScript is ignored by git and must be produced
  with `bun run build`.

## PR merge handling

If GitHub auto-merge is enabled on the repo, prefer it: when an agent
opens a PR, enable auto-merge (`gh pr merge <n> --auto`) so it merges
once CI passes, instead of merging manually.

## Documentation map

Docs here are operational, not aspirational. When reality changes, update
the matching doc in the same change.

| Doc | Captures |
|---|---|
| `README.md` | Top-level overview, repo layout, quick start, commands. |
| `docs/fabric-runbook.md` | Harper Fabric deploy log: topology, credentials, workarounds, failed alternatives. |
| `harper-app/README.md` | Notes for the deployed component root: config, schema, seed/verify entrypoints. |

## Local verification

The expected local gate for normal changes is:

```bash
bun run build
bun run typecheck
bun run test
```
