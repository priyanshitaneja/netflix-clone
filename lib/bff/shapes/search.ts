import "server-only";

import type { PagePayload, RequestContext, TitleSummary } from "../types";
import { runDep } from "../run";
import { tmdb } from "../upstream/tmdb";

/**
 * Search results.
 *
 * Search is the least important dependency on the site and the most bursty — one keystroke
 * per request if you let it be — which is why it gets the smallest bulkhead in Phase 4
 * (`maxConcurrent: 2`) and is deliberately the first thing starved under load. A page of
 * results is `fail-silent`: an empty state is a legitimate answer to a search, so a failure
 * degrades to "no results" rather than to an error page.
 *
 * The honest caveat: "no results" and "search is broken" look identical to the user, which
 * is why the payload carries the degradation and the UI says which one happened.
 */

const TIMEOUT_MS = 700;
const MAX_QUERY_LENGTH = 120;

export async function searchShape(ctx: RequestContext): Promise<PagePayload> {
  const query = (ctx.query ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  // No query is not a failed search — do not spend an upstream call proving it.
  if (query.length === 0) {
    return {
      shape: "search",
      billboard: null,
      rows: [],
      meta: {
        generatedAt: new Date().toISOString(),
        source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
        shape: "search",
        profileId: ctx.profileId,
        degradations: [],
        timings: {},
        collapsed: 0,
      },
    };
  }

  const result = await runDep(
    "tmdb.search",
    TIMEOUT_MS,
    (s) => tmdb.search(query, s),
    { mode: "fail-silent", empty: [] as TitleSummary[] },
    ctx.faults,
  );

  return {
    shape: "search",
    billboard: null,
    rows:
      result.value.length > 0
        ? [
            {
              id: "results",
              title: `Results for “${query}”`,
              algo: "genre",
              items: result.value,
              degraded: result.degradation,
            },
          ]
        : [],
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
      shape: "search",
      profileId: ctx.profileId,
      degradations: result.degradation.mode === "ok" ? [] : [result.degradation],
      timings: { "tmdb.search": Math.round(result.ms * 10) / 10 },
      collapsed: 0,
    },
  };
}
