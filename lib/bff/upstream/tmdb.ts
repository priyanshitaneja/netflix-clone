import "server-only";

import type { z } from "zod";
import { loadFixture } from "@/lib/fixtures/loader";
import { fixtureSlug, offline, source } from "@/lib/fixtures/source";
import type { Artwork, MediaType, TitleDetail, TitleSummary } from "@/lib/bff/types";
import {
  TmdbGenreList,
  TmdbMixedList,
  TmdbMovieDetail,
  TmdbMovieList,
  TmdbTvList,
  type TmdbMixedSummary,
  type TmdbMovieDetail as TmdbMovieDetailType,
  type TmdbMovieSummary,
  type TmdbTvSummary,
} from "./tmdb.schema";

/**
 * The only module in the codebase that knows TMDB's wire format, and the only place the
 * live-vs-fixture branch exists.
 *
 * `import "server-only"` at the top turns an accidental client import into a build error
 * rather than a leaked API key. The key is read here and nowhere else; the BFF is the only
 * thing that talks to TMDB.
 */

const BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export class FixtureMissing extends Error {
  constructor(slug: string, path: string, params: Params = {}) {
    // The params are part of the slug, so a hint that omitted them would print a command
    // that captures a *different* file than the one being asked for. Loud and wrong is
    // worse than loud.
    const query = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    super(
      `No fixture for "${slug}". Expected fixtures/tmdb/${slug}.json.\n` +
        `Capture it with: TMDB_API_KEY=... node fixtures/capture.mjs "${path}${query ? `?${query}` : ""}"`,
    );
    this.name = "FixtureMissing";
  }
}

export class UpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`TMDB ${path} responded ${status}`);
    this.name = "UpstreamError";
  }
}

type Params = Record<string, string | number>;
type Fetcher = (path: string, params: Params, signal?: AbortSignal) => Promise<unknown>;

/**
 * TMDB accepts either a v3 key as a query parameter or a v4 token as a bearer header.
 * Sniffing the shape means either kind of key from their settings page just works, instead
 * of failing with an opaque 401.
 */
function authFor(key: string): { headers: HeadersInit; query: Params } {
  const isV4Token = key.split(".").length === 3;
  return isV4Token
    ? { headers: { Authorization: `Bearer ${key}` }, query: {} }
    : { headers: {}, query: { api_key: key } };
}

const liveFetcher: Fetcher = async (path, params, signal) => {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("liveFetcher called without TMDB_API_KEY");

  const auth = authFor(key);
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries({ ...auth.query, ...params })) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    headers: { accept: "application/json", ...auth.headers },
    signal,
    // Opt out of Next's per-render fetch memoization. Phase 4 measures our own request
    // collapser, and leaving this on would credit the collapser with Next's work.
    cache: "no-store",
  });

  // 429 is a real outcome here, not a hypothetical: TMDB allows ~40 requests/second and
  // sends no Retry-After and no X-RateLimit-* headers, so back-off has to come from our
  // own rolling window (Phase 4).
  if (!res.ok) throw new UpstreamError(res.status, path);
  return res.json();
};

const fixtureFetcher: Fetcher = async (path, params) => {
  const data = await loadFixture(path, params);
  if (data === null) throw new FixtureMissing(fixtureSlug(path, params), path, params);
  return data;
};

const fetcher: Fetcher = source === "tmdb" ? liveFetcher : fixtureFetcher;

/** Both fetchers return `unknown`; both go through the same parser. That symmetry is the point. */
async function get<S extends z.ZodTypeAny>(
  schema: S,
  path: string,
  params: Params = {},
  signal?: AbortSignal,
): Promise<z.infer<S>> {
  return schema.parse(await fetcher(path, params, signal)) as z.infer<S>;
}

// ---------------------------------------------------------------------------
// Wire format -> domain types. Normalise once, here, so nothing downstream has
// to know that TMDB scores out of 10 or that its image paths are relative.
// ---------------------------------------------------------------------------

function artworkFor(
  id: string,
  name: string,
  posterPath: string | null,
  backdropPath: string | null,
): Artwork {
  // A generated placeholder when TMDB has no artwork, or when we are fully offline.
  // TMDB returns null posters for real titles, so this is a production code path.
  if (!posterPath || offline) {
    return {
      poster: `/api/placeholder/${id}?n=${encodeURIComponent(name)}`,
      backdrop: backdropPath && !offline ? `${IMAGE_BASE}/w1280${backdropPath}` : null,
      isPlaceholder: true,
    };
  }
  return {
    poster: `${IMAGE_BASE}/w500${posterPath}`,
    backdrop: backdropPath ? `${IMAGE_BASE}/w1280${backdropPath}` : null,
    isPlaceholder: false,
  };
}

function yearOf(date: string | undefined): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
}

/**
 * TMDB's 0-10 vote average becomes a 0-100 "match score".
 *
 * Netflix's real match percentage is a personalized relevance prediction, not a global
 * average rating — an entirely different quantity. Ours is a rescaled public average, and
 * the UI labels it honestly rather than borrowing Netflix's meaning.
 */
function matchScoreOf(voteAverage: number): number | null {
  return voteAverage > 0 ? Math.round(voteAverage * 10) : null;
}

