import { defineConfig } from "vitest/config";

/**
 * Two projects, because the two kinds of test need different globals:
 *
 *  - `node`   — everything in lib/. The BFF, resilience primitives and stats code are
 *               plain functions; they are tested by calling them, with msw intercepting
 *               upstream HTTP in-process (Phase 2).
 *  - `jsdom`  — client components only. Server components are deliberately NOT unit
 *               tested: RSC has no stable test renderer, so they are covered by
 *               integration and E2E instead. The jsdom project is added in Phase 2 when
 *               there is a client component to test.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "lib/**/*.test.ts"],
        },
      },
    ],
  },
});
