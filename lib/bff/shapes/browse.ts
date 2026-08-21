import "server-only";

import type { FaultSpec, PagePayload, RequestContext, RowPayload, TitleSummary } from "../types";
import { runDep, type DepResult } from "../run";
import { tmdb } from "../upstream/tmdb";

/**
 * The personalized row homepage.
 *
 * Structure from "Learning a Personalized Homepage" (Chris Alvino, Justin Basilico,
 * 9 Apr 2015): a two-dimensional layout — horizontal scroll within a themed row, vertical
 * scroll across rows — assembled by candidate generation, filtering, per-row ranking with
 * row-specific algorithms, then row selection and ordering. Netflix chose from thousands of
 * videos and tens of thousands of potential rows for 57M+ members.
 *
 * We run the same four stages over a catalog of 40 titles with no model. What is faithfully
 * reproduced is the shape: each row comes from its own algorithm, rows are ordered, and one
 * failing algorithm costs exactly one row.
 *
 * Never called "lolomo" — that word appears in no verified Netflix article (ledger H-03).
 *
 * Phase 2 is deliberately naive. Eight dependencies fire concurrently and each is
 * `fail-silent`, so the page survives any subset failing — but nothing here protects the
 * *dependency*: no circuit breaker, no bulkhead, no request collapsing. The five genre rows
 * make five separate upstream calls even where their results overlap, which is exactly the
 * waste lesson L2.4 measures.
 */

interface RowSpec {
  id: string;
  title: string;
  algo: RowPayload["algo"];
  dep: string;
  fetch: (signal: AbortSignal) => Promise<TitleSummary[]>;
}

const TIMEOUT_MS = 800;

/** Row-specific algorithms, in display order. Ordering is Netflix's fourth stage. */
const ROW_SPECS: RowSpec[] = [
  {
    id: "trending",
    title: "Trending Now",
    algo: "trending",
    dep: "tmdb.trending",
    fetch: (s) => tmdb.trending(s),
  },
  {
    id: "top-rated",
    title: "Top Rated",
    algo: "topRated",
    dep: "tmdb.topRatedMovies",
    fetch: (s) => tmdb.topRatedMovies(s),
  },
  {
    id: "tv",
    title: "Series People Finish",
    algo: "trending",
    dep: "tmdb.popularTv",
    fetch: (s) => tmdb.popularTv(s),
  },
  ...(
    [
      { genreId: "878", title: "Sci-Fi Worth Arguing About" },
      { genreId: "18", title: "Quietly Devastating Dramas" },
      { genreId: "53", title: "Thrillers That Earn It" },
      { genreId: "35", title: "Comedies With A Grudge" },
      { genreId: "80", title: "Crime, Considered" },
    ] as const
  ).map(
    ({ genreId, title }): RowSpec => ({
      id: `genre-${genreId}`,
      title,
      algo: "genre",
      dep: `tmdb.genre.${genreId}`,
      fetch: (s) => tmdb.moviesByGenre(genreId, s),
    }),
  ),
];

/**
 * Fetches every row concurrently and returns them with their timings.
 *
 * Concurrency rather than sequence is the point of "Optimizing the Netflix API"
 * (Ben Christensen, 15 Jan 2013): a per-resource REST API forces the client into multiple
 * round trips, and the fix is to compose the fan-out server-side. The measurable claim —
 * asserted by lesson L2.3 — is that page latency approaches the *slowest* dependency rather
 * than the *sum* of them.
 */
async function fetchRows(
  specs: RowSpec[],
  faults: FaultSpec[] = [],
): Promise<{
  rows: RowPayload[];
  timings: Record<string, number>;
  degradations: PagePayload["meta"]["degradations"];
}> {
  const settled = await Promise.all(
    specs.map(
      (spec): Promise<DepResult<TitleSummary[]>> =>
        runDep(spec.dep, TIMEOUT_MS, spec.fetch, { mode: "fail-silent", empty: [] }, faults),
    ),
  );

  const timings: Record<string, number> = {};
  const degradations: PagePayload["meta"]["degradations"] = [];
  const rows: RowPayload[] = [];

  specs.forEach((spec, i) => {
    const result = settled[i]!;
    timings[spec.dep] = Math.round(result.ms * 10) / 10;
    if (result.degradation.mode !== "ok") degradations.push(result.degradation);

    // Netflix's filtering stage. An empty row is worse than no row: it is a hole in the
    // page that reads as broken rather than as absent.
    if (result.value.length > 0) {
      rows.push({
        id: spec.id,
        title: spec.title,
        algo: spec.algo,
        items: result.value,
        degraded: result.degradation,
      });
    }
  });

  return { rows, timings, degradations };
}

export async function browseShape(ctx: RequestContext): Promise<PagePayload> {
  const { rows, timings, degradations } = await fetchRows(ROW_SPECS, ctx.faults);

  /**
   * The billboard is the single large hero title. Netflix frames it as an experimentally
   * derived artifact: "Decision Making at Netflix" (Martin Tingley, 7 Sep 2021) describes
   * the 2010-2020 homepage evolution as a sequence of A/B decisions about the balance
   * between a large display area for one title versus showing more titles, and whether
   * video beats static images. Phase 9 makes that a real experiment (`billboard-video`);
   * for now it is the highest-scoring title in the first row that loaded.
   */
  const billboard =
    [...(rows[0]?.items ?? [])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))[0] ??
    null;

  return {
    shape: "browse",
    billboard,
    rows,
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
      shape: "browse",
      profileId: ctx.profileId,
      degradations,
      timings,
      collapsed: 0,
    },
  };
}

/**
 * A single row, by id.
 *
 * This exists only to power the deliberately bad `?rows=client` variant and its endpoint —
 * the resource-oriented, One-Size-Fits-All API that Jacobson's 2012 article argues against.
 * Having both shapes in one codebase is what makes lesson L2.2 a measurement (one request
 * versus nine, with real waterfalls) instead of an assertion.
 *
 * Nothing in the app's own rendering path may use this.
 */
export async function fetchRowById(
  rowId: string,
  faults: FaultSpec[] = [],
): Promise<{ row: RowPayload | null; timings: Record<string, number> }> {
  const spec = ROW_SPECS.find((s) => s.id === rowId);
  if (!spec) return { row: null, timings: {} };

  const { rows, timings } = await fetchRows([spec], faults);
  return { row: rows[0] ?? null, timings };
}

/** Row ids in display order, for the client-side variant to iterate. */
export const ROW_IDS: string[] = ROW_SPECS.map((s) => s.id);

export { fetchRows, TIMEOUT_MS, type RowSpec };
