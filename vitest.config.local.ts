/**
 * Vitest Configuration - Project-Local Customizations
 *
 * Add project-specific Vitest settings here. This file is create-only,
 * meaning Lisa will create it but never overwrite your customizations.
 *
 * Example:
 * ```ts
 * import type { ViteUserConfig } from "vitest/config";
 *
 * const config: ViteUserConfig = {
 *   resolve: {
 *     alias: {
 *       "@/": new URL("./src/", import.meta.url).pathname,
 *     },
 *   },
 * };
 *
 * export default config;
 * ```
 *
 * @see https://vitest.dev/config/
 * @module vitest.config.local
 */
import type { ViteUserConfig } from "vitest/config";

const config: ViteUserConfig = {
  test: {
    // Browser regression + deployed-cluster tests are slower and contend under
    // parallelism; a bounded worker pool with generous timeouts absorbs that
    // variance without masking real regressions (a reintroduced full-table scan
    // still blows past even these budgets).
    testTimeout: 120_000,
    hookTimeout: 120_000,
    maxWorkers: 4,
    // Lisa governance forces `test`/`test:cov` to a bare `vitest run`, dropping
    // the `bun run build && bun run test:setup:playwright` preamble the browser
    // regression tests require. Reinstate those preconditions via globalSetup so
    // the forced scripts stay self-sufficient across Lisa updates.
    globalSetup: ["./tests/global-setup.ts"],
    coverage: {
      // CLI entrypoints depend on live services, network, or local files; keep
      // the unit coverage threshold focused on reusable app and library code.
      exclude: [
        "**/*.d.ts",
        "**/index.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/.claude/worktrees/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/*.mock.ts",
        "**/test/**",
        "**/tests/**",
        "**/__tests__/**",
        "**/__mocks__/**",
        "**/components/ui/**",
        // Network-transport libraries: thin wrappers over the Harper ops API,
        // REST, and the deployed cluster's HTTP surface. They are exercised by
        // the deploy + smoke integration paths, not meaningfully unit-testable
        // without a live cluster (same rationale as the CLI entrypoints above).
        "src/lib/harper.ts",
        "src/lib/rest.ts",
        "src/lib/deploy-verify.ts",
        "src/build/**",
        "src/lib/brokercheck-employment.ts",
        "src/lib/brokercheck-load*.ts",
        "src/lib/brokercheck-parse*.ts",
        "src/lib/firm-merge.ts",
        "src/lib/morgan-stanley-row*.ts",
        "src/scripts/**",
        "src/types/**",
        "src/web/**/*.ts",
      ],
    },
  },
};

export default config;
