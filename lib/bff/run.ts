import "server-only";

import { whenAborted } from "./abort";
import { applyFaults } from "./faults";
import { BffFatal, type Degradation, type FaultSpec } from "./types";

/**
 * Phase 2's dependency runner. Deliberately naive.
 *
 * It does three things: time the call, apply a timeout, and turn a failure into either a
 * dropped row (`fail-silent`) or a dead page (`fail-fast`). Those two modes are from
 * "Making the Netflix API More Resilient" (Ben Schmaus, 8 Dec 2011); the third, a custom
 * fallback built from cheaper data, arrives in Phase 4 along with the circuit breaker,
 * per-dependency bulkheads and request collapsing.
 *
 * The naivety is the point. Phase 4's lessons measure what resilience buys — page success
 * rate under injected failure, p99 of a healthy dependency while a sick one hangs — and
 * those are deltas against *this*. Do not add a breaker here.
 *
 * `execute()` in lib/bff/resilience/command.ts will replace this with the same call
 * signature, so Phase 4 is a swap rather than a rewrite.
 */

export interface DepResult<T> {
  value: T;
  degradation: Degradation;
  ms: number;
}

export type Fallback<T> =
  | { mode: "fail-silent"; empty: T }
  | { mode: "fail-fast"; status: number };

export async function runDep<T>(
  name: string,
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>,
  fallback: Fallback<T>,
  /**
   * Faults targeting this dependency, from `ctx.faults`. Applied before the real call, so
   * an injected 429 is indistinguishable from TMDB's own — same code path, same fallback,
   * same degradation record. Defaults to none, which is every production request.
   */
  faults: FaultSpec[] = [],
): Promise<DepResult<T>> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DepTimeout(name, timeoutMs)), timeoutMs);

  try {
    await applyFaults(name, faults, controller.signal);

    /**
     * The timeout is enforced here rather than left to the runnable.
     *
     * Passing an `AbortSignal` and awaiting the result only produces a timeout for a
     * runnable that honours the signal. `fetch` does; `readFile` does not — so the whole
     * fixture path, which is how this app runs with no API key, had no enforceable timeout
     * at all, and any future dependency that is not fetch-backed would have blown straight
     * through the page deadline. Racing the abort makes the budget real for every runnable,
     * while the signal still lets cooperative ones cancel their work and release the socket.
     */
    const attempt = run(controller.signal);
    // If the timeout wins the race, a later rejection from the runnable itself has nobody
    // waiting on it. Node treats that as an unhandled rejection, which is fatal by default.
    attempt.catch(() => {});

    const value = await Promise.race([attempt, whenAborted(controller.signal)]);
    return { value, degradation: { mode: "ok" }, ms: performance.now() - started };
  } catch (error) {
    const reason = describe(error);

    if (fallback.mode === "fail-fast") {
      throw new BffFatal(name, fallback.status, reason);
    }

    return {
      value: fallback.empty,
      degradation: { mode: "fail-silent", dep: name, reason },
      ms: performance.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

export class DepTimeout extends Error {
  constructor(dep: string, ms: number) {
    super(`${dep} exceeded ${ms}ms`);
    this.name = "DepTimeout";
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    // AbortController surfaces our DepTimeout as `error.cause` on the AbortError.
    if (error.name === "AbortError" && error.cause instanceof Error) return error.cause.message;
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

/**
 * Runs dependencies concurrently and collects their timings.
 *
 * "Optimizing the Netflix API" (Ben Christensen, 15 Jan 2013) is the source for why this
 * matters: a REST call "returns only a portion of functionality for a given user
 * experience, requiring client applications to make multiple calls", and the fix is to
 * compose those calls concurrently server-side. The measurable claim is that page latency
 * should approach the *slowest* dependency, not the *sum* of them — which is exactly what
 * lesson L2.3 asserts.
 */
export async function runAll<T extends Record<string, Promise<DepResult<unknown>>>>(
  deps: T,
): Promise<{
  results: { [K in keyof T]: Awaited<T[K]> };
  timings: Record<string, number>;
  degradations: Degradation[];
}> {
  const keys = Object.keys(deps) as (keyof T & string)[];
  const settled = await Promise.all(keys.map((k) => deps[k]!));

  const results = {} as { [K in keyof T]: Awaited<T[K]> };
  const timings: Record<string, number> = {};
  const degradations: Degradation[] = [];

  keys.forEach((key, i) => {
    const result = settled[i]! as Awaited<T[keyof T]>;
    results[key] = result as never;
    timings[key] = Math.round(result.ms * 10) / 10;
    if (result.degradation.mode !== "ok") degradations.push(result.degradation);
  });

  return { results, timings, degradations };
}
