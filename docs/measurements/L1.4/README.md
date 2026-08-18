# L1.4 baseline — "Delete the client framework from pages that do not need it"

`baseline.json` is the **before** for lesson L1.4, measured on this machine at the end of
Phase 1. It is immutable: the lesson's whole claim is a delta, and a delta needs an
untouched before.

Source of the claim: **A Netflix Web Performance Case Study**, Addy Osmani, 5 November
2018, Google Dev Channel — <https://medium.com/dev-channel/a-netflix-web-performance-case-study-c0bcde26a9d9>
(`NF-3P`: Netflix's work, described by a Google engineer; Netflix never published this
themselves). Netflix reported **200 kB of JS removed from a 300 kB payload** and
**loading + time-to-interactive down 50%** on their logged-out desktop landing page, after
keeping React on the server and rewriting the tabs, language switcher and cookie banner in
vanilla JS.

## Measured

| Route | Client components | JS files | gzip | brotli |
|---|---|---|---|---|
| `/` | whole page is one client tree | 7 | **171.8 kB** | 148.2 kB |
| `/signup` | none (server action only) | 6 | **168.9 kB** | 145.8 kB |

## What this immediately tells us, before writing a line of the lesson

**The framework floor is 168.9 kB gzip.** A route with zero client components still ships
react-dom (69.8), the Next framework chunk (47.3), polyfills (38.5) and the Turbopack
runtime plus small chunks (13.1). That is not application code and no amount of care
removes it from inside the App Router.

So the naive landing page — four tabs, a four-item FAQ accordion, a language switcher, a
cookie banner and client-side email validation, all as React client components — costs
**2.9 kB gzip above the floor**.

That number reframes the lesson. Had we defined L1.4 as "app JS above the floor", the
honest headline would have been *−2.9 kB*, against Netflix's −200 kB — a true measurement
of an almost irrelevant quantity. The interesting delta is not the application code, it is
the **runtime itself**, which is exactly what Netflix removed.

Phase 5 therefore rebuilds `/` to ship no Next client runtime at all: server-rendered
markup plus three small vanilla-JS islands, which is the architecture Osmani actually
describes. Expected after ≈ 4 kB, giving ≈ −168 kB / −98%.

**Do not read that −98% as beating Netflix.** Their 300 kB was a 2018 SPA bundle including
application code and a jQuery-era dependency tree; our 169 kB is a 2026 framework floor
with a hello-world app on top. The two numbers measure different things, and the lesson
says so. The comparable claim is directional only: *removing the client framework from a
page that does not need it is the single largest JS win available on that page* — which
both measurements support.

## Reproducing

```bash
git checkout lesson/L1.4/before
npm ci && npm run build
node scripts/route-js.mjs
```

Caveat on the harness: `scripts/route-js.mjs` reads the `<script>` tags out of the HTML
Next emitted for each **prerendered** route, because Next 16 removed bundle-size metrics
from `next build` and Turbopack emits no `app-build-manifest.json`. It cannot see dynamic
routes; those are measured from real network records in Phase 3.
