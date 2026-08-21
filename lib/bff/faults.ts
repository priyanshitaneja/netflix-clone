import "server-only";

import { delayOrAbort, whenAborted } from "./abort";
import type { FaultSpec } from "./types";

/**
 * The fault injector: the thing that makes a dependency misbehave on purpose.
 *
 * Without this, Phase 2's central claim is untestable. Every dependency here is wrapped in
 * a fallback mode, but a fallback that never runs is a fallback nobody has seen work — and
 * the degraded-response cache rule in `cache/headers.ts` could not be exercised at all,
 * because no code path could produce a non-`ok` degradation.
 *
 * Two deliberate choices, both worth stating.
 *
 * **First: it is always compiled.** Not a test double, not behind a build flag. msw
 * intercepts in-process, so it cannot reach a separately spawned `next start`; a
 * test-only mock therefore could not make a dependency fail during an E2E run or a
 * hand-driven browser session. Gating is at the parse boundary in `context.ts`
 * (`NODE_ENV !== 'production' || ALLOW_FAULTS`), so production requests carry no faults
 * however hostile the header.
 *
 * **Second: faults are applied at the dependency boundary, not inside the fixture
 * fetcher.** The plan's fixture section put them in `fixtureFetcher` so 429s and timeouts
 * would be reproducible with zero network. Same outcome, better placement: here the
 * injector is transport-agnostic, so `x-nfc-faults: tmdb.trending=status:429` behaves
 * identically against fixtures and against live TMDB, and it sits at exactly the point
 * where Phase 4's `execute()` will apply it — above the fetcher, below the fallback. A
 * fault injected below the breaker would be invisible to the breaker, which would make
 * lesson L2.6's time-to-open unmeasurable.
 *
 * `OURS`. The four chaos principles this serves — hypothesise about steady state, vary
 * real-world events, run in production, automate continuously — are from "Chaos
 * Engineering Upgraded" (Basiri, Hochstein, Thosar, Rosenthal). The header grammar and
 * everything below are our own: ChAP's implementation is not described in that article, so
 * nothing here may be attributed to Netflix's internal tooling.
 */

/** Thrown when an injected fault stands in for an upstream HTTP error. */
export class InjectedStatus extends Error {
  constructor(
    readonly dep: string,
    readonly status: number,
  ) {
    super(`injected status ${status} for ${dep}`);
    this.name = "InjectedStatus";
  }
}

/** Thrown when an injected fault stands in for a transport-level failure. */
export class InjectedError extends Error {
  constructor(
    readonly dep: string,
    kind: string,
  ) {
    super(`injected ${kind} for ${dep}`);
    this.name = "InjectedError";
  }
}

/**
 * Does a fault target this dependency?
 *
 * Exact name, or a trailing `*` as a prefix wildcard: `tmdb.*` hits every TMDB dependency,
 * `tmdb.genre.*` hits only the genre rows, `tmdb.genre.28` hits exactly one. The wildcard
 * is what makes the availability-math lesson (L2.1) expressible as a single header —
 * "every dependency fails 1% of the time" is one clause, not eight.
 */
export function faultMatches(target: string, dep: string): boolean {
  if (target === dep) return true;
  if (!target.endsWith("*")) return false;
  return dep.startsWith(target.slice(0, -1));
}

export function faultsFor(dep: string, faults: FaultSpec[]): FaultSpec[] {
  return faults.filter((f) => faultMatches(f.target, dep));
}

/**
 * Applies every fault targeting `dep`, before the real call is made.
 *
 * Order is fixed rather than header order, so the same header always produces the same
 * behaviour: latency first (it can turn any other outcome into a timeout), then the
 * failure kinds. Reproducibility is not a nicety here — a fault sequence that varies with
 * clause order would make every number measured under it unrepeatable.
 *
 * Returns normally when no fault applies, which is the overwhelmingly common case: one
 * `Array.prototype.filter` over an empty array per dependency.
 */
export async function applyFaults(
  dep: string,
  faults: FaultSpec[],
  signal: AbortSignal,
): Promise<void> {
  if (faults.length === 0) return;
  const matched = faultsFor(dep, faults);
  if (matched.length === 0) return;

  for (const fault of matched) {
    if (fault.kind === "latency") await delayOrAbort(Number(fault.value), signal);
  }

  for (const fault of matched) {
    switch (fault.kind) {
      case "status":
        throw new InjectedStatus(dep, Number(fault.value));
      case "error":
        throw new InjectedError(dep, String(fault.value));
      case "drop":
        // Never resolves. The dependency's own timeout is the only way out — which is the
        // point: this is the shape of failure a breaker exists to detect, a dependency
        // that stops answering rather than one that answers with an error.
        await whenAborted(signal);
        break;
      case "prob":
        // Independent per call, so eight dependencies at 1% give the 0.99^8 composite
        // availability that lesson L2.1 computes. Deliberately not seeded: the lesson
        // measures a distribution over 1000 page builds, not one reproducible build.
        if (Math.random() < Number(fault.value)) {
          throw new InjectedError(dep, `prob:${fault.value}`);
        }
        break;
      case "latency":
        break;
    }
  }
}
