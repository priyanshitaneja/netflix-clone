#!/usr/bin/env node
/**
 * Generates the committed fixture corpus.
 *
 * PROVENANCE, stated plainly because it matters: these fixtures are **hand-authored**, not
 * captured from TMDB. Titles and years are real; the numeric ids are plausible but not
 * TMDB's real ids; every synopsis is written for this repo rather than copied from TMDB;
 * and `poster_path` is deliberately `null` throughout, so the app renders its own generated
 * placeholder art. That keeps the repo free of scraped copy and third-party image URLs we
 * cannot verify, and it exercises the null-artwork path that TMDB genuinely returns for
 * real titles.
 *
 * `fixtures/capture.mjs` replaces all of this with real captured responses once a
 * TMDB_API_KEY exists. The schemas in lib/bff/upstream/tmdb.schema.ts parse both, so a
 * drifted fixture fails exactly like a bad live response.
 *
 * Genre ids ARE real TMDB ids (28 Action, 878 Science Fiction, ...) because those are
 * stable and publicly documented, and using the real ones means genre routes keep working
 * after a live capture.
 *
 * Usage: node fixtures/generate.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "tmdb");

const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 18, name: "Drama" },
  { id: 27, name: "Horror" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 53, name: "Thriller" },
];

/**
 * The catalog. `g` is genre ids, `v` is a vote average on TMDB's 0-10 scale, `r` runtime.
 * Scores are spread deliberately: a row where every title scores 8.x tells you nothing
 * about whether the match-score UI works.
 */
const MOVIES = [
  { id: 101, title: "The Cartographer's Daughter", year: 2024, g: [18, 12], v: 8.4, r: 128, o: "A mapmaker's daughter retraces her father's final expedition using only his annotated charts, and finds the blank spaces were deliberate." },
  { id: 102, title: "Neon Vernacular", year: 2023, g: [878, 53], v: 7.6, r: 114, o: "In a city where advertising is piped directly into dreams, a translator discovers her own memories are being licensed to a brand." },
  { id: 103, title: "Slow Water", year: 2022, g: [18], v: 7.1, r: 96, o: "Three siblings return to a drowned valley for one summer before the reservoir is raised again." },
  { id: 104, title: "Hollowpoint", year: 2024, g: [28, 80], v: 6.4, r: 107, o: "A retired armourer is pulled back in when the weapons she built start appearing at crime scenes she can date to the day." },
  { id: 105, title: "The Quiet Part", year: 2021, g: [18, 10749], v: 8.0, r: 119, o: "Two people who met through a wrong number keep calling, for eleven years, without ever arranging to meet." },
  { id: 106, title: "Understudy", year: 2023, g: [53, 18], v: 7.3, r: 101, o: "A stand-in learns every one of a leading actress's habits, then keeps performing them after the production wraps." },
  { id: 107, title: "Grand Tour of Nowhere", year: 2020, g: [35, 12], v: 6.8, r: 92, o: "A travel show host whose destination keeps getting cancelled makes the increasingly desperate journey itself the programme." },
  { id: 108, title: "Salt and Silver", year: 2019, g: [18, 12], v: 7.9, r: 134, o: "Two rival photographers document the same disappearing coastline for forty years, and argue about what they saw." },
  { id: 109, title: "The Last Analogue Signal", year: 2024, g: [878, 18], v: 8.2, r: 122, o: "The final terrestrial broadcast tower on Earth is scheduled for demolition, and someone is still transmitting from it." },
  { id: 110, title: "Bitter Orange", year: 2022, g: [80, 53], v: 7.0, r: 105, o: "A citrus inspector uncovers a grove that produces perfect fruit and no records of anyone planting it." },
  { id: 111, title: "Every Exit Is An Entrance", year: 2023, g: [35, 18], v: 7.4, r: 98, o: "An architect who designs escape routes for a living cannot find a way out of a conversation with her mother." },
  { id: 112, title: "Ninety Percent Water", year: 2021, g: [18, 10749], v: 6.9, r: 111, o: "A marine biologist and a poet spend a research season trying to describe the same thing in two incompatible vocabularies." },
  { id: 113, title: "Deadfall Arithmetic", year: 2024, g: [53, 28], v: 6.2, r: 103, o: "A forestry accountant realises the numbers in a logging ledger describe something other than trees." },
  { id: 114, title: "The Understory", year: 2020, g: [18, 27], v: 7.7, r: 116, o: "A canopy researcher spends a year on a platform two hundred feet up, and becomes convinced something is climbing." },
  { id: 115, title: "Rust Belt Sonata", year: 2018, g: [18], v: 8.1, r: 141, o: "A shuttered piano factory's last tuner keeps servicing instruments that no longer have owners." },
  { id: 116, title: "Pocket Universe", year: 2023, g: [16, 878], v: 8.6, r: 89, o: "A child's shoebox diorama turns out to have weather, and then history, and then opinions about being observed." },
  { id: 117, title: "Common Fisheries Policy", year: 2022, g: [35, 80], v: 6.5, r: 94, o: "Rival trawler crews discover the disputed waters they have fought over for a decade contain nothing at all." },
  { id: 118, title: "The Petrichor Line", year: 2024, g: [878, 12], v: 7.8, r: 127, o: "A weather engineer who can smell rain three days out is recruited to explain why a whole region has stopped smelling like anything." },
  { id: 119, title: "Second Position", year: 2021, g: [18, 10749], v: 7.2, r: 108, o: "A corps dancer promoted past her ability has one season to become the person the billing already claims she is." },
  { id: 120, title: "Ledger of Small Debts", year: 2019, g: [80, 18], v: 8.3, r: 132, o: "A village moneylender's meticulous book of favours owed outlives him and begins to be enforced." },
  { id: 121, title: "Ultraviolet Catastrophe", year: 2024, g: [878, 53], v: 7.5, r: 118, o: "A physicist chasing an anomaly in blackbody radiation finds the discrepancy is a message, and it is very old." },
  { id: 122, title: "Hardstanding", year: 2022, g: [28, 18], v: 6.7, r: 99, o: "A decommissioned airbase's caretaker refuses to leave, and the aircraft keep arriving on schedule." },
  { id: 123, title: "The Gleaners' Union", year: 2023, g: [18, 35], v: 7.6, r: 112, o: "Workers who collect what harvesters leave behind organise, and discover the law has no word for what they do." },
  { id: 124, title: "Kettling", year: 2020, g: [53, 18], v: 7.0, r: 97, o: "A crowd-dynamics researcher embedded with a police unit watches her own model being used against the people in it." },
  { id: 125, title: "Provenance Unknown", year: 2024, g: [80, 53], v: 8.0, r: 124, o: "An art authenticator stakes her reputation on a painting whose history begins, verifiably, three weeks ago." },
  { id: 126, title: "Wet Bulb", year: 2023, g: [878, 18], v: 7.9, r: 131, o: "A heat-index forecaster in a city that has run out of night keeps issuing warnings nobody can act on." },
  { id: 127, title: "Nine Tenths of the Law", year: 2021, g: [35, 80], v: 6.6, r: 91, o: "A professional squatter and a property lawyer discover they are both living in the same disputed building." },
  { id: 128, title: "The Long Tail", year: 2019, g: [18, 35], v: 7.3, r: 106, o: "A record shop that sells only albums nobody bought becomes, briefly and disastrously, fashionable." },
];

