# netflix-clone

A Netflix clone built as a teaching vehicle for Netflix's **published** web engineering
practices — scalability, resilience, performance — where every technique traces to a real
article and every claim is measured rather than asserted.

Not a UI pastiche. The curriculum lives in [`docs/`](./docs), every lesson names its
source, and `docs/measurement/ledger.json` holds the before/after numbers measured on this
machine — including the ones where the technique made no measurable difference at our
scale.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

**No API key required.** The app ships committed fixtures shaped exactly like TMDB
responses and runs fully offline. To use live data, copy `.env.example` to `.env.local`
and add a free [TMDB](https://www.themoviedb.org/settings/api) key — the fixture/live
branch exists in exactly one module, so nothing else changes.

## Attribution

This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise
approved by TMDB.

Video assets are open test content (Tears of Steel, Big Buck Bunny) served over DASH and
HLS. There is no DRM: obtaining a Widevine CDM licence requires a commercial agreement, so
this project uses clear streams only.

## Status

**Phase 2 of 10** — fixtures, the REST BFF, and every browse surface, running with no API
key. Deliberately naive: no circuit breaker, no bulkheads, no request collapsing, no
virtualization, no image optimization. Those are Phases 4 and 5, and each one has to prove
itself against a number measured on this tree first.

What works today: `/`, `/signup`, `/profiles`, `/browse`, `/title/[id]`, `/genre/[id]`,
`/search`, `/my-list`, plus the REST BFF at `/api/bff/page/[shape]`.

Two things exist only to be measured against, and nothing links to either:

- **`/browse?rows=client`** assembles the same page the wrong way — one request per row from
  the browser instead of one page-shaped request. Open the network panel on both. That is
  lesson L2.2.
- **`x-nfc-faults`** makes any dependency misbehave, so the fallback modes can be watched
  working rather than taken on trust:

  ```bash
  curl -H 'x-nfc-faults: tmdb.trending=status:429' localhost:3000/api/bff/page/browse
  curl -H 'x-nfc-faults: tmdb.*=drop'              localhost:3000/api/bff/page/browse
  ```

  One dead dependency costs one row, eight cost all eight, and the page still returns 200
  either way. Ignored in production unless `ALLOW_FAULTS=1`.

See the build order in the plan.
