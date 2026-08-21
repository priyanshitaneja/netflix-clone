import "server-only";

import type { PagePayload, PageShape, RequestContext } from "./types";
import { browseShape } from "./shapes/browse";
import { genreShape } from "./shapes/genre";
import { myListShape } from "./shapes/myList";
import { searchShape } from "./shapes/search";
import { titleDetailShape } from "./shapes/titleDetail";

/**
 * The BFF's entire public surface: one function.
 *
 * Exactly one entry point means exactly one place to instrument, cache, time and — in
 * Phase 7 — put a GraphQL shim in front of. It also means the integration tests call
 * `getPage()` directly as a function, in-process, with msw intercepting upstream HTTP. No
 * server, no ports, no fixtures-of-fixtures. That is why resilience is testable at all.
 *
 * Design source: "Embracing the Differences: Inside the Netflix API Redesign"
 * (Daniel Jacobson, 9 Jul 2012) — each UI gets an endpoint shaped like its page, and the
 * server-side adapter explodes one request into many. Netflix reported latency improvements
 * "in some cases by several seconds" across 800+ device types by collapsing that chattiness.
 */

const SHAPES: Record<PageShape, (ctx: RequestContext) => Promise<PagePayload>> = {
  browse: browseShape,
  titleDetail: titleDetailShape,
  genre: genreShape,
  search: searchShape,
  myList: myListShape,
};

export function isPageShape(value: string): value is PageShape {
  return Object.prototype.hasOwnProperty.call(SHAPES, value);
}

export async function getPage(shape: PageShape, ctx: RequestContext): Promise<PagePayload> {
  return SHAPES[shape](ctx);
}

export type { PagePayload, PageShape, RequestContext };
