import "server-only";

import { BffFatal, type PagePayload, type RequestContext, type TitleSummary } from "../types";
import { runDep } from "../run";
import { parseTitleId, tmdb } from "../upstream/tmdb";

/**
 * The title detail page.
 *
 * This shape is where the fallback-mode distinction becomes concrete, and it is the clearest
 * illustration of Schmaus's 2011 taxonomy in the whole app:
 *
 *   - the title itself is **fail-fast**. Without it there is no page, so returning a
 *     half-rendered shell would be worse than an honest error.
 *   - the "More Like This" row is **fail-silent**. It is optional, so it drops.
 *
 * Getting that pairing right is the entire lesson (L2.7). Applying fail-fast to the similar
 * row would kill a page over a decoration; applying fail-silent to the title would render a
 * page about nothing.
 */

const TITLE_TIMEOUT_MS = 900;
const SIMILAR_TIMEOUT_MS = 700;

export async function titleDetailShape(ctx: RequestContext): Promise<PagePayload> {
  const titleId = ctx.titleId ?? "";
  const parsed = parseTitleId(titleId);

  // A malformed id is a client error, not a dependency failure — 404 before any fan-out.
  if (!parsed) {
    throw new BffFatal("bff.titleId", 404, `Not a title id: "${titleId}"`);
  }

  // TV detail is not implemented upstream yet; say so honestly rather than 500 later.
  if (parsed.mediaType === "tv") {
    throw new BffFatal("bff.titleId", 404, "TV detail pages are not implemented yet");
  }

  const detailResult = await runDep(
    "tmdb.movieDetail",
    TITLE_TIMEOUT_MS,
    (s) => tmdb.movieDetail(parsed.tmdbId, s),
    { mode: "fail-fast", status: 502 },
    ctx.faults,
  );

  /**
   * ==========================================================================
   * SERIALIZED ON PURPOSE. This is lesson L2.3's *before* — do not "fix" it.
   * ==========================================================================
   *
   * `similarMovies` needs only `parsed.tmdbId`, which we already have. Nothing here waits
   * on `detailResult`, so this second `await` buys nothing and costs a full round trip:
   * the page takes detail + similar rather than max(detail, similar).
   *
   * It is left serialized because L2.3 — "compose concurrent fetches; never serialize",
   * from "Optimizing the Netflix API" (Ben Christensen, 15 Jan 2013) — is proven by a
   * delta, and `/browse` already fans out concurrently, so without this the lesson has no
   * before to measure against. Phase 5 hoists both into one `Promise.all` and records the
   * after beside it.
   *
   * Offline this costs about a millisecond; against live TMDB it is roughly 100 ms of pure
   * waiting. That gap is itself the point, and lesson L2.3 says so.
   */
  const similarResult = await runDep(
    "tmdb.similarMovies",
    SIMILAR_TIMEOUT_MS,
    (s) => tmdb.similarMovies(parsed.tmdbId, s),
    { mode: "fail-silent", empty: [] as TitleSummary[] },
    ctx.faults,
  );

  const detail = { ...detailResult.value, similar: similarResult.value };

  const degradations = [detailResult.degradation, similarResult.degradation].filter(
    (d) => d.mode !== "ok",
  );

  return {
    shape: "titleDetail",
    billboard: detail,
    detail,
    rows:
      similarResult.value.length > 0
        ? [
            {
              id: "similar",
              title: "More Like This",
              algo: "becauseYouWatched",
              items: similarResult.value,
              degraded: similarResult.degradation,
            },
          ]
        : [],
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
      shape: "titleDetail",
      profileId: ctx.profileId,
      degradations,
      timings: {
        "tmdb.movieDetail": Math.round(detailResult.ms * 10) / 10,
        "tmdb.similarMovies": Math.round(similarResult.ms * 10) / 10,
      },
      collapsed: 0,
    },
  };
}
