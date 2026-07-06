# Fabric runbook — `<your-cluster-name>`

Operational log for the Harper Fabric deploy that backs this project. It is a
skeleton in the starter template — fill each section in the first time you
provision your own cluster, and update it in the **same commit** that changes
Fabric reality. Treat it like a contract, not a wiki page.

The section structure below is the one that proved out in production. Every
operational section carries a **"What we tried that didn't work"** slot:
record the tempting broken alternative you tried first, so the next person
(or the next you) does not re-discover it. That log is the most valuable part
of this file.

---

## 1. Inventory

Fabric console URL, account email, org/cluster IDs, cluster app/ops URLs,
plan, region, instance list. The durable "what exists" table.

## 2. Topology

How the instances relate: origin vs. serving node(s), replication direction,
which URL the public app is served from, which ports are exposed
(REST :443/:9926, ops :9925, and — asserted — that the MQTT/WS broker port is
*not* publicly exposed).

## 3. Deploy mechanism / repo layout

What is at the `harper-app/` component root, how the deploy is packaged
(tarball excludes: `node_modules`, `.git`, `.harperdb`, `tests/screenshots`),
the direct `:9925` `deploy_component` path vs. the Studio proxy fallback
(`DEPLOY_VIA=studio`), and any deploy-branch layout.

**What we tried that didn't work:** _…_

## 4. Credential / deploy-key setup

Where the cluster admin username/password live locally (macOS Keychain service
names derive from the package name; fallback `~/.harper-fabric-credentials`),
how the GitHub Actions deploy secrets (`HARPER_ADMIN_USERNAME`/`PASSWORD`) and
vars (`HARPER_CLUSTER_URL`/`ID`) are wired, and any SSH deploy-key flow for a
private repo.

**What we tried that didn't work:** _…_

## 5. Env gotchas

Every Harper/Fabric quirk that bit you: port/firewall reachability from CI,
Studio proxy 500s ("Instance domain socket does not exist"), replication lag on
the serving node, cold-start latency after a restart, and how each is handled.

**What we tried that didn't work:** _…_

## 6. Update-and-redeploy per artifact

The exact procedure to change and redeploy each artifact class — schema
(`schema.graphql`; Harper has no relational-style migrations, so record the
manual bump procedure), resources (`resources.js`), web assets (`web/*`), and
`config.yaml`.

**What we tried that didn't work:** _…_

## 7. Out-of-band data path

How to seed/verify data without a full deploy: the operations-API path
(`bun run seed` / `verify`) and the REST path (`bun run seed:rest` /
`verify:rest`), plus any one-off backfill scripts.

**What we tried that didn't work:** _…_

## 8. Component reference

What each deployed file/route is and who owns it: the resource classes, the
static web entrypoints, the freshness marker (`/version.js`), and the routes
the deploy freshness gate + smoke assert (`DEPLOY_VERIFY_ROUTES`).

## 9. Credential rotation

The production checklist for rotating the admin credential and the GitHub
deploy secrets. Never commit fresh secret values to a tracked file.

**What we tried that didn't work:** _…_

## 10. Cleanup

How to tear down instances, drop test data, and remove stale components when
decommissioning or resetting the environment.

## 11. Console quick-reference

The handful of Fabric Studio clicks/URLs you reach for often (logs, restart,
component list, instance status).

## 12. Out of scope

What this runbook deliberately does not cover, and where that lives instead
(app architecture, product docs, etc.).