const SHOWS = [
  { id: 201, name: "Terminal Moraine", year: 2023, g: [18, 878], v: 8.5, o: "A glaciologist's team documents a retreating ice sheet and finds that what it uncovers is being catalogued by someone else first." },
  { id: 202, name: "The Switchboard", year: 2022, g: [18, 80], v: 8.1, o: "Night operators at a 1960s telephone exchange hear a call that has not been placed yet, and keep listening." },
  { id: 203, name: "Fair Use", year: 2024, g: [35, 18], v: 7.7, o: "An overworked copyright tribunal adjudicates increasingly metaphysical claims about who owns a memory." },
  { id: 204, name: "Slack Tide", year: 2021, g: [18], v: 7.9, o: "A tidal island's twelve residents, and the ninety minutes a day the causeway makes them reachable." },
  { id: 205, name: "Cold Chain", year: 2023, g: [53, 80], v: 8.3, o: "A refrigerated logistics network moves something that must never warm up, and nobody in the chain knows what." },
  { id: 206, name: "Marginalia", year: 2020, g: [18, 10749], v: 7.4, o: "Two archivists conduct an entire relationship in the notes they leave in the same set of books." },
  { id: 207, name: "The Anthropic Principle", year: 2024, g: [878, 18], v: 8.7, o: "A cosmology department discovers their observations only work if someone is watching, and takes shifts." },
  { id: 208, name: "Statute of Limitations", year: 2019, g: [80, 53], v: 7.6, o: "A cold case unit works only files about to expire, deciding daily which injustices to let go." },
  { id: 209, name: "Hedgerow", year: 2022, g: [18, 35], v: 7.2, o: "Neighbours in a village where every boundary predates the records that would settle them." },
  { id: 210, name: "Dead Reckoning", year: 2024, g: [12, 18], v: 8.0, o: "A delivery skipper navigating without instruments, and the increasingly generous definition of 'roughly on course'." },
  { id: 211, name: "Ambient Occlusion", year: 2023, g: [878, 53], v: 7.5, o: "A rendering engineer notices the shadows in her studio's engine are computed from a light source that is not in the scene." },
  { id: 212, name: "The Commons", year: 2021, g: [18], v: 7.8, o: "Six families share one field for one season, and negotiate everything from first principles." },
];

