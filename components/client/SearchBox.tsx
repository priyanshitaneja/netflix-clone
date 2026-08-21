"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import styles from "./SearchBox.module.css";

/**
 * Search input in the top navigation.
 *
 * ============================================================================
 * NAIVE ON PURPOSE — this fires one navigation (and therefore one upstream
 * search call) per keystroke. There is no debounce. Do not add one here.
 * ============================================================================
 *
 * Typing an eight-character query issues eight searches. That is the baseline for three
 * separate measurements:
 *
 *  - perf scenario 7 (`search-type-8-chars`): INP and upstream request count.
 *  - lesson L2.4 (request collapsing, Christensen 2012): concurrent identical/similar calls
 *    collapse server-side. TMDB allows ~40 requests/second and returns 429 with **no
 *    Retry-After and no X-RateLimit-* headers** (verified), so this is a real rate-limit
 *    risk, not a synthetic one.
 *  - lesson L2.5 (bulkheads): search gets the smallest bulkhead in Phase 4
 *    (`maxConcurrent: 2`) and is deliberately starved first, because it is the least
 *    important dependency and the burstiest. A keystroke storm is exactly the traffic that
 *    proves isolation works.
 *
 * Phase 5 adds debouncing and client-side dedupe, and the delta is measured. Fixing it now
 * would delete three lessons and leave nothing to show for it.
 *
 * The `<form>` wrapper is not decoration: it makes the box work with JavaScript disabled and
 * gives keyboard users a real submit affordance. Netflix has published nothing about their
 * search UI; this is ordinary practice.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);

    // One navigation per keystroke. See the comment above before "fixing" this.
    if (next.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(next.trim())}`);
    }
  }

  return (
    <form className={styles.form} action="/search" role="search">
      <label className={styles.visuallyHidden} htmlFor="q">
        Search titles
      </label>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M10 2a8 8 0 1 0 4.9 14.32l5.39 5.39 1.42-1.42-5.39-5.39A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" />
      </svg>
      <input
        id="q"
        className={styles.input}
        type="search"
        name="q"
        value={value}
        onChange={handleChange}
        placeholder="Titles, people, genres"
        autoComplete="off"
      />
    </form>
  );
}
