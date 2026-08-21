"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./RowRail.module.css";

/**
 * The horizontally scrolling rail.
 *
 * This is the one client component on the browse page, and it is deliberately thin: it
 * receives its cards as **already-rendered server children** and only handles scrolling. The
 * expensive part of a row — N cards of markup — never enters the client bundle.
 *
 * ============================================================================
 * NO WINDOWING YET. That is Phase 5, and it comes with an honest caveat.
 * ============================================================================
 *
 * Lesson L1.8 adds windowing and measures DOM node count, JS heap and FPS across a scripted
 * ten-row scroll. The caveat that lesson must state: **a client virtualizer cannot lazily
 * create RSC children.** These children arrive already serialized in the RSC payload, so
 * windowing cuts DOM nodes and layout cost but *not* transfer bytes. Reducing the payload
 * needs a client fetch for page 2+ of a row, which is a different change with a different
 * measurement.
 *
 * Provenance: Netflix has published nothing on carousel virtualization. The only statement
 * that exists is the phrase "component pooling in Lists" in "Crafting a high-performance TV
 * user interface using React" (Ian McKay, 12 Jan 2017) — one phrase, no implementation, no
 * numbers. Windowing here is general industry practice and is labelled `IND` (ledger H-01).
 *
 * Keyboard behaviour is informed by "Pass the Remote: User Input on TV Devices"
 * (Andrew Eichacker, 17 May 2017), which is about TV remotes rather than browsers, but whose
 * central observation transfers exactly: on a TV "there is no default handling by the
 * platform — navigational order is defined by UI developers", and focus entering a bad state
 * with no pointer escape hatch reads to the user as a frozen app. Full roving-tabindex is
 * lesson L5.2 (`IND`, from the W3C ARIA APG — Netflix has published nothing on web
 * accessibility, ledger H-02); this Phase 2 version leaves every card in the tab order,
 * which is the naive baseline that lesson improves on.
 */
export function RowRail({ label, children }: { label: string; children: ReactNode }) {
  const railRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    // 2px slack: fractional scroll offsets on HiDPI displays otherwise leave the end arrow
    // enabled forever at the extreme.
    setAtStart(rail.scrollLeft <= 2);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2);
  }, []);

  useEffect(() => {
    syncEdges();
    const rail = railRef.current;
    if (!rail) return;

    // ResizeObserver as well as scroll: a viewport change alters whether the rail overflows
    // at all, and a stale arrow state is worse than no arrow.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [syncEdges]);

  const page = useCallback((direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    // Scroll by just under a viewport so the edge card stays partly visible — it signals
    // continuity rather than implying the row restarted.
    rail.scrollBy({ left: direction * rail.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowLeft}`}
        onClick={() => page(-1)}
        disabled={atStart}
        aria-label={`Scroll ${label} backwards`}
      >
        <Chevron direction="left" />
      </button>

      <ul className={styles.rail} ref={railRef} onScroll={syncEdges} aria-label={label}>
        {children}
      </ul>

      <button
        type="button"
        className={`${styles.arrow} ${styles.arrowRight}`}
        onClick={() => page(1)}
        disabled={atEnd}
        aria-label={`Scroll ${label} forwards`}
      >
        <Chevron direction="right" />
      </button>
    </div>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path
        d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
