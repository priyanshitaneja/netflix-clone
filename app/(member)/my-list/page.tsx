import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { Row } from "@/components/server/Row";
import { TopNav } from "@/components/server/TopNav";
import styles from "../member.module.css";

export const metadata: Metadata = { title: "My List" };

/**
 * My List.
 *
 * The shape behind this page is a deliberate, documented N+1 — one upstream call per saved
 * title — and it stays that way until Phase 7 measures the DataLoader pattern removing it. See
 * `lib/bff/shapes/myList.ts` for why deleting the N+1 now would delete two lessons.
 */
export default async function MyListPage() {
  return (
    <>
      <TopNav currentPath="/my-list" />
      <Suspense fallback={<div className={styles.page} aria-hidden="true" />}>
        <MyListBody />
      </Suspense>
    </>
  );
}

async function MyListBody() {
  const ctx = await requestContext();
  const page = await getPage("myList", ctx);
  const row = page.rows[0];

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>My List</h1>

      {!row ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing saved yet</p>
          <p className={styles.lede}>
            Add something from a <Link href="/browse">title page</Link>. The list lives in a
            cookie — there is no account system here, and building one would be a liability with
            no teaching value.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.lede}>
            {row.items.length} title{row.items.length === 1 ? "" : "s"}, each resolved by its own
            upstream call. Phase 7 turns that into one batched fetch and measures the difference.
          </p>
          <Row row={row} />
        </>
      )}
    </div>
  );
}
