import type { Degradation, PageShape } from "../types";

/**
 * Cache-Control per page shape, plus the one rule that matters more than the rest.
 *
 * The personalized row homepage is `private, no-store`: it is keyed to a profile and must
 * never sit in a shared cache. Public, non-personalized shapes get a short `s-maxage` with a
 * long `stale-while-revalidate`, which is the ordinary CDN pattern.
 *
 * **The important line is the degraded-response override.** A payload assembled while a
 * dependency was failing is a snapshot of a bad moment. Cache it for an hour and one blip
 * gets served as though it were the truth, long after the dependency recovered — the
 * failure outlives the failure. So any payload carrying a non-`ok` degradation is
 * explicitly not cacheable, regardless of shape. Lesson L2.7 asserts this.
 *
 * `IND` — Netflix has published no web cache-header policy. What is published is the
 * *architecture* around it: EVCache in front of Cassandra with asynchronous cross-region
 * replication (Madappa et al., 1 Mar 2016), and Zuul at the edge (Gonigberg et al.,
 * 21 May 2018). These specific directives are ours.
 */

const BY_SHAPE: Record<PageShape, string> = {
  // Personalized. A shared cache holding this would serve one member's page to another.
  browse: "private, no-store",
  myList: "private, no-store",
  titleDetail: "public, s-maxage=3600, stale-while-revalidate=86400",
  genre: "public, s-maxage=600, stale-while-revalidate=86400",
  search: "public, s-maxage=60",
};

export function cacheHeaders(shape: PageShape, degradations: Degradation[]): Headers {
  const degraded = degradations.some((d) => d.mode !== "ok");

  const headers = new Headers({
    "cache-control": degraded ? "private, no-store, must-revalidate" : BY_SHAPE[shape],
  });

  // Personalized payloads vary by profile. Without this a CDN keyed only on the URL could
  // serve the wrong profile's page even under `private`, via an intermediary that ignores it.
  if (shape === "browse" || shape === "myList") {
    headers.set("vary", "cookie");
  }

  if (degraded) {
    // Machine-readable degradation summary, so a monitor does not have to parse the body.
    headers.set("x-nfc-degraded", degradations.map((d) => d.mode).join(","));
  }

  return headers;
}

/**
 * `Server-Timing` from the per-dependency timings.
 *
 * Free observability: browser devtools renders these in the network panel, so the BFF's
 * fan-out is visible with no custom UI. It is also how lesson L2.3's claim — that page
 * latency approaches the slowest dependency rather than the sum — becomes something you can
 * see rather than something you are told.
 */
export function serverTiming(timings: Record<string, number>): string {
  return Object.entries(timings)
    .map(([name, ms]) => `${name.replace(/[^\w.-]/g, "_")};dur=${ms}`)
    .join(", ");
}
