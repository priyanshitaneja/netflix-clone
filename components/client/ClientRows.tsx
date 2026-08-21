"use client";

import { useEffect, useState } from "react";
import type { RowPayload } from "@/lib/bff/types";
import { RowRail } from "./RowRail";
import styles from "./ClientRows.module.css";

/**
 * ============================================================================
 * THE CONTROL GROUP. This component is intentionally the wrong architecture.
 * ============================================================================
 *
 * It renders the browse page the way it looks when the client assembles it: one `fetch` per
 * row, from the browser, after the document has already loaded. Nine network requests instead
 * of one, every card's markup built client-side, and the whole `TitleSummary` shape shipped as
 * JSON on top of the JavaScript that renders it.
 *
 * It is reachable only at `/browse?rows=client`, nothing links to it, and no feature may be
 * built on it. It exists so lesson L2.2 can compare two real waterfalls rather than describe
 * them:
 *
 *   | | `/browse` | `/browse?rows=client` |
 *   |---|---|---|
 *   | browser requests | 1 document | 1 document + 8 XHR |
 *   | row markup built | server | client |
 *   | rows visible at first paint | all | none |
 *
 * Source: "Embracing the Differences: Inside the Netflix API Redesign" (Daniel Jacobson,
 * 9 Jul 2012) — a per-resource API is convenient for the provider and forces the consumer into
 * one round trip per thing it needs; the fix is a page-shaped endpoint whose server-side
 * adapter explodes one request into many.
 *
 * A second, quieter lesson lives in here too: notice that the cards below are rendered by
 * *this client component*, so unlike `components/server/Card.tsx` their markup is part of the
 * JS bundle. That is why `/browse?rows=client` also has a larger client payload, not just more
 * requests.
 */
export function ClientRows() {
  const [rows, setRows] = useState<RowPayload[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // The row list itself has to be discovered first — a ninth request the page-shaped
        // endpoint does not need, because it simply returns the rows.
        const manifest = await fetch("/api/bff/rows", { cache: "no-store" });
        const ids: string[] = await manifest.json();

        const loaded = await Promise.all(
          ids.map(async (id) => {
            const res = await fetch(`/api/bff/row/${id}`, { cache: "no-store" });
            return res.ok ? ((await res.json()) as RowPayload) : null;
          }),
        );

        if (!cancelled) {
          setRows(loaded.filter((r): r is RowPayload => r !== null));
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <p className={styles.banner}>
        <strong>Control group.</strong> This is the same page assembled client-side — one
        request per row instead of one request for the page. Open the network panel and compare
        it with <code>/browse</code>. Nothing links here on purpose.
      </p>

      {state === "loading" ? <p className={styles.status}>Loading rows, one request at a time…</p> : null}
      {state === "error" ? <p className={styles.status}>Row fetches failed.</p> : null}

      {rows.map((row) => (
        <section className={styles.row} key={row.id} aria-labelledby={`crow-${row.id}`}>
          <h2 className={styles.title} id={`crow-${row.id}`}>
            {row.title}
          </h2>
          <RowRail label={row.title}>
            {row.items.map((title) => (
              <li className={styles.item} key={title.id}>
                {/* Card markup built in the browser — this is the cost the server version avoids. */}
                <a className={styles.card} href={`/title/${title.id}`}>
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
                  />
                  <span className={styles.name}>{title.name}</span>
                </a>
              </li>
            ))}
          </RowRail>
        </section>
      ))}
    </div>
  );
}
