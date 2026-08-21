import "server-only";

import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocaleCode } from "@/lib/i18n";
import type { FaultSpec, RequestContext } from "./types";

/**
 * Builds a `RequestContext` from the incoming request.
 *
 * Kept separate from `getPage` so the BFF stays a pure function of its inputs: a test can
 * construct a context literal and never touch `next/headers`. Everything request-shaped is
 * read here and only here.
 */

export const PROFILE_COOKIE = "nfc_profile";
export const MY_LIST_COOKIE = "nfc_mylist";
export const DEFAULT_DEADLINE_MS = 2_500;

/**
 * Fault injection, parsed from `x-nfc-faults`.
 *
 * A first-class, always-compiled capability rather than a test-only mock — which is both the
 * honest engineering answer and the more Netflix-shaped one. msw can only intercept
 * in-process, so it cannot reach a separately spawned `next start`; without this header there
 * would be no way to make a dependency fail during an E2E run.
 *
 * Grammar:
 *   x-nfc-faults: tmdb.trending=status:429; tmdb.genre.28=latency:5000;
 *                 tmdb.detail=error:econnreset; tmdb.search=drop; tmdb.*=prob:0.01
 *
 * Gated: ignored in production unless ALLOW_FAULTS is set. The four chaos principles this
 * serves — hypothesise about steady state, vary real-world events, run in production,
 * automate continuously — are from "Chaos Engineering Upgraded" (Basiri, Hochstein, Thosar,
 * Rosenthal). The *implementation* is ours: ChAP is not described in that article, so nothing
 * here may be attributed to Netflix's internal tooling (ledger note in Phase 4).
 */
export function parseFaults(header: string | null): FaultSpec[] {
  if (!header) return [];
  const allowed = process.env.NODE_ENV !== "production" || process.env.ALLOW_FAULTS === "1";
  if (!allowed) return [];

  return header
    .split(";")
    .map((clause) => clause.trim())
    .filter(Boolean)
    .flatMap((clause): FaultSpec[] => {
      const [target, spec] = clause.split("=", 2);
      if (!target || !spec) return [];
      const [kind, rawValue] = spec.split(":", 2);

      switch (kind) {
        case "status":
        case "latency":
          return Number.isFinite(Number(rawValue))
            ? [{ target: target.trim(), kind, value: Number(rawValue) }]
            : [];
        case "prob":
          return Number.isFinite(Number(rawValue))
            ? [{ target: target.trim(), kind, value: Number(rawValue) }]
            : [];
        case "error":
          return [{ target: target.trim(), kind, value: rawValue ?? "unknown" }];
        case "drop":
          return [{ target: target.trim(), kind: "drop", value: "" }];
        default:
          return [];
      }
    });
}

export function parseMyList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^(movie|tv)-\d+$/.test(id))
    .slice(0, 100);
}

export async function requestContext(
  overrides: Partial<RequestContext> = {},
): Promise<RequestContext> {
  const [jar, hdrs] = await Promise.all([cookies(), headers()]);

  const localeCookie = jar.get("nfc_locale")?.value ?? "";
  const locale = isLocaleCode(localeCookie) ? localeCookie : DEFAULT_LOCALE;

  return {
    // An absent profile is an anonymous browse, not an error. The signup flow mints a real
    // one; until then everybody shares the same anonymous id, which is honest for a clone
    // with no personalization model behind it.
    profileId: jar.get(PROFILE_COOKIE)?.value ?? "anonymous",
    locale,
    faults: parseFaults(hdrs.get("x-nfc-faults")),
    deadlineMs: DEFAULT_DEADLINE_MS,
    cells: {},
    myList: parseMyList(jar.get(MY_LIST_COOKIE)?.value),
    ...overrides,
  };
}
