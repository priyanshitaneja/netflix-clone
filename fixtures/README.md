# fixtures/

The committed data that makes `git clone && npm i && npm run dev` a complete app.

**The no-API-key path must never be the degraded path.** Everything here exists to serve
that rule. The live/fixture branch lives in exactly one module — the transport inside
`lib/bff/upstream/tmdb.ts` — so `getPage`, the shapes, every component and the whole
resilience layer cannot tell where the bytes came from.

## Provenance, stated plainly

These fixtures are **hand-authored, not captured from TMDB.** Written for this repo by
`generate.mjs` on **2026-08-19**.

- Film and series titles, synopses, years, runtimes, cast names and vote averages are
  **invented for this repo**. None of it is copied from TMDB.
- Numeric title ids (`101`–`128`, `201`–`212`) are **plausible but not TMDB's real ids**.
- **Genre ids are real** TMDB ids (28 Action, 878 Science Fiction, …). Those are stable and
  publicly documented, and using the real ones means genre routes keep working unchanged
  after a live capture.
- `poster_path` and `backdrop_path` are **`null` throughout**, so the app renders its own
  generated placeholder art from `/api/placeholder/[titleId]`.

Two reasons, both deliberate. It keeps the repo free of scraped copy and of third-party
image URLs whose licensing we cannot verify. And it makes the null-artwork path — which
TMDB genuinely returns for real titles — a permanently exercised production code path
rather than something that only breaks in front of a user.

`vote_average` is spread on purpose across 6.2–8.7. A catalog where every title scores 8.x
tells you nothing about whether the match-score UI works.

## What is committed

| File | Serves | Items |
|---|---|---|
| `trending-all-week.json` | `GET /trending/all/week` | 20 (12 movies + 8 series, mixed) |
| `movie-top_rated.json` | `GET /movie/top_rated` | 20 |
| `tv-popular.json` | `GET /tv/popular` | 12 |
| `genre-movie-list.json` | `GET /genre/movie/list` | 10 genres |
| `discover-movie__sort_by-popularity.desc_with_genres-<id>.json` | `GET /discover/movie` per genre | 1–17 each, 10 files |
| `_corpus-movies.json` | detail-shaped source for synthesised endpoints | 28 movies |
| `_corpus-tv.json` | series source for synthesised endpoints | 12 series |

Filenames are **not** chosen by hand. `fixtureSlug(path, params)` in
`lib/fixtures/source.ts` derives them, params sorted so `?a=1&b=2` and `?b=2&a=1` resolve to
one file. A missing fixture therefore throws `FixtureMissing` naming the exact file and
printing the command that would capture it — never a silent empty array.

## Three endpoints are synthesised, not committed

`lib/fixtures/loader.ts` resolves these from the two `_corpus-*` files:

| Endpoint | Why not one file each |
|---|---|
| `/search/multi?query=…` | Arbitrary user input. There is no finite set of files, and `FixtureMissing` on an unrecognised search would make the no-key path the degraded path — the one thing this layer must not do. Resolved as a case-insensitive substring match over title and synopsis. |
| `/movie/{id}` | ~40 near-identical files. Resolved from `_corpus-movies.json`. |
| `/movie/{id}/similar` | Same. Resolved as same-genre neighbours, highest-rated first — not TMDB's recommendation model, just a defensible local stand-in. |

This is a real divergence: the fixture layer reimplements a little of TMDB's behaviour
locally. The property that matters is preserved — the fetcher still returns unparsed
`unknown` and the caller still parses it with the same zod schema a live response goes
through, so a drifted fixture fails exactly like a bad upstream. An exact-slug file always
wins over a synthesised result, so a real capture takes precedence automatically.

## Fixtures cannot rot silently

`tests/contract/fixtures.test.ts` asserts, on every `npm run check`:

- every `*.json` here parses under the schema its filename claims — and an **unrecognised
  filename fails the suite**, so a new fixture cannot dodge validation by being named
  something new;
- every genre advertised by `genre-movie-list.json` has a `discover` fixture behind it, so
  no genre link in the UI can 404;
- `slugFor()` in `capture.mjs` and `fixtureSlug()` in `lib/fixtures/source.ts` derive
  byte-identical filenames;
- every dependency method resolves offline, every title on `/browse` has a working detail
  page, and all five page shapes build with **zero degradations**.

That last one is the real guarantee. If the offline path were quietly serving empty rows,
the suite would be green and every measurement taken against it would be wrong.

## Regenerating

```bash
node fixtures/generate.mjs        # rewrite the synthetic corpus (no key needed)
```

Deterministic: the pseudo-random picks are seeded, so regenerating produces byte-identical
files. A diff after running it means someone edited a fixture by hand.

## Capturing real TMDB responses

```bash
TMDB_API_KEY=... node fixtures/capture.mjs                  # the whole manifest
TMDB_API_KEY=... node fixtures/capture.mjs "/movie/550"      # one endpoint
```

Two limits worth knowing before you run it.

**The network path in `capture.mjs` has never been executed in this repo** — no TMDB key
exists on the machine it was written on. What *is* verified is the property whose failure
would be silent: that its slug derivation matches the app's. If those diverged, a capture
would land under a name the app never looks up and the app would keep serving the synthetic
corpus with no error at all.

**`/search/multi` cannot be captured.** Arbitrary input, no finite file set. Search stays
corpus-backed offline even after a full capture, so captured rows and offline search
results can legitimately disagree.

## Attribution

This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise
approved by TMDB. No TMDB content is redistributed in this directory — see the provenance
note above.
