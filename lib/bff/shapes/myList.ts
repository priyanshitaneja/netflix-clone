import "server-only";

import type { PagePayload, RequestContext, TitleSummary } from "../types";
import { runDep } from "../run";
import { parseTitleId, tmdb } from "../upstream/tmdb";

/**
 * My List.
 *
 * The list itself is just ids in a cookie — there is no account system here, and storing
 * one would be a liability with no teaching value.
 *
 * This shape is a deliberate, documented N+1: it resolves each saved id with its own
 * upstream call. That is the naive thing to do and it is left naive on purpose, because it
 * is the clearest place in the app to measure two later lessons:
 *
 *   - L2.4 (request collapsing, Christensen 2012) — a list containing two titles that share
 *     a `/similar` neighbourhood currently issues duplicate upstream work.
 *   - L2.13 (per-request resolver cache, Shtatnov & Ranganathan 2018) — the DataLoader
 *     pattern turns this N+1 into one batched fetch, and the assertion is that upstream
 *     calls per page drop from N to 1.
 *
 * Deleting the N+1 now would delete both lessons. It stays until Phase 4/7 measure it away.
 */

const TIMEOUT_MS = 700;

export async function myListShape(ctx: RequestContext): Promise<PagePayload> {
  const ids = ctx.myList.filter((id) => parseTitleId(id) !== null);

  const settled = await Promise.all(
    ids.map((id) => {
      const parsed = parseTitleId(id)!;
      return runDep(
        `tmdb.movieDetail.${parsed.tmdbId}`,
        TIMEOUT_MS,
        (s) => tmdb.movieDetail(parsed.tmdbId, s),
        // One unresolvable saved title must not empty the whole list.
        { mode: "fail-silent", empty: null as TitleSummary | null },
        ctx.faults,
      );
    }),
  );

  const items = settled
    .map((r) => r.value)
    .filter((value): value is TitleSummary => value !== null);

  const timings: Record<string, number> = {};
  const degradations: PagePayload["meta"]["degradations"] = [];
  settled.forEach((r, i) => {
    timings[`tmdb.movieDetail.${ids[i]}`] = Math.round(r.ms * 10) / 10;
    if (r.degradation.mode !== "ok") degradations.push(r.degradation);
  });

  return {
    shape: "myList",
    billboard: null,
    rows:
      items.length > 0
        ? [{ id: "my-list", title: "My List", algo: "myList", items, degraded: { mode: "ok" } }]
        : [],
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
      shape: "myList",
      profileId: ctx.profileId,
      degradations,
      timings,
      collapsed: 0,
    },
  };
}
