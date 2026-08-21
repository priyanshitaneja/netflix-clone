import { describe, expect, it } from "vitest";
import { cacheHeaders, serverTiming } from "@/lib/bff/cache/headers";
import type { Degradation, PageShape } from "@/lib/bff/types";

/**
 * Cache headers, and one rule that matters more than the rest.
 *
 * A payload assembled while a dependency was failing is a snapshot of a bad moment. Cache
 * it for an hour and one blip is served as truth long after the dependency recovered — the
 * failure outlives the failure. The override that prevents that is a single boolean, which
 * is exactly the kind of line that gets refactored away by someone tidying a switch
 * statement. So it is asserted for every shape, not just the one it was written for.
 */

const SHAPES: PageShape[] = ["browse", "titleDetail", "genre", "search", "myList"];
const failSilent: Degradation = { mode: "fail-silent", dep: "tmdb.trending", reason: "429" };

describe("cache headers by shape", () => {
  it("never lets a personalized shape into a shared cache", () => {
    for (const shape of ["browse", "myList"] as const) {
      const cc = cacheHeaders(shape, []).get("cache-control")!;
      expect(cc).toContain("private");
      expect(cc).toContain("no-store");
      expect(cc).not.toContain("s-maxage");
    }
  });

  it("varies personalized shapes on the cookie that identifies the profile", () => {
    expect(cacheHeaders("browse", []).get("vary")).toBe("cookie");
    expect(cacheHeaders("titleDetail", []).get("vary")).toBeNull();
  });

  it("gives public shapes a shared-cache lifetime", () => {
    expect(cacheHeaders("titleDetail", []).get("cache-control")).toContain("s-maxage=3600");
    expect(cacheHeaders("genre", []).get("cache-control")).toContain("s-maxage=600");
    expect(cacheHeaders("search", []).get("cache-control")).toContain("s-maxage=60");
  });
});

describe("the degraded-response override", () => {
  it("makes a degraded payload uncacheable for every shape, whatever its normal policy", () => {
    for (const shape of SHAPES) {
      const cc = cacheHeaders(shape, [failSilent]).get("cache-control")!;
      expect(cc, shape).toContain("no-store");
      expect(cc, shape).not.toContain("s-maxage");
      expect(cc, shape).not.toContain("stale-while-revalidate");
    }
  });

  it("overrides the longest-lived policy in the table", () => {
    // titleDetail is the most aggressively cached shape, so it is the one that would do the
    // most damage if the override were ever dropped.
    expect(cacheHeaders("titleDetail", []).get("cache-control")).toContain("s-maxage=3600");
    expect(cacheHeaders("titleDetail", [failSilent]).get("cache-control")).not.toContain("maxage");
  });

  it("announces the degradation in a header, so a monitor need not parse the body", () => {
    const headers = cacheHeaders("browse", [failSilent, { mode: "fail-fast", dep: "x", reason: "y", status: 502 }]);
    expect(headers.get("x-nfc-degraded")).toBe("fail-silent,fail-fast");
  });

  it("says nothing when nothing degraded", () => {
    expect(cacheHeaders("browse", []).get("x-nfc-degraded")).toBeNull();
  });

  it("treats an explicit ok as not degraded", () => {
    // `meta.degradations` only ever collects non-ok entries, but a caller reading
    // `row.degraded` straight off a payload could hand us an `ok` — and an `ok` that
    // suppressed caching would quietly cost every cache hit on the site.
    expect(cacheHeaders("titleDetail", [{ mode: "ok" }]).get("cache-control")).toContain(
      "s-maxage=3600",
    );
  });
});

describe("Server-Timing", () => {
  it("emits one metric per dependency, so the fan-out is visible in devtools", () => {
    expect(serverTiming({ "tmdb.trending": 42.5, "tmdb.genre.28": 7 })).toBe(
      "tmdb.trending;dur=42.5, tmdb.genre.28;dur=7",
    );
  });

  it("sanitises names that would break the header grammar", () => {
    expect(serverTiming({ 'bad name";drop': 1 })).toBe("bad_name__drop;dur=1");
  });

  it("is empty when there were no dependencies to time", () => {
    expect(serverTiming({})).toBe("");
  });
});
