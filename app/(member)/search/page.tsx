import { Suspense } from "react";
import type { Metadata } from "next";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { Row } from "@/components/server/Row";
import { TopNav } from "@/components/server/TopNav";
import styles from "../member.module.css";

export const metadata: Metadata = { title: "Search" };

/**
 * Search results.
 *
 * Worth noticing what this page does *not* do: there is no client-side result state, no
 * loading spinner tied to keystrokes, no fetch in a `useEffect`. `SearchBox` navigates, and the
 * server renders the answer. The only client JavaScript involved is the input itself.
 *
 * The distinction the empty state has to make honestly is between "no results" and "search
 * failed", because they look identical to a user and conflating them is how you end up
 * unable to tell a broken dependency from an unpopular query.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <TopNav />
      <Suspense fallback={<div className={styles.page} aria-hidden="true" />}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function SearchBody({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";

  const ctx = await requestContext({ query });
  const page = await getPage("search", ctx);

  const row = page.rows[0];
  const failed = page.meta.degradations.some((d) => d.mode !== "ok");

  return (
    <div className={styles.page}>
      {query.trim().length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Search the catalog</p>
          <p className={styles.lede}>
            Try a title, or a word from a synopsis — the fixture corpus is small enough that
            &ldquo;coast&rdquo; or &ldquo;ice&rdquo; will find something.
          </p>
        </div>
      ) : failed ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Search is unavailable</p>
          <p className={styles.lede}>
            The search dependency failed, so this is not &ldquo;no results&rdquo; — it is no
            answer. Those are different facts and the page will not pretend otherwise.
          </p>
        </div>
      ) : !row ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No titles match &ldquo;{query}&rdquo;</p>
          <p className={styles.lede}>Search worked; the catalog simply has nothing for it.</p>
        </div>
      ) : (
        <Row row={row} />
      )}
    </div>
  );
}
