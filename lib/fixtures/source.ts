/**
 * The single decision point for live-vs-fixture data.
 *
 * This exists as its own module with one export so that exactly one line in the codebase
 * inspects the environment. Everything above `lib/bff/upstream/` is source-agnostic: the
 * shapes, `getPage`, the GraphQL resolvers and every component cannot tell where the bytes
 * came from, which is why the entire resilience curriculum runs with no API key.
 *
 * The rule this protects: **the no-key path must never be the degraded path.**
 * `git clone && npm i && npm run dev` has to give a complete app. A CI job runs the whole
 * suite with TMDB_API_KEY unset; if that job is red, the offline story is broken no matter
 * what the README claims.
 */

export type Source = "tmdb" | "fixture";

export const source: Source = process.env.TMDB_API_KEY ? "tmdb" : "fixture";

/**
 * Serve committed poster art instead of image.tmdb.org.
 *
 * Distinct from `source` on purpose. `image.tmdb.org` needs no API key and is CORS-open
 * (verified: `access-control-allow-origin: *`, `cache-control: public, max-age=31919000`),
 * so a key-less run can still show real artwork if it has a network. `OFFLINE=1` is for
 * genuinely no network at all.
 */
export const offline: boolean = process.env.OFFLINE === "1";

/**
 * Deterministic fixture filename for an upstream request.
 *
 * `capture.mjs` and the fixture fetcher both derive the name from the same inputs, so a
 * missing fixture is a loud error naming the exact file to capture rather than a silent
 * empty array. Params are sorted so `?a=1&b=2` and `?b=2&a=1` resolve to one file.
 */
export function fixtureSlug(path: string, params: Record<string, string | number> = {}): string {
  const base = path.replace(/^\/+/, "").replace(/[/]/g, "-");
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}-${String(params[k])}`)
    .join("_");
  return query ? `${base}__${query}` : base;
}
