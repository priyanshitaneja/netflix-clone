import { NextResponse } from "next/server";
import { fetchRowById } from "@/lib/bff/shapes/browse";
import { requestContext } from "@/lib/bff/context";
import { serverTiming } from "@/lib/bff/cache/headers";

/**
 * ============================================================================
 * THE BAD API, kept deliberately, as the control group.
 * ============================================================================
 *
 * One row per request. This is the One-Size-Fits-All, resource-oriented shape that
 * "Embracing the Differences: Inside the Netflix API Redesign" (Daniel Jacobson, 9 Jul 2012)
 * argues against: it is "convenient for the API provider, not the API consumer", and it
 * forces the client into one round trip per thing it needs.
 *
 * The app never calls this. Only `/browse?rows=client` does, and only so lesson L2.2 can put
 * two real waterfalls side by side — nine requests here against one from
 * `/api/bff/page/browse`. Netflix's fix was a server-side adapter that "explode[s] that
 * request into many requests" and returns one page-shaped payload; measuring the difference
 * requires keeping the thing they replaced.
 *
 * Do not build features on this endpoint.
 */

// No `export const dynamic` here: under `cacheComponents: true` the route segment config
// is rejected outright. Handlers are dynamic unless they opt into `'use cache'`, and this
// one reads cookies through `requestContext()`, so it could never be cached anyway.
export async function GET(_request: Request, { params }: { params: Promise<{ rowId: string }> }) {
  const { rowId } = await params;
  // The control group has to be able to fail too, or the degradation journeys can only be
  // driven through the good architecture — which would make the comparison dishonest.
  const ctx = await requestContext();
  const { row, timings } = await fetchRowById(rowId, ctx.faults);

  if (!row) {
    return NextResponse.json({ error: "unknown_row", rowId }, { status: 404 });
  }

  const headers = new Headers({ "cache-control": "private, no-store" });
  const timing = serverTiming(timings);
  if (timing) headers.set("server-timing", timing);

  return NextResponse.json(row, { headers });
}
