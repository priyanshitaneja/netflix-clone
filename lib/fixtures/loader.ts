import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fixtureSlug } from "./source";

/**
 * Reads committed fixtures, and synthesises the three endpoints that cannot sensibly be
 * one-file-per-request.
 *
 * Exact-slug files are preferred always, so `fixtures/capture.mjs` output takes precedence
 * over anything derived. The synthetic resolvers exist because:
 *
 *  - `/search/multi?query=…` takes arbitrary user input. One fixture per query is
 *    impossible, and `FixtureMissing` on an unrecognised search would make the no-key path
 *    the degraded path — the one thing this layer must never do.
 *  - `/movie/{id}` and `/movie/{id}/similar` would be ~90 near-identical files across the
 *    catalog.
 *
 * This is a documented divergence: our fixture layer implements a little bit of TMDB's
 * behaviour locally. The important property is preserved — the fetcher still returns
 * unparsed `unknown` and the caller still parses it with the same zod schema as a live
 * response, so a drifted fixture fails exactly like a bad upstream.
 */

const FIXTURE_DIR = join(process.cwd(), "fixtures", "tmdb");

async function readJson(name: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(join(FIXTURE_DIR, `${name}.json`), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

interface MovieCorpusEntry {
  id: number;
  title: string;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  [key: string]: unknown;
}

interface TvCorpusEntry {
  id: number;
  name: string;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  [key: string]: unknown;
}

/**
 * Read once per process. Fixtures are immutable at runtime, and re-reading them on every
 * row of every page would make the fixture path slower than the network path — which would
 * quietly corrupt every timing measurement taken offline.
 */
let corpusCache: { movies: MovieCorpusEntry[]; shows: TvCorpusEntry[] } | null = null;

async function corpus(): Promise<{ movies: MovieCorpusEntry[]; shows: TvCorpusEntry[] }> {
  if (corpusCache) return corpusCache;
  const [movieDoc, tvDoc] = await Promise.all([readJson("_corpus-movies"), readJson("_corpus-tv")]);
  corpusCache = {
    movies: (movieDoc as { movies?: MovieCorpusEntry[] } | null)?.movies ?? [],
    shows: (tvDoc as { shows?: TvCorpusEntry[] } | null)?.shows ?? [],
  };
  return corpusCache;
}

const paginate = (results: unknown[]) => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

/** Summary-shaped view of a detail-shaped corpus entry — drops the detail-only fields. */
function toSummary(entry: MovieCorpusEntry) {
  const { runtime, genres, credits, release_dates, ...summary } = entry;
  void runtime;
  void genres;
  void credits;
  void release_dates;
  return summary;
}

export async function loadFixture(
  path: string,
  params: Record<string, string | number>,
): Promise<unknown | null> {
  // 1. An exact captured fixture always wins.
  const exact = await readJson(fixtureSlug(path, params));
  if (exact !== null) return exact;

  const { movies, shows } = await corpus();

  // 2. /movie/{id}
  const detailMatch = /^\/movie\/(\d+)$/.exec(path);
  if (detailMatch) {
    return movies.find((m) => m.id === Number(detailMatch[1])) ?? null;
  }

  // 3. /movie/{id}/similar — same-genre neighbours, most highly rated first. Not TMDB's
  //    recommendation model, just a defensible local stand-in.
  const similarMatch = /^\/movie\/(\d+)\/similar$/.exec(path);
  if (similarMatch) {
    const id = Number(similarMatch[1]);
    const self = movies.find((m) => m.id === id);
    if (!self) return null;
    const neighbours = movies
      .filter((m) => m.id !== id && m.genre_ids.some((g) => self.genre_ids.includes(g)))
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 12);
    return paginate(neighbours.map(toSummary));
  }

  // 4. /search/multi?query=… — case-insensitive substring over title/name and overview.
  if (path === "/search/multi") {
    const query = String(params.query ?? "").trim().toLowerCase();
    if (!query) return paginate([]);
    const hits = [
      ...movies
        .filter((m) => `${m.title} ${m.overview}`.toLowerCase().includes(query))
        .map((m) => ({ ...toSummary(m), media_type: "movie" })),
      ...shows
        .filter((s) => `${s.name} ${s.overview}`.toLowerCase().includes(query))
        .map((s) => ({ ...s, media_type: "tv" })),
    ].sort((a, b) => (b.vote_average as number) - (a.vote_average as number));
    return paginate(hits);
  }

  return null;
}
