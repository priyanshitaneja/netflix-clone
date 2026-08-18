@AGENTS.md

# netflix-clone — working conventions

A Netflix clone built as a **teaching vehicle** for Netflix's *actually published* web
engineering practices. The plan lives at
`~/.claude/plans/continue-with-netflix-thing-memoized-fountain.md`.

## The rule that overrides all others

**Every claim in `docs/` must resolve to a verified source.** A clone that says "Netflix
does X" without a citation is worse than no clone. Each claim carries one provenance label:

| Label | Means |
|---|---|
| `NF-PUB` | Netflix published it themselves (author + date + URL + `verified_on` required) |
| `NF-3P` | Netflix's work, documented by someone else (Osmani/Google, OpenJS, CMG) |
| `IND` | General industry practice or a standards body — **not** Netflix-published |
| `OURS` | Our own invention or adaptation, no external source |

Every `IND` and `OURS` claim needs a row in `docs/honesty-ledger.md`. If you cannot verify
a source, it goes in `docs/sources.leads.md` and is **not citable**.

## Version control

**Commit continuously as you build** — one commit per meaningful step, never one giant
drop. Push to `origin main` at each phase boundary. Remote is
`git@github.com:priyanshitaneja/netflix-clone.git` (private).

## Measurement discipline

- Baselines in `docs/measurements/**` are **immutable** once committed. Every Netflix
  number we teach is a *delta*, so a delta needs an untouched before.
- Phase 2 ships the **deliberately naive** implementation. Do not pre-optimize it, or
  Phase 5 has nothing left to prove.
- Verdicts are **computed against the noise baseline**, never chosen. A delta smaller than
  2σ is `no-effect-at-our-scale`, not a win.
- Three levels of aggregation, all from Croll 2022, and they are not interchangeable:
  median (or max, for memory) *within* a run → **minimum** across the 3 runs of a commit →
  anomaly + changepoint detection across commits.

## Landmines already hit — do not re-introduce

- **`dash.js` on npm is not dash.js.** `dash.js@4.0.1` is "Hanzo Dashboard Kit", a
  shadcn/tailwind admin dashboard library. The player is **`dashjs`** (5.2.1+). Asserted in
  `tests/unit/guardrails.test.ts`.
- **dashjs 5.x renamed most of the 4.x API.** Every tutorial online is 4.x. Only
  `lib/player/adapters/dashAdapter.ts` may import `dashjs`.
- **`next lint` was removed in Next 16**, and so was the `eslint` key in `NextConfig`.
  Lint is a separate step. Typecheck must be `next typegen && tsc --noEmit` — route types
  are otherwise only emitted during dev/build.
- **`next build` no longer reports JS bundle sizes**, and there is **no
  `.next/app-build-manifest.json`** under Turbopack. Per-route JS is measured by parsing
  the `<script>` tags out of `.next/server/app/<route>.html`. Do not write tooling that
  scrapes build logs.
- **`cacheComponents: true` and the `turbopack.root` / `outputFileTracingRoot` pins must
  stay.** The parent directory has its own `package.json` + `node_modules`; without the
  pins a missing dependency can resolve upward, work locally and fail on Vercel.
- **The no-API-key path must never be the degraded path.** `git clone && npm i && npm run
  dev` must give a complete app. The live/fixture branch exists in exactly one place:
  `lib/bff/upstream/tmdb.ts`.
- **Next memoizes `fetch` within a render pass.** Any measurement of our request collapser
  must use `cache: 'no-store'`, or we credit the collapser with Next's work.

## Commands

| Command | Does |
|---|---|
| `npm run check` | lint + typecheck + unit tests — the pre-commit gate |
| `npm run build && npm start` | production build, served on :3000 |
| `npm run size` | size-limit budgets (no browser needed) |
| `npm test` | vitest |
