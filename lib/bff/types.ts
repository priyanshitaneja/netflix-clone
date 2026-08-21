/**
 * The contract shared by the REST BFF, the GraphQL shim (Phase 7), both subgraphs
 * (Phase 8) and the replay differ. Changing a type here changes all five, which is the
 * point: one shape, many transports.
 *
 * Design source: "Embracing the Differences: Inside the Netflix API Redesign"
 * (Daniel Jacobson, 9 Jul 2012). Netflix's argument is that a One-Size-Fits-All REST API
 * is "convenient for the API provider, not the API consumer", and that each UI team should
 * get an endpoint shaped like its page — the adapter "explode[s] that request into many
 * requests" server-side and returns one page-shaped payload. `PagePayload` is that idea.
 */

export type PageShape = "browse" | "titleDetail" | "genre" | "search" | "myList";

export type MediaType = "movie" | "tv";

/**
 * How a piece of the page degraded when a dependency misbehaved.
 *
 * The three failure modes are Netflix's, from "Making the Netflix API More Resilient"
 * (Ben Schmaus, 8 Dec 2011): a custom fallback built from cheaper data, failing silently
 * when the data is optional, and failing fast when it is required. The `custom` variant's
 * `source` ranking (cache -> fixture -> stub) is Christensen's published fallback ordering
 * from "Fault Tolerance in a High Volume, Distributed System" (29 Feb 2012), collapsed to
 * what a clone can actually have.
 *
 * Phase 2 only ever produces `ok`, `fail-silent` and `fail-fast`. Phase 4 adds the
 * circuit breaker, bulkheads and the full `custom` ranking. The type is complete now so
 * Phase 4 is additive rather than a refactor.
 */
export type Degradation =
  | { mode: "ok" }
  | { mode: "custom"; dep: string; reason: string; source: "cache" | "fixture" | "stub" }
  | { mode: "fail-silent"; dep: string; reason: string }
  | { mode: "fail-fast"; dep: string; reason: string; status: number };

export interface Artwork {
  /** Absolute URL. Null is impossible by construction — the mapper substitutes a placeholder. */
  poster: string;
  backdrop: string | null;
  /** Set when the artwork is our generated placeholder rather than a real still. */
  isPlaceholder: boolean;
}

export interface TitleSummary {
  id: string;
  mediaType: MediaType;
  name: string;
  artwork: Artwork;
  /** 0-100, rounded. TMDB scores 0-10 with one decimal; we normalise once, here. */
  matchScore: number | null;
  year: number | null;
  maturity: string | null;
}

export interface TitleDetail extends TitleSummary {
  synopsis: string;
  runtimeMinutes: number | null;
  genres: { id: string; name: string }[];
  cast: string[];
  /** Playable stream for the watch page. Open test content; there is no DRM. */
  streams: { dash: string[]; hls: string[] };
  similar: TitleSummary[];
}

/**
 * A row of the personalized homepage.
 *
 * "Personalized row homepage", never "lolomo" — that term appears in no verified Netflix
 * article (ledger H-03). The two-dimensional structure it describes is real and published:
 * "Learning a Personalized Homepage" (Chris Alvino, Justin Basilico, 9 Apr 2015) describes
 * horizontal scroll within a themed row and vertical scroll across rows, built by
 * candidate generation -> filtering -> per-row ranking with row-specific algorithms ->
 * row selection and ordering.
 */
export interface RowPayload {
  id: string;
  title: string;
  algo: "trending" | "topRated" | "genre" | "becauseYouWatched" | "continueWatching" | "myList";
  items: TitleSummary[];
  /** Per-row. A row never throws — that is what makes one dead dependency cost one row. */
  degraded: Degradation;
}

export interface PageMeta {
  generatedAt: string;
  source: "tmdb" | "fixture";
  shape: PageShape;
  /** Echoed so a cached payload can never be served to the wrong profile unnoticed. */
  profileId: string;
  degradations: Degradation[];
  /** Per-dependency milliseconds. Also emitted as a Server-Timing header. */
  timings: Record<string, number>;
  /** Upstream requests saved by the collapser. Always 0 until Phase 4. */
  collapsed: number;
}

export interface PagePayload {
  shape: PageShape;
  billboard: TitleSummary | null;
  rows: RowPayload[];
  /** Only set by the titleDetail shape. */
  detail?: TitleDetail;
  meta: PageMeta;
}

/**
 * Everything a page build needs to know about the request. Passed explicitly rather than
 * read from module-level state so `getPage` stays a pure function of its inputs — which is
 * what makes the integration tests able to call it directly, with no server running.
 */
export interface RequestContext {
  profileId: string;
  locale: string;
  /** Parsed `x-nfc-faults` header. Empty in production unless ALLOW_FAULTS is set. */
  faults: FaultSpec[];
  /** Total budget for the whole page build. */
  deadlineMs: number;
  /** A/B cell assignments, keyed by experiment id. Populated in Phase 9. */
  cells: Record<string, string>;
  /** Saved title ids, read from the profile's cookie. */
  myList: string[];
  query?: string;
  genreId?: string;
  titleId?: string;
}

export interface FaultSpec {
  /** Dependency name or glob, e.g. `tmdb.trending` or `tmdb.*`. */
  target: string;
  kind: "status" | "latency" | "error" | "drop" | "prob";
  value: string | number;
}

/** Thrown by a `fail-fast` dependency. The route handler turns it into an HTTP status. */
export class BffFatal extends Error {
  constructor(
    readonly dep: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BffFatal";
  }
}
