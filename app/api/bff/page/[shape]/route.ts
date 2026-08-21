import { NextResponse, type NextRequest } from "next/server";
import { getPage, isPageShape } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { cacheHeaders, serverTiming } from "@/lib/bff/cache/headers";
import { BffFatal } from "@/lib/bff/types";

/**
 * The REST BFF endpoint.
 *
 * The pages themselves call `getPage()` directly — they are server components, so an HTTP
 * hop to our own process would be pure overhead. This route exists for three other reasons,
 * all of which are load-bearing later:
 *
 *  1. The naive `rowsClientSide` browse variant fetches from here, which is what makes the
 *     "1 request vs 9" waterfall comparison (lesson L2.2) a real measurement rather than a
 *     diagram.
 *  2. Phase 7's GraphQL shim is compared against exactly this payload, byte for byte, by the
 *     replay differ.
 *  3. It is where cache headers and `Server-Timing` are actually exercised.
 */

// No `export const dynamic` here: under `cacheComponents: true` the route segment config
// is rejected outright. Handlers are dynamic unless they opt into `'use cache'`, and this
// one reads cookies through `requestContext()`, so it could never be cached anyway.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shape: string }> },
) {
  const { shape } = await params;

  if (!isPageShape(shape)) {
    return NextResponse.json(
      { error: "unknown_shape", shape },
      { status: 404, headers: { "cache-control": "public, max-age=3600" } },
    );
  }

  const url = request.nextUrl;
  const ctx = await requestContext({
    query: url.searchParams.get("q") ?? undefined,
    genreId: url.searchParams.get("genreId") ?? undefined,
    titleId: url.searchParams.get("titleId") ?? undefined,
  });

  try {
    const payload = await getPage(shape, ctx);
    const headers = cacheHeaders(shape, payload.meta.degradations);
    const timing = serverTiming(payload.meta.timings);
    if (timing) headers.set("server-timing", timing);

    return NextResponse.json(payload, { headers });
  } catch (error) {
    // A `fail-fast` dependency. Netflix's framing: return the error rather than a
    // half-truth, both to tell the client something real and to stop piling load onto an
    // already-degraded dependency.
    if (error instanceof BffFatal) {
      return NextResponse.json(
        { error: "dependency_failed", dep: error.dep, reason: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } },
      );
    }
    throw error;
  }
}
