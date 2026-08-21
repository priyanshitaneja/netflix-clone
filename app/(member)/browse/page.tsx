import { Suspense } from "react";
import type { Metadata } from "next";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { Billboard } from "@/components/server/Billboard";
import { Row } from "@/components/server/Row";
import { TopNav } from "@/components/server/TopNav";
import { ClientRows } from "@/components/client/ClientRows";
import styles from "../member.module.css";

export const metadata: Metadata = { title: "Home" };

/**
 * The personalized row homepage.
 *
 * One `getPage("browse")` call assembles the whole page server-side: eight dependencies fan
 * out concurrently and come back as one page-shaped payload. From the browser's point of view
 * that is **one request** for the entire page.
 *
 * `?rows=client` renders the same page the wrong way — one request per row, issued from the
 * browser — so lesson L2.2 can compare real waterfalls. The comparison is the whole reason
 * both code paths exist:
 *
 *     /browse               1 document request,  8 dependencies resolved server-side
 *     /browse?rows=client   1 document + 8 XHRs, 8 dependencies resolved per-browser
 *
 * Source: "Embracing the Differences: Inside the Netflix API Redesign" (Daniel Jacobson,
 * 9 Jul 2012). Netflix moved from a One-Size-Fits-All REST API to per-UI custom endpoints
 * whose server-side adapters "explode that request into many requests", and reported latency
 * improvements "in some cases by several seconds" across 800+ device types.
 */
export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <>
      <TopNav currentPath="/browse" />
      {/*
        searchParams is request data, so under cacheComponents it has to sit behind a
        Suspense boundary or the route cannot be prerendered at all. Everything above this
        line is static shell; the page body streams.
      */}
      <Suspense fallback={<BrowseSkeleton />}>
        <BrowseBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BrowseBody({ searchParams }: { searchParams: PageProps<"/browse">["searchParams"] }) {
  const params = await searchParams;

  if (params.rows === "client") {
    return <ClientRows />;
  }

  const ctx = await requestContext();
  const page = await getPage("browse", ctx);

  return (
    <>
      {page.billboard ? <Billboard title={page.billboard} /> : null}

      {page.meta.source === "fixture" ? (
        <p className={styles.notice}>
          Running on committed fixtures — no <code>TMDB_API_KEY</code> is set. Every row,
          resilience path and measurement below works identically with live data; copy{" "}
          <code>.env.example</code> to <code>.env.local</code> to switch.
        </p>
      ) : null}

      {page.meta.degradations.length > 0 ? (
        <p className={styles.notice}>
          {page.meta.degradations.length} dependency
          {page.meta.degradations.length === 1 ? "" : " calls"} degraded on this render. The page
          still rendered — that is what the fallback modes are for.
        </p>
      ) : null}

      <div className={styles.rows}>
        {page.rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </div>
    </>
  );
}

/**
 * Streaming fallback. Three rows, because that is roughly what fits above the fold — a
 * skeleton taller than the viewport costs layout work nobody sees.
 */
function BrowseSkeleton() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className={styles.skeletonRow} key={i}>
          <div className={styles.skeletonHeading} />
          <div className={styles.skeletonRail}>
            {Array.from({ length: 8 }, (_, j) => (
              <div className={styles.skeletonCard} key={j} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
