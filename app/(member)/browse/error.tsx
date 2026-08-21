"use client";

import Link from "next/link";
import styles from "./Error.module.css";

/**
 * The one client component Next actually forces on us.
 *
 * Error boundaries must be client components, which makes this the only unavoidable
 * `'use client'` in the route tree. It is kept to markup plus a reset button precisely because
 * of that: anything added here is client JavaScript on a page that, by definition, is already
 * having a bad day.
 *
 * This renders when a dependency **failed fast** — the mode Netflix reserves for data the page
 * cannot do without (Schmaus, 8 Dec 2011). Rows that merely fail silently never reach here;
 * they degrade in place. Seeing this page means something required was missing, and saying so
 * plainly is more useful than a generic apology.
 */
export default function BrowseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.wrap}>
      <h1 className={styles.title}>This page needs something it could not get</h1>
      <p className={styles.body}>
        A required dependency failed, so the page failed fast rather than rendering a shell
        around missing data. Optional rows degrade in place; required data does not.
      </p>
      {error.digest ? <p className={styles.digest}>Digest: {error.digest}</p> : null}
      <div className={styles.actions}>
        <button className={styles.retry} type="button" onClick={reset}>
          Try again
        </button>
        <Link className={styles.ghost} href="/">
          Back to start
        </Link>
      </div>
    </main>
  );
}
