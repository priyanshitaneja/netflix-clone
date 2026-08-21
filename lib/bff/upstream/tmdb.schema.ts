import { z } from "zod";

/**
 * TMDB's wire format, and nothing else.
 *
 * Both the live fetcher and the fixture fetcher return unparsed `unknown` and both go
 * through these schemas. That symmetry is the whole trick: a fixture that drifts from
 * TMDB's real shape fails exactly like a bad live response, so **fixtures cannot rot
 * silently**. A contract test parses every committed fixture against the schema it claims
 * to satisfy.
 *
 * Fields we do not use are deliberately not modelled. TMDB returns far more than this, and
 * `.passthrough()` is avoided so an unexpected extra key never quietly becomes a
 * dependency.
 */

/** TMDB scores 0-10 with one decimal. Normalised to 0-100 once, in the mapper. */
const voteAverage = z.number().min(0).max(10);

/**
 * TMDB paths look like `/wwemzKWzjKYJFfCeiB57q3r4Bcm.png`. Nullable because TMDB genuinely
 * returns null for titles with no artwork — which is why the placeholder path is a real
 * code path rather than fixture-only scaffolding.
 */
const imagePath = z.string().regex(/^\/[\w.-]+$/).nullable();

export const TmdbMovieSummary = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  overview: z.string(),
  poster_path: imagePath,
  backdrop_path: imagePath,
  vote_average: voteAverage,
  release_date: z.string().optional(),
  genre_ids: z.array(z.number().int()).default([]),
  adult: z.boolean().default(false),
});

export const TmdbTvSummary = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  overview: z.string(),
  poster_path: imagePath,
  backdrop_path: imagePath,
  vote_average: voteAverage,
  first_air_date: z.string().optional(),
  genre_ids: z.array(z.number().int()).default([]),
});

/**
 * `/trending/all/week` mixes movies and TV in one list, discriminated by `media_type`.
 * Modelling that union honestly here is what lets one row carry both without the UI
 * caring.
 */
export const TmdbMixedSummary = z.union([
  TmdbMovieSummary.extend({ media_type: z.literal("movie") }),
  TmdbTvSummary.extend({ media_type: z.literal("tv") }),
]);

export const TmdbPaginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    page: z.number().int().nonnegative(),
    results: z.array(item),
    total_pages: z.number().int().nonnegative(),
    total_results: z.number().int().nonnegative(),
  });

export const TmdbMovieList = TmdbPaginated(TmdbMovieSummary);
export const TmdbTvList = TmdbPaginated(TmdbTvSummary);
export const TmdbMixedList = TmdbPaginated(TmdbMixedSummary);

export const TmdbMovieDetail = TmdbMovieSummary.extend({
  runtime: z.number().int().positive().nullable(),
  genres: z.array(z.object({ id: z.number().int(), name: z.string() })).default([]),
  credits: z
    .object({
      cast: z.array(z.object({ name: z.string(), order: z.number().int() })).default([]),
    })
    .optional(),
  release_dates: z
    .object({
      results: z
        .array(
          z.object({
            iso_3166_1: z.string(),
            release_dates: z.array(z.object({ certification: z.string() })).default([]),
          }),
        )
        .default([]),
    })
    .optional(),
});

export const TmdbGenreList = z.object({
  genres: z.array(z.object({ id: z.number().int(), name: z.string().min(1) })),
});

export type TmdbMovieSummary = z.infer<typeof TmdbMovieSummary>;
export type TmdbTvSummary = z.infer<typeof TmdbTvSummary>;
export type TmdbMixedSummary = z.infer<typeof TmdbMixedSummary>;
export type TmdbMovieDetail = z.infer<typeof TmdbMovieDetail>;
export type TmdbGenreList = z.infer<typeof TmdbGenreList>;
