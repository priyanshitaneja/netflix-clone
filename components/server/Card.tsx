import Link from "next/link";
import type { TitleSummary } from "@/lib/bff/types";
import styles from "./Card.module.css";

/**
 * One title card. A server component, so all of this markup costs zero client JavaScript —
 * even though the cards live inside a client-side scrolling rail. `Row` renders these and
 * passes them to `<RowRail>` as children, which is what keeps the expensive part (N cards)
 * on the server and the cheap part (scroll handling) on the client.
 *
 * ============================================================================
 * NAIVE ON PURPOSE — Phase 5 changes this file and measures the difference.
 * ============================================================================
 *
 * Three things are deliberately wrong here:
 *
 *  1. A plain `<img>` with no `loading`, no `srcset`, no `sizes`. Every card in every row
 *     fetches eagerly at full width. That is what makes lesson L1.12's metric — **empty box
 *     rate**, from "Fixing Performance Regressions Before they Happen" (Angus Croll,
 *     24 Jan 2022), defined as how often in-viewport titles are missing images — actually
 *     measurable rather than hypothetical.
 *  2. No AVIF. Lesson L1.10 introduces it against real bytes (Mavlankar et al., 13 Feb 2020,
 *     measured a real Netflix boxshot at 69,445 B JPEG vs 40,811 B AVIF).
 *  3. No priority hint on the first row, so LCP competes with 90 other images.
 *
 * `width`/`height` ARE set, because a missing intrinsic size is a layout-shift bug rather
 * than a performance lesson, and shipping a known CLS regression to make a point would
 * corrupt every CLS measurement taken between now and Phase 5.
 */
export function Card({ title }: { title: TitleSummary }) {
  return (
    <Link className={styles.card} href={`/title/${title.id}`}>
      <div className={styles.posterFrame}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Naive on purpose until Phase 5.
            next/image is the *subject* of lessons L1.10 (AVIF bytes) and L1.12 (empty box rate);
            adopting it now would delete the before-measurement those lessons are built on.
            Phase 5 removes this suppression, and lint confirms the fix landed. */}
        <img
          className={styles.poster}
          src={title.artwork.poster}
          width={500}
          height={750}
          alt={`${title.name} poster`}
          draggable={false}
        />
      </div>
      <div className={styles.body}>
        <span className={styles.name}>{title.name}</span>
        <span className={styles.facts}>
          {title.matchScore !== null ? (
            <span className={styles.match}>{title.matchScore}% match</span>
          ) : null}
          {title.maturity ? <span className={styles.maturity}>{title.maturity}</span> : null}
          {title.year !== null ? <span>{title.year}</span> : null}
        </span>
      </div>
    </Link>
  );
}
