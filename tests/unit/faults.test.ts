import { describe, expect, it, vi } from "vitest";
import { applyFaults, faultMatches, InjectedError, InjectedStatus } from "@/lib/bff/faults";
import { parseFaults } from "@/lib/bff/context";
import { runDep } from "@/lib/bff/run";
import { BffFatal, type FaultSpec, type TitleSummary } from "@/lib/bff/types";

/**
 * The fault injector, asserted.
 *
 * This file matters more than its size suggests. Every fallback in the BFF is unreachable
 * without the injector, so a broken injector does not fail loudly — it makes the whole
 * resilience curriculum silently untestable, and every "the page survived" claim
 * unfalsifiable. It has already failed once in exactly that way: `ctx.faults` was parsed
 * and then never passed to a single dependency, so no code path in the repo could produce
 * a non-`ok` degradation. Nothing broke, which is the problem.
 */

const never = () => new Promise<never>(() => {});
const ok = async () => "value";

const SAMPLE: TitleSummary = {
  id: "movie-101",
  mediaType: "movie",
  name: "The Cartographer's Daughter",
  artwork: { poster: "/api/placeholder/movie-101", backdrop: null, isPlaceholder: true },
  matchScore: 84,
  year: 2024,
  maturity: null,
};
const okRow = async (): Promise<TitleSummary[]> => [SAMPLE];

