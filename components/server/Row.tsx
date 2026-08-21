import type { RowPayload } from "@/lib/bff/types";
import { RowRail } from "@/components/client/RowRail";
import { Card } from "./Card";
import styles from "./Row.module.css";

/**
 * One row of the personalized row homepage.
 *
 * Read the composition carefully, because it is the whole point of the server/client split:
 * this is a **server** component that renders server `<Card>`s and hands them to the
 * **client** `<RowRail>` as children. React serializes the already-rendered cards into the
 * RSC payload, so the rail's JavaScript ships without any of the card markup, and adding a
 * card costs zero additional client bytes.
 *
 * Getting this backwards — making `Row` a client component so it can `.map()` inside the rail
 * — would pull every card, and the whole `TitleSummary` type, into the client bundle. That is
 * the single most common way an App Router page accidentally becomes an SPA.
 */
export function Row({ row }: { row: RowPayload }) {
  return (
    <section className={styles.row} aria-labelledby={`row-${row.id}`}>
      <div className={styles.header}>
        <h2 className={styles.title} id={`row-${row.id}`}>
          {row.title}
        </h2>
        {/* Which algorithm produced this row. Netflix's homepage is built by per-row
            algorithms (Alvino & Basilico, 9 Apr 2015); surfacing the name turns an
            invisible architectural fact into something you can see while learning. */}
        <span className={styles.algo}>{row.algo}</span>
      </div>

      {/*
        A degraded row still renders — that is the entire value of `fail-silent`. It says so
        rather than silently showing fewer titles, because "this row is incomplete" and "this
        row is short" are different facts and conflating them is how monitoring rots.
      */}
      {row.degraded.mode !== "ok" ? (
        <p className={styles.degraded}>
          This row is incomplete — {row.degraded.dep} failed ({row.degraded.reason}).
        </p>
      ) : null}

      <RowRail label={row.title}>
        {row.items.map((title) => (
          <li className={styles.item} key={title.id}>
            <Card title={title} />
          </li>
        ))}
      </RowRail>
    </section>
  );
}
