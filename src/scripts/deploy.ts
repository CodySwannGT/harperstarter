/**
 * Deploy the Harper component at `harper-app/` to a Harper Fabric cluster.
 *
 * This is the starter shape — it builds and then prints the deploy command
 * you would run against your cluster. Replace it with your project's real
 * deploy flow once you have a Fabric account configured. See
 * `docs/fabric-runbook.md` for the deploy contract.
 */

/**
 * Prints the deploy command for the Harper component at `harper-app/`.
 *
 * Acts as the starter's deploy entrypoint: it reports the command that would
 * run against `HDB_TARGET_URL`, or prompts for the variable when unset.
 * @returns Promise that resolves once the deploy plan has been printed.
 */
async function main(): Promise<void> {
  const target = process.env.HDB_TARGET_URL;
  if (!target) {
    console.log(
      "deploy: set HDB_TARGET_URL to a Harper Fabric cluster URL before deploying."
    );
    console.log(
      "deploy: would run `harperdb deploy harper-app/` against the configured target."
    );
    return;
  }
  console.log(`deploy: would deploy harper-app/ to ${target}`);
}

await main();
