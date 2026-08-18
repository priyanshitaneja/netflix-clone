import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

/**
 * Phase 0 guardrails, asserted rather than assumed.
 *
 * Every one of these encodes a decision from the plan that would silently invalidate
 * later measurements if it drifted. A comment saying "don't change this" is not a
 * guardrail; a failing test is.
 */
describe("phase 0 guardrails", () => {
  it("pins turbopack.root and outputFileTracingRoot, so the parent dir cannot leak deps", () => {
    const config = read("next.config.ts");
    expect(config).toContain("outputFileTracingRoot: __dirname");
    expect(config).toMatch(/turbopack:\s*\{\s*root:\s*__dirname/);
  });

  it("enables cacheComponents in phase 0, not later", () => {
    // Flipping this after Phase 3 would change prerendering semantics app-wide and
    // silently invalidate every committed baseline.
    expect(read("next.config.ts")).toContain("cacheComponents: true");
  });

  it("enables noUncheckedIndexedAccess", () => {
    const tsconfig = JSON.parse(read("tsconfig.json")) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  it("installs dashjs, never dash.js", () => {
    // `dash.js@4.0.1` on npm is "Hanzo Dashboard Kit" — a shadcn/tailwind admin
    // dashboard component library, not the DASH Industry Forum player. The player is
    // `dashjs`. This test exists so nobody re-introduces the wrong one from a tutorial.
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(all).not.toHaveProperty("dash.js");
  });

  it("keeps the TMDB key server-side only", () => {
    expect(read(".env.example")).toContain("TMDB_API_KEY=");
    expect(read(".env.example")).not.toContain("NEXT_PUBLIC_TMDB");
  });

  it("commits .env.example but ignores .env.local", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain("!.env.example");
  });
});
