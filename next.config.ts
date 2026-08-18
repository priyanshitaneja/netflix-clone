import type { NextConfig } from "next";

/**
 * Phase 0 guardrails.
 *
 * `turbopack.root` and `outputFileTracingRoot` are both pinned to this directory on
 * purpose. The parent directory (`~/Documents/personal`) has its own `package.json`,
 * `package-lock.json` and `node_modules`. Node resolution walks upward, so without these
 * two pins a dependency we forgot to declare could resolve from the parent, work locally,
 * and fail on Vercel. See the plan's risk #13.
 *
 * `cacheComponents` is set now rather than later because it changes prerendering
 * semantics app-wide (it also enables PPR, `use cache`, `cacheLife` and `cacheTag`).
 * Flipping it after Phase 3 would silently invalidate every committed baseline.
 */
const nextConfig: NextConfig = {
  cacheComponents: true,

  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },

  images: {
    // image.tmdb.org needs no API key and is CORS-open. Verified: returns
    // access-control-allow-origin: * and cache-control: public, max-age=31919000.
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },

  // Note: there is no `eslint` key in Next 16's NextConfig — it was removed along with
  // `next lint`. Linting is a separate CI step (`npm run lint`), which is what we want
  // anyway: a lint failure and a build failure should not be the same signal.
};

export default nextConfig;