const CAST = [
  "Ayesha Raman", "Tobias Field", "Nkechi Adeyemi", "Sofia Marchetti", "Daniel Osei",
  "Ingrid Halvorsen", "Ravi Chandrasekaran", "Marta Kowalczyk", "James Okonkwo", "Yuki Tanaka",
  "Elena Vasquez", "Samuel Byrne", "Priya Nair", "Lucas Mbeki", "Hannah Fitzgerald",
];

/** Deterministic pseudo-random pick so regenerating produces byte-identical fixtures. */
function pick(list, seed, count) {
  const out = [];
  let s = seed;
  const pool = [...list];
  while (out.length < count && pool.length) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(pool.splice(s % pool.length, 1)[0]);
  }
  return out;
}

const movieSummary = (m) => ({
  id: m.id,
  title: m.title,
  overview: m.o,
  poster_path: null,
  backdrop_path: null,
  vote_average: m.v,
  release_date: `${m.year}-0${(m.id % 9) + 1}-1${m.id % 9}`,
  genre_ids: m.g,
  adult: false,
});

const tvSummary = (s) => ({
  id: s.id,
  name: s.name,
  overview: s.o,
  poster_path: null,
  backdrop_path: null,
  vote_average: s.v,
  first_air_date: `${s.year}-0${(s.id % 9) + 1}-0${s.id % 8}`,
  genre_ids: s.g,
});

const paginate = (results) => ({
  page: 1,
  results,
  total_pages: 1,
  total_results: results.length,
});

function write(name, data) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 2) + "\n");
  return name;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const written = [];

  // Exact-slug fixtures, matching fixtureSlug(path, params).
  written.push(
    write(
      "trending-all-week",
      paginate([
        ...pick(MOVIES, 7, 12).map((m) => ({ ...movieSummary(m), media_type: "movie" })),
        ...pick(SHOWS, 11, 8).map((s) => ({ ...tvSummary(s), media_type: "tv" })),
      ]),
    ),
  );

  written.push(
    write(
      "movie-top_rated",
      paginate([...MOVIES].sort((a, b) => b.v - a.v).slice(0, 20).map(movieSummary)),
    ),
  );

  written.push(
    write("tv-popular", paginate([...SHOWS].sort((a, b) => b.v - a.v).map(tvSummary))),
  );

  written.push(write("genre-movie-list", { genres: GENRES }));

  // One discover fixture per genre, keyed exactly as the BFF will request it.
  for (const g of GENRES) {
    const inGenre = MOVIES.filter((m) => m.g.includes(g.id));
    if (inGenre.length === 0) continue;
    written.push(
      write(
        `discover-movie__sort_by-popularity.desc_with_genres-${g.id}`,
        paginate(inGenre.sort((a, b) => b.v - a.v).map(movieSummary)),
      ),
    );
  }

  /**
   * Detail corpus. Per-title detail, `/similar` and `/search/multi` are resolved from this
   * by lib/fixtures/loader.ts rather than committed as one file per title per endpoint —
   * which would be ~90 near-identical files and would still not cover arbitrary search
   * queries. The divergence is documented in fixtures/README.md.
   */
  written.push(
    write("_corpus-movies", {
      movies: MOVIES.map((m) => ({
        ...movieSummary(m),
        runtime: m.r,
        genres: m.g.map((id) => GENRES.find((g) => g.id === id)).filter(Boolean),
        credits: {
          cast: pick(CAST, m.id, 6).map((name, order) => ({ name, order })),
        },
        release_dates: {
          results: [
            {
              iso_3166_1: "US",
              release_dates: [{ certification: m.v > 8 ? "PG-13" : "R" }],
            },
          ],
        },
      })),
    }),
  );

  written.push(write("_corpus-tv", { shows: SHOWS.map(tvSummary) }));

  console.log(`Wrote ${written.length} fixtures to fixtures/tmdb/:`);
  for (const name of written) console.log(`  ${name}.json`);
  console.log(`\n${MOVIES.length} movies, ${SHOWS.length} shows, ${GENRES.length} genres.`);
}

main();
