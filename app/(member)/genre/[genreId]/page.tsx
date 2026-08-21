import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { BffFatal } from "@/lib/bff/types";
import { Row } from "@/components/server/Row";
import { TopNav } from "@/components/server/TopNav";
import styles from "../../member.module.css";

/**
 * A single-genre browse page.
 *
 * Its own BFF shape rather than `browse` with a filter, for the reason Jacobson's 2012 article
 * gives: an endpoint should be shaped like the page that consumes it. This page needs one
 * genre's titles plus the genre list for navigation — not eight rows — so it asks for exactly
 * that and nothing more.
 */
export default async function GenrePage({ params }: PageProps<"/genre/[genreId]">) {
  return (
    <>
      <TopNav />
      <Suspense fallback={<GenreSkeleton />}>
        <GenreBody params={params} />
      </Suspense>
    </>
  );
}

async function GenreBody({ params }: { params: PageProps<"/genre/[genreId]">["params"] }) {
  const { genreId } = await params;
  const ctx = await requestContext({ genreId });

  let page;
  try {
    page = await getPage("genre", ctx);
  } catch (error) {
    if (error instanceof BffFatal && error.status === 404) notFound();
    throw error;
  }

  const row = page.rows[0];
  if (!row) notFound();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{row.title}</h1>
      <p className={styles.lede}>
        {row.items.length} title{row.items.length === 1 ? "" : "s"}, ranked by popularity.
      </p>
      <Row row={row} />
    </div>
  );
}

function GenreSkeleton() {
  return (
    <div className={styles.page} aria-hidden="true">
      <div className={styles.skeletonRow}>
        <div className={styles.skeletonHeading} />
        <div className={styles.skeletonRail}>
          {Array.from({ length: 8 }, (_, i) => (
            <div className={styles.skeletonCard} key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
