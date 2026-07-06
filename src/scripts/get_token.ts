#!/usr/bin/env node
/**
 * Mint a Harper-native operation_token via the documented
 * `create_authentication_tokens` op and print it on stdout.
 *
 * Usage:
 *   TOKEN=$(bun run --silent token)
 *   curl -H "Authorization: Bearer $TOKEN" https://<cluster>/<Resource>
 *
 *   # both tokens as JSON:
 *   bun run token -- --json
 *
 * Reads credentials from env, keychain, or ~/.harper-fabric-credentials.
 * See `src/scripts/_auth.ts` for the resolution order and auth rationale.
 */
import { createAuthTokens } from "./_auth.js";

const tokens = await createAuthTokens();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(tokens, null, 2));
} else {
  console.log(tokens.operation_token);
}
