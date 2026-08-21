import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Three projects, because the three kinds of test need different globals:
 *
 *  - `node`     — everything in lib/. The BFF, resilience primitives and stats code are
 *                 plain functions; they are tested by calling them, with msw intercepting
 *                 upstream HTTP in-process (Phase 4).
 *  - `contract` — every committed fixture parsed by the same zod schema a live response
 *                 goes through, so fixtures cannot rot silently.
 *  - `jsdom`    — client components only. Server components are deliberately NOT unit
 *                 tested: RSC has no stable test renderer, so they are covered by
 *                 integration and E2E instead. Added when there is a client component
 *                 whose behaviour is worth asserting in isolation.
 */

/**
 * `server-only` is not a real installed package.
 *
 * Next resolves `import "server-only"` through its own bundler alias
 * (`next/dist/compiled/server-only`), which is why the app builds while nothing outside
 * Next's bundler can import a single module under `lib/bff/**`. Discovering that at the
 * point of writing the first test was lucky; it would otherwise have surfaced in Phase 4,
 * when the entire resilience suite depends on calling `getPage()` as a plain function.
 *
 * Aliased to Next's own empty stub rather than a hand-written one, so the guard keeps
 * whatever semantics the installed Next gives it.
 */
const alias = {
  "server-only": "next/dist/compiled/server-only/empty.js",
  "client-only": "next/dist/compiled/client-only/index.js",
  "@": root.replace(/\/$/, ""),
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "lib/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "contract",
          environment: "node",
          include: ["tests/contract/**/*.test.ts"],
        },
      },
    ],
  },
});
