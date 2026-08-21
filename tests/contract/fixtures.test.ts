import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  TmdbGenreList,
  TmdbMixedList,
  TmdbMovieDetail,
  TmdbMovieList,
  TmdbTvList,
  TmdbTvSummary,
} from "@/lib/bff/upstream/tmdb.schema";
import { FixtureMissing, tmdb } from "@/lib/bff/upstream/tmdb";
import { fixtureSlug, source } from "@/lib/fixtures/source";
import { browseShape } from "@/lib/bff/shapes/browse";
import { genreShape } from "@/lib/bff/shapes/genre";
import { myListShape } from "@/lib/bff/shapes/myList";
import { searchShape } from "@/lib/bff/shapes/search";
import { titleDetailShape } from "@/lib/bff/shapes/titleDetail";
import type { RequestContext } from "@/lib/bff/types";
import { slugFor, MANIFEST } from "../../fixtures/capture.mjs";

/**
 * The contract between the committed fixtures and the schemas a live response goes through.
 *
 * The offline path is not a convenience here, it is the substrate: the entire resilience
 * curriculum runs with no API key, so a fixture that has drifted from TMDB's real shape
 * does not merely break a demo — it invalidates every number measured against it. Both
 * fetchers return unparsed `unknown` and both go through these same schemas, which is what
 * makes that drift detectable at all. This file is what makes it detectable *early*.
 */

const DIR = join(process.cwd(), "fixtures", "tmdb");
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), "utf8")) as unknown;

/**
 * Filename pattern -> the schema that file must satisfy.
 *
 * Ordered: the first matching rule wins, so `_corpus-*` is listed before the general
 * `movie-*` rule it would otherwise collide with.
 */
const RULES: { match: RegExp; name: string; schema: z.ZodTypeAny }[] = [
  { match: /^_corpus-movies\.json$/, name: "movie detail corpus", schema: z.object({ movies: z.array(TmdbMovieDetail) }) },
  { match: /^_corpus-tv\.json$/, name: "tv corpus", schema: z.object({ shows: z.array(TmdbTvSummary) }) },
  { match: /^trending-all-week\.json$/, name: "mixed list", schema: TmdbMixedList },
  { match: /^genre-movie-list\.json$/, name: "genre list", schema: TmdbGenreList },
  { match: /^tv-popular\.json$/, name: "tv list", schema: TmdbTvList },
  { match: /^movie-top_rated\.json$/, name: "movie list", schema: TmdbMovieList },
  { match: /^discover-movie__.+\.json$/, name: "movie list", schema: TmdbMovieList },
  { match: /^movie-\d+-similar(__.*)?\.json$/, name: "movie list", schema: TmdbMovieList },
  { match: /^movie-\d+(__.*)?\.json$/, name: "movie detail", schema: TmdbMovieDetail },
  { match: /^search-multi__.+\.json$/, name: "mixed list", schema: TmdbMixedList },
];

const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

