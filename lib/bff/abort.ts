import "server-only";

/**
 * Abort plumbing, shared by the dependency runner and the fault injector.
 *
 * Its own module because both `run.ts` and `faults.ts` need it and `run.ts` already imports
 * `faults.ts` — putting it in either one would make the pair circular.
 */

/**
 * Rejects with the abort reason the moment the signal fires, and never resolves.
 *
 * The reason, not a generic `AbortError`: `runDep` aborts with a `DepTimeout` carrying the
 * dependency name and its budget, and that string ends up in the degradation record the
 * page reports. Losing it would turn every timeout into an indistinguishable "aborted".
 */
export function whenAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

/** Resolves after `ms`, or rejects the moment the signal fires — whichever comes first. */
export function delayOrAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