function movieToSummary(m: TmdbMovieSummary): TitleSummary {
  const id = `movie-${m.id}`;
  return {
    id,
    mediaType: "movie",
    name: m.title,
    artwork: artworkFor(id, m.title, m.poster_path, m.backdrop_path),
    matchScore: matchScoreOf(m.vote_average),
    year: yearOf(m.release_date),
    maturity: m.adult ? "18+" : null,
  };
}

function tvToSummary(t: TmdbTvSummary): TitleSummary {
  const id = `tv-${t.id}`;
  return {
    id,
    mediaType: "tv",
    name: t.name,
    artwork: artworkFor(id, t.name, t.poster_path, t.backdrop_path),
    matchScore: matchScoreOf(t.vote_average),
    year: yearOf(t.first_air_date),
    maturity: null,
  };
}

function mixedToSummary(item: TmdbMixedSummary): TitleSummary {
  return item.media_type === "movie" ? movieToSummary(item) : tvToSummary(item);
}

/** `movie-550` -> `{ mediaType: "movie", tmdbId: 550 }`. Inverse of the id construction above. */
export function parseTitleId(id: string): { mediaType: MediaType; tmdbId: number } | null {
  const match = /^(movie|tv)-(\d+)$/.exec(id);
  if (!match) return null;
  return { mediaType: match[1] as MediaType, tmdbId: Number(match[2]) };
}

/**
 * Open test streams, assigned deterministically so a given title always plays the same
 * content. Netflix ships DASH in browsers (Eddy/Trunnell/Gallagher, 21 Mar 2017); hls.js is
 * carried alongside as the industry default so Phase 6 can compare both players on
 * byte-identical content. Tears of Steel serves an identical 5-rung ladder on both
 * protocols, which is what makes that comparison meaningful.
 *
 * There is no DRM anywhere: a Widevine CDM licence requires a commercial agreement and no
 * open-source CDM exists (ledger H-09).
 */
const STREAMS = {
  dash: [
    "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.mpd",
    "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
  ],
  hls: [
    "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8",
    "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  ],
} as const;

function certificationOf(detail: TmdbMovieDetailType): string | null {
  const region =
    detail.release_dates?.results.find((r) => r.iso_3166_1 === "US") ??
    detail.release_dates?.results[0];
  const cert = region?.release_dates.find((d) => d.certification.length > 0)?.certification;
  return cert ?? (detail.adult ? "18+" : null);
}

// ---------------------------------------------------------------------------
// The dependency surface. One method per upstream call, named so the name can
// become a circuit-breaker identity in Phase 4 without renaming anything.
// ---------------------------------------------------------------------------

export const tmdb = {
  async trending(signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(TmdbMixedList, "/trending/all/week", {}, signal);
    return data.results.map(mixedToSummary);
  },

  async topRatedMovies(signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(TmdbMovieList, "/movie/top_rated", {}, signal);
    return data.results.map(movieToSummary);
  },

  async popularTv(signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(TmdbTvList, "/tv/popular", {}, signal);
    return data.results.map(tvToSummary);
  },

  async moviesByGenre(genreId: string, signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(
      TmdbMovieList,
      "/discover/movie",
      { with_genres: genreId, sort_by: "popularity.desc" },
      signal,
    );
    return data.results.map(movieToSummary);
  },

  async genres(signal?: AbortSignal): Promise<{ id: string; name: string }[]> {
    const data = await get(TmdbGenreList, "/genre/movie/list", {}, signal);
    return data.genres.map((g) => ({ id: String(g.id), name: g.name }));
  },

  async search(query: string, signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(TmdbMixedList, "/search/multi", { query }, signal);
    return data.results.map(mixedToSummary);
  },

  async movieDetail(tmdbId: number, signal?: AbortSignal): Promise<TitleDetail> {
    const detail = await get(
      TmdbMovieDetail,
      `/movie/${tmdbId}`,
      { append_to_response: "credits,release_dates" },
      signal,
    );
    const id = `movie-${detail.id}`;

    return {
      id,
      mediaType: "movie",
      name: detail.title,
      artwork: artworkFor(id, detail.title, detail.poster_path, detail.backdrop_path),
      matchScore: matchScoreOf(detail.vote_average),
      year: yearOf(detail.release_date),
      maturity: certificationOf(detail),
      synopsis: detail.overview,
      runtimeMinutes: detail.runtime,
      genres: detail.genres.map((g) => ({ id: String(g.id), name: g.name })),
      cast: (detail.credits?.cast ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, 6)
        .map((c) => c.name),
      streams: {
        // Deterministic per title, so a given title always plays the same content.
        dash: [STREAMS.dash[detail.id % STREAMS.dash.length]!, ...STREAMS.dash],
        hls: [STREAMS.hls[detail.id % STREAMS.hls.length]!, ...STREAMS.hls],
      },
      similar: [],
    };
  },

  async similarMovies(tmdbId: number, signal?: AbortSignal): Promise<TitleSummary[]> {
    const data = await get(TmdbMovieList, `/movie/${tmdbId}/similar`, {}, signal);
    return data.results.map(movieToSummary);
  },
};

export type TmdbDependency = keyof typeof tmdb;
