# Fabric runbook

This is the operational log for the Harper Fabric deploy that backs this
project. It is empty in the starter template — fill it in the first time
you provision your own cluster.

The runbook is the durable source for:

1. **Inventory** — Fabric console URL, account email, org/cluster IDs,
   cluster app/ops URLs, plan, instance topology.
2. **Component layout** — what is at the `harper-app/` component root,
   how the `fabric-deploy` branch is structured, what gets symlinked
   or packaged at deploy time.
3. **Credentials** — where the cluster admin password lives locally
   (macOS Keychain, fallback file), how the GitHub Actions deploy
   secret is set, and how to rotate them.
4. **Workarounds** — every Harper/Fabric quirk that bit you and what
   you ended up doing. Always include the *tempting broken
   alternative* you tried first.
5. **Deploy / rollback** — the exact command(s) that produced the
   current cluster state and how to back them out.
6. **Schema changes** — Harper does not do migrations the way a
   relational database does. Record the procedure you actually
   followed for each schema bump here.

Update this file in the same commit that changes Fabric reality —
treat it like a contract, not a wiki page.
