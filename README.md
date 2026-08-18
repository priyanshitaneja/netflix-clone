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

Phase 0 of 10 — scaffold and guardrails. See the build order in the plan.
