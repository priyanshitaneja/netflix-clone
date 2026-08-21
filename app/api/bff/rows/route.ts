import { NextResponse } from "next/server";
import { ROW_IDS } from "@/lib/bff/shapes/browse";

/**
 * The row manifest for the client-side control group.
 *
 * This is the ninth request in the "1 vs 9" comparison, and it is the most instructive one:
 * before the browser can ask for any row, it has to ask *which rows exist*. The page-shaped
 * endpoint never needs this call, because the server already knows — it just returns the rows.
 *
 * That extra round trip is the discovery cost a resource-oriented API imposes on every client,
 * and it is precisely what Jacobson (9 Jul 2012) means by an API that is convenient for the
 * provider rather than the consumer.
 *
 * Used only by `/browse?rows=client`.
 */
// No `export const dynamic`: `cacheComponents: true` rejects the route segment config.
// This handler reads nothing per-request, so Next may serve it from cache — which is fine.
// It still costs the browser a round trip, and the round trip is the whole point.
export async function GET() {
  return NextResponse.json(ROW_IDS, { headers: { "cache-control": "private, no-store" } });
}