describe("every committed fixture parses", () => {
  it("finds fixtures at all", () => {
    // A passing suite over an empty directory is the failure mode this guards.
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)("%s", (file) => {
    const rule = RULES.find((r) => r.match.test(file));

    // An unrecognised filename is a failure, not a skip. Otherwise the way to add an
    // unvalidated fixture is simply to name it something new.
    expect(rule, `no schema rule matches ${file} — add one to RULES`).toBeDefined();

    const result = rule!.schema.safeParse(read(file));
    expect(
      result.success ? "" : `${file} does not match the ${rule!.name} schema:\n${z.prettifyError(result.error)}`,
    ).toBe("");
  });
});

describe("fixture coverage of what the app actually requests", () => {
  it("has a discover fixture for every genre it advertises", () => {
    // The genre list is what the UI links to. A genre in that list with no fixture behind
    // it is a 404 the user can reach by clicking, which is exactly the "no-key path is the
    // degraded path" failure the fixture layer exists to prevent.
    const { genres } = TmdbGenreList.parse(read("genre-movie-list.json"));
    const missing = genres
      .map((g) => fixtureSlug("/discover/movie", { with_genres: String(g.id), sort_by: "popularity.desc" }))
      .filter((slug) => !files.includes(`${slug}.json`));

    expect(missing).toEqual([]);
  });

  it("derives the same filename in capture.mjs as in the app", () => {
    // capture.mjs is a plain .mjs script and cannot import the TypeScript module, so the
    // slug logic exists twice. If the two ever diverge, a capture lands under a name the
    // app never looks up and the app silently keeps serving the synthetic corpus — no
    // error, no empty page, just stale data. This is that guard.
    const cases: [string, Record<string, string | number>][] = [
      ["/trending/all/week", {}],
      ["/movie/top_rated", {}],
      ["/discover/movie", { with_genres: "28", sort_by: "popularity.desc" }],
      ["/discover/movie", { sort_by: "popularity.desc", with_genres: "28" }],
      ["/movie/550", { append_to_response: "credits,release_dates" }],
      ["/movie/550/similar", {}],
      ["/search/multi", { query: "the quiet part" }],
      ["/genre/movie/list", {}],
    ];

    for (const [path, params] of cases) {
      expect(slugFor(path, params), `${path} ${JSON.stringify(params)}`).toBe(
        fixtureSlug(path, params),
      );
    }
  });

  it("sorts params so argument order cannot produce two files for one request", () => {
    expect(fixtureSlug("/x", { b: 2, a: 1 })).toBe(fixtureSlug("/x", { a: 1, b: 2 }));
  });

  it("mirrors the app's fixed-param calls in the capture manifest", () => {
    // Every manifest entry must land on a slug the fixture directory already knows, which
    // is a cheap proxy for "capture.mjs asks TMDB for what the app asks for".
    const unknown = MANIFEST.map((e: { path: string; params: Record<string, string> }) =>
      slugFor(e.path, e.params),
    ).filter((slug: string) => !files.includes(`${slug}.json`));

    expect(unknown).toEqual([]);
  });
});

/**
 * The behavioural half. `source` is decided once at import time from `TMDB_API_KEY`, so
 * these can only assert the offline contract when no key is present. CI runs the suite with
 * the key unset — that job going green is the actual guarantee that `git clone && npm i &&
 * npm run dev` gives a complete app.
 */
describe.skipIf(source === "tmdb")("the offline path serves every dependency", () => {
  const ctx = (overrides: Partial<RequestContext> = {}): RequestContext => ({
    profileId: "test",
    locale: "en-US",
    faults: [],
    deadlineMs: 2_500,
    cells: {},
    myList: [],
    ...overrides,
  });

  it("resolves every method on the dependency surface", async () => {
    const [trending, topRated, popularTv, genres, byGenre, search] = await Promise.all([
      tmdb.trending(),
      tmdb.topRatedMovies(),
      tmdb.popularTv(),
      tmdb.genres(),
      tmdb.moviesByGenre("878"),
      tmdb.search("water"),
    ]);

    expect(trending.length).toBeGreaterThan(0);
    expect(topRated.length).toBeGreaterThan(0);
    expect(popularTv.length).toBeGreaterThan(0);
    expect(genres.length).toBeGreaterThan(0);
    expect(byGenre.length).toBeGreaterThan(0);
    expect(search.length).toBeGreaterThan(0);
  });

  it("resolves detail and similar for every title the browse rows contain", async () => {
    const page = await browseShape(ctx());
    const ids = [...new Set(page.rows.flatMap((r) => r.items.map((i) => i.id)))]
      .filter((id) => id.startsWith("movie-"))
      .map((id) => Number(id.slice("movie-".length)));

    expect(ids.length).toBeGreaterThan(0);

    // Every card on the page is a link. A card whose detail page cannot resolve offline is
    // a dead end the user finds by clicking, so the assertion is over all of them.
    for (const id of ids) {
      const detail = await tmdb.movieDetail(id);
      expect(detail.name.length, `movie-${id}`).toBeGreaterThan(0);
      await expect(tmdb.similarMovies(id), `movie-${id} similar`).resolves.toBeDefined();
    }
  });

  it("builds all five page shapes with nothing degraded", async () => {
    const [browse, detail, genre, search, myList] = await Promise.all([
      browseShape(ctx()),
      titleDetailShape(ctx({ titleId: "movie-101" })),
      genreShape(ctx({ genreId: "878" })),
      searchShape(ctx({ query: "water" })),
      myListShape(ctx({ myList: ["movie-101", "movie-102"] })),
    ]);

    expect(browse.rows).toHaveLength(8);
    expect(browse.billboard).not.toBeNull();
    expect(detail.detail?.synopsis.length ?? 0).toBeGreaterThan(0);
    expect(genre.rows[0]?.items.length ?? 0).toBeGreaterThan(0);
    expect(search.rows[0]?.items.length ?? 0).toBeGreaterThan(0);
    expect(myList.rows[0]?.items).toHaveLength(2);

    for (const page of [browse, detail, genre, search, myList]) {
      expect(page.meta.degradations, page.shape).toEqual([]);
      expect(page.meta.source).toBe("fixture");
    }
  });

  it("fails loudly and namefully when a fixture is genuinely absent", async () => {
    // The alternative — a silent empty array — is how a fixture layer rots: the page still
    // renders, one row is just quietly gone, and the measurement taken against it is wrong.
    await expect(tmdb.movieDetail(999_999)).rejects.toBeInstanceOf(FixtureMissing);
    await expect(tmdb.movieDetail(999_999)).rejects.toThrow(/fixtures\/tmdb\/movie-999999/);
    await expect(tmdb.movieDetail(999_999)).rejects.toThrow(/capture\.mjs/);
  });
});
