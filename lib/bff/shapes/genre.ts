import "server-only";

import { BffFatal, type PagePayload, type RequestContext, type TitleSummary } from "../types";
import { runDep } from "../run";
import { tmdb } from "../upstream/tmdb";

/**
 * A single-genre browse page.
 *
 * Kept as its own shape rather than reusing `browse` with a filter, because that is the
 * argument Jacobson makes in "Embracing the Differences" (9 Jul 2012): a One-Size-Fits-All
 * endpoint is convenient for the API provider, not the consumer. This page needs one genre's
 * titles and the genre list for navigation — not eight rows — so it asks for exactly that.
 *
 * The genre list is `fail-silent` (navigation degrades to a heading) while the titles are
 * `fail-fast` (a genre page with no titles is not a page).
 */

const TIMEOUT_MS = 800;

export async function genreShape(ctx: RequestContext): Promise<PagePayload> {
  const genreId = ctx.genreId ?? "";

  if (!/^\d+$/.test(genreId)) {
    throw new BffFatal("bff.genreId", 404, `Not a genre id: "${genreId}"`);
  }

  const [titlesResult, genresResult] = await Promise.all([
    runDep(
      "tmdb.genre." + genreId,
      TIMEOUT_MS,
      (s) => tmdb.moviesByGenre(genreId, s),
      { mode: "fail-fast", status: 502 },
      ctx.faults,
    ),
    runDep(
      "tmdb.genres",
      TIMEOUT_MS,
      (s) => tmdb.genres(s),
      { mode: "fail-silent", empty: [] as { id: string; name: string }[] },
      ctx.faults,
    ),
  ]);

  const name = genresResult.value.find((g) => g.id === genreId)?.name ?? "Browse";

  // A genre id that resolves to nothing is a 404, not an empty page. Netflix's own framing:
  // fail fast when the data is required, to protect system health and tell the truth.
  if (titlesResult.value.length === 0) {
    throw new BffFatal("bff.genreId", 404, `No titles in genre ${genreId}`);
  }

  const degradations = [titlesResult.degradation, genresResult.degradation].filter(
    (d) => d.mode !== "ok",
  );

  return {
    shape: "genre",
    billboard: null,
    rows: [
      {
        id: `genre-${genreId}`,
        title: name,
        algo: "genre",
        items: titlesResult.value as TitleSummary[],
        degraded: titlesResult.degradation,
      },
    ],
    meta: {
      generatedAt: new Date().toISOString(),
      source: process.env.TMDB_API_KEY ? "tmdb" : "fixture",
      shape: "genre",
      profileId: ctx.profileId,
      degradations,
      timings: {
        [`tmdb.genre.${genreId}`]: Math.round(titlesResult.ms * 10) / 10,
        "tmdb.genres": Math.round(genresResult.ms * 10) / 10,
      },
      collapsed: 0,
    },
  };
}
