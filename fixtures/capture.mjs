#!/usr/bin/env node
/**
 * Captures real TMDB responses into fixtures/tmdb/.
 *
 * The counterpart to `generate.mjs`. `generate.mjs` hand-authors a synthetic corpus so the
 * repo needs no key and carries no scraped copy; this replaces those files with real
 * captured responses for anyone who has one.
 *
 * ## Usage
 *
 *     TMDB_API_KEY=... node fixtures/capture.mjs                 # the whole manifest
 *     TMDB_API_KEY=... node fixtures/capture.mjs "/movie/550"     # one endpoint
 *     TMDB_API_KEY=... node fixtures/capture.mjs "/discover/movie?with_genres=28&sort_by=popularity.desc"
 *
 * The single-endpoint form is what a `FixtureMissing` error prints, so a missing fixture is
 * always a copy-pasteable command rather than a puzzle.
 *
 * ## Honest limits, stated because this file is the one place a reader will look
 *
 * 1. **The network path here has never been executed in this repo.** No TMDB key exists on
 *    the machine this was written on. What *is* verified, by `tests/contract/fixtures.test.ts`,
 *    is the property whose failure would be silent: that `slugFor()` below and
 *    `fixtureSlug()` in `lib/fixtures/source.ts` derive byte-identical filenames. If those
 *    two ever disagree, a captured fixture lands under a name the app never looks up and
 *    the app silently keeps serving the synthetic corpus instead.
 * 2. **`/search/multi` cannot be captured.** It takes arbitrary user input, so there is no
 *    finite set of files. Search stays corpus-backed offline even after a capture, which
 *    means captured rows and synthetic search results can disagree. Documented in
 *    fixtures/README.md rather than papered over.
 * 3. **Param sets must match the app's exactly**, because the slug includes them. The
 *    manifest below mirrors the calls in `lib/bff/upstream/tmdb.ts`; changing a param there
 *    without changing it here produces a fixture nothing reads.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "tmdb");
const BASE = "https://api.themoviedb.org/3";

/**
 * Must stay byte-identical to `fixtureSlug()` in lib/fixtures/source.ts.
 *
 * Duplicated rather than imported: this is a plain `.mjs` script and that is a TypeScript
 * module under a path alias. A contract test asserts the two agree over a table of inputs,
 * which is a stronger guarantee than a shared import would give anyway — it fails loudly
 * on divergence instead of quietly following whichever one changed.
 */
export function slugFor(path, params = {}) {
  const base = path.replace(/^\/+/, "").replace(/[/]/g, "-");
  const query = Object.keys(params)
    .sort()
    .map((k) => `${k}-${String(params[k])}`)
    .join("_");
  return query ? `${base}__${query}` : base;
}

/** The genre ids the app's rows and genre pages request. Real, publicly documented TMDB ids. */
const GENRE_IDS = [28, 12, 16, 35, 80, 18, 27, 10749, 878, 53];

/** Mirrors every call in lib/bff/upstream/tmdb.ts that has a fixed param set. */
export const MANIFEST = [
  { path: "/trending/all/week", params: {} },
  { path: "/movie/top_rated", params: {} },
  { path: "/tv/popular", params: {} },
  { path: "/genre/movie/list", params: {} },
  ...GENRE_IDS.map((id) => ({
    path: "/discover/movie",
    params: { with_genres: String(id), sort_by: "popularity.desc" },
  })),
];

/** Detail and similar, for every title id the captured lists actually contain. */
const detailEntries = (ids) =>
  ids.flatMap((id) => [
    { path: `/movie/${id}`, params: { append_to_response: "credits,release_dates" } },
    { path: `/movie/${id}/similar`, params: {} },
  ]);

function authFor(key) {
  // A v4 token is a three-part JWT and goes in the header; a v3 key is a query param.
  return key.split(".").length === 3
    ? { headers: { Authorization: `Bearer ${key}` }, query: {} }
    : { headers: {}, query: { api_key: key } };
}

async function capture(key, { path, params }) {
  const auth = authFor(key);
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries({ ...auth.query, ...params })) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: { accept: "application/json", ...auth.headers } });
  if (!res.ok) throw new Error(`TMDB ${path} responded ${res.status}`);

  const slug = slugFor(path, params);
  writeFileSync(join(OUT, `${slug}.json`), JSON.stringify(await res.json(), null, 2) + "\n");
  return slug;
}

/** Parses `/discover/movie?with_genres=28` into the `{path, params}` the slug is built from. */
function parseArg(arg) {
  const [path, query = ""] = arg.split("?", 2);
  return { path, params: Object.fromEntries(new URLSearchParams(query)) };
}

async function main() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    console.error(
      "TMDB_API_KEY is not set.\n" +
        "This script is only for replacing the synthetic corpus with real captures — the app\n" +
        "runs fully offline without it. See fixtures/README.md.",
    );
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2);
  const entries = args.length > 0 ? args.map(parseArg) : MANIFEST;

  const written = [];
  for (const entry of entries) {
    // Sequential on purpose. TMDB allows roughly 40 requests/second and sends no
    // Retry-After, so a parallel capture of ~100 endpoints is the one thing here that would
    // reliably earn a 429.
    written.push(await capture(key, entry));
    process.stdout.write(`  ${written.at(-1)}.json\n`);
  }

  // Detail + similar for the ids the captured lists contain, so /title/[id] works offline
  // too. Only when capturing the full manifest — a single-endpoint capture stays single.
  if (args.length === 0) {
    const ids = new Set();
    for (const entry of MANIFEST) {
      const { readFileSync } = await import("node:fs");
      const slug = slugFor(entry.path, entry.params);
      const doc = JSON.parse(readFileSync(join(OUT, `${slug}.json`), "utf8"));
      for (const item of doc.results ?? []) {
        if (item.media_type === "tv" || item.name) continue; // movie detail only, per tmdb.ts
        ids.add(item.id);
      }
    }
    for (const entry of detailEntries([...ids])) {
      written.push(await capture(key, entry));
      process.stdout.write(`  ${written.at(-1)}.json\n`);
    }
  }

  console.log(`\nCaptured ${written.length} fixtures into fixtures/tmdb/.`);
  console.log("`/search/multi` is not captured — see fixtures/README.md.");
}

// Importable for the contract test without running a capture.
if (import.meta.url === `file://${process.argv[1]}`) await main();