describe("x-nfc-faults parsing", () => {
  it("parses each kind, and ignores clauses it cannot understand", () => {
    expect(
      parseFaults(
        "tmdb.trending=status:429; tmdb.genre.28=latency:5000; tmdb.detail=error:econnreset; " +
          "tmdb.search=drop; tmdb.*=prob:0.01; nonsense; also=bad:thing; =status:500",
      ),
    ).toEqual([
      { target: "tmdb.trending", kind: "status", value: 429 },
      { target: "tmdb.genre.28", kind: "latency", value: 5000 },
      { target: "tmdb.detail", kind: "error", value: "econnreset" },
      { target: "tmdb.search", kind: "drop", value: "" },
      { target: "tmdb.*", kind: "prob", value: 0.01 },
    ]);
  });

  it("treats an absent header as no faults", () => {
    expect(parseFaults(null)).toEqual([]);
    expect(parseFaults("")).toEqual([]);
  });

  it("rejects a non-numeric status rather than injecting NaN", () => {
    expect(parseFaults("tmdb.trending=status:teapot")).toEqual([]);
  });

  it("ignores the header entirely in production unless ALLOW_FAULTS is set", () => {
    // The injector is always compiled — that is what lets it work under a spawned
    // `next start`, which msw cannot reach. The gate is here, at the parse boundary, so a
    // production request carries no faults however hostile the header.
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_FAULTS", undefined);
    expect(parseFaults("tmdb.*=drop")).toEqual([]);

    vi.stubEnv("ALLOW_FAULTS", "1");
    expect(parseFaults("tmdb.*=drop")).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});

describe("fault targeting", () => {
  it("matches an exact dependency name", () => {
    expect(faultMatches("tmdb.trending", "tmdb.trending")).toBe(true);
    expect(faultMatches("tmdb.trending", "tmdb.topRatedMovies")).toBe(false);
  });

  it("treats a trailing star as a prefix wildcard", () => {
    expect(faultMatches("tmdb.*", "tmdb.genre.28")).toBe(true);
    expect(faultMatches("tmdb.genre.*", "tmdb.genre.28")).toBe(true);
    expect(faultMatches("tmdb.genre.*", "tmdb.trending")).toBe(false);
  });

  it("does not match a different dependency that merely shares a prefix", () => {
    // Without the wildcard, `tmdb.genre` must not reach `tmdb.genres` — one is five rows
    // of a page, the other is the genre-name lookup.
    expect(faultMatches("tmdb.genre", "tmdb.genres")).toBe(false);
  });
});

describe("fault application", () => {
  const signal = () => new AbortController().signal;

  it("does nothing when no fault targets the dependency", async () => {
    await expect(
      applyFaults("tmdb.trending", [{ target: "tmdb.search", kind: "drop", value: "" }], signal()),
    ).resolves.toBeUndefined();
  });

  it("throws the injected status", async () => {
    const faults: FaultSpec[] = [{ target: "tmdb.trending", kind: "status", value: 429 }];
    await expect(applyFaults("tmdb.trending", faults, signal())).rejects.toBeInstanceOf(
      InjectedStatus,
    );
  });

  it("throws the injected transport error", async () => {
    const faults: FaultSpec[] = [
      { target: "tmdb.trending", kind: "error", value: "econnreset" },
    ];
    await expect(applyFaults("tmdb.trending", faults, signal())).rejects.toBeInstanceOf(
      InjectedError,
    );
  });

  it("fires prob:1 always and prob:0 never", async () => {
    await expect(
      applyFaults("tmdb.trending", [{ target: "tmdb.*", kind: "prob", value: 1 }], signal()),
    ).rejects.toBeInstanceOf(InjectedError);
    await expect(
      applyFaults("tmdb.trending", [{ target: "tmdb.*", kind: "prob", value: 0 }], signal()),
    ).resolves.toBeUndefined();
  });
});

describe("runDep under injected faults", () => {
  it("drops the row rather than the page when the dependency is fail-silent", async () => {
    const result = await runDep(
      "tmdb.trending",
      50,
      okRow,
      { mode: "fail-silent", empty: [] as TitleSummary[] },
      [{ target: "tmdb.trending", kind: "status", value: 429 }],
    );

    // The row the dependency *would* have returned, replaced by the fallback's empty one.
    expect(result.value).toEqual([]);
    expect(result.degradation).toMatchObject({ mode: "fail-silent", dep: "tmdb.trending" });
    expect(result.degradation).toHaveProperty("reason", expect.stringContaining("429"));
  });

  it("throws BffFatal when the dependency is fail-fast", async () => {
    await expect(
      runDep("tmdb.movieDetail", 50, ok, { mode: "fail-fast", status: 502 }, [
        { target: "tmdb.movieDetail", kind: "status", value: 500 },
      ]),
    ).rejects.toBeInstanceOf(BffFatal);
  });

  it("turns a dropped dependency into a timeout, not a hang", async () => {
    // `drop` never resolves. The dependency's own timeout is the only way out, which is
    // exactly the shape of the failure Netflix's 10s-window breaker exists to detect: not
    // an error response, but a dependency that simply stops answering.
    const started = performance.now();
    const result = await runDep(
      "tmdb.search",
      60,
      never,
      { mode: "fail-silent", empty: null },
      [{ target: "tmdb.search", kind: "drop", value: "" }],
    );

    expect(result.degradation).toMatchObject({ mode: "fail-silent" });
    expect(result.degradation).toHaveProperty("reason", expect.stringContaining("exceeded 60ms"));
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("lets injected latency exceed the timeout", async () => {
    const result = await runDep("tmdb.popularTv", 40, ok, { mode: "fail-silent", empty: null }, [
      { target: "tmdb.popularTv", kind: "latency", value: 5_000 },
    ]);
    expect(result.degradation).toMatchObject({ mode: "fail-silent" });
  });

  it("leaves a healthy dependency alone", async () => {
    const result = await runDep("tmdb.trending", 100, ok, { mode: "fail-silent", empty: null }, []);
    expect(result.value).toBe("value");
    expect(result.degradation).toEqual({ mode: "ok" });
  });

  it("still applies the timeout with no faults at all", async () => {
    const result = await runDep("tmdb.trending", 40, never, {
      mode: "fail-silent",
      empty: null,
    });
    expect(result.degradation).toMatchObject({ mode: "fail-silent" });
  });
});
