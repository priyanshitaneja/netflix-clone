import Link from "next/link";
import type { TitleSummary } from "@/lib/bff/types";
import styles from "./Billboard.module.css";

/**
 * The single large hero title.
 *
 * Netflix treats this component as an experimentally derived artifact rather than a design
 * decision. "Decision Making at Netflix" (Martin Tingley, 7 Sep 2021) frames the
 * 2010-to-2020 homepage evolution as a sequence of A/B decisions about "balance between a
 * large display area for a single title vs showing more titles", and about whether video
 * beats static images. Phase 9 turns exactly that into the `billboard-video` experiment,
 * with click-through to detail as the proxy for Netflix's published reward metric — **take
 * fraction**, quality plays over impressions (Chandrashekar et al., 7 Dec 2017).
 *
 * Server component. The billboard's artwork is the page's LCP element, so it is also where
 * lesson L1.10's image work will show up most.
 */
export function Billboard({ title }: { title: TitleSummary }) {
  const art = title.artwork.backdrop ?? title.artwork.poster;

  return (
    <section className={styles.billboard} aria-labelledby="billboard-name">
      {/*
        Plain <img>, eager, no srcset — naive on purpose, like every other image in Phase 2.
        `fetchPriority="high"` is the one exception: it is not an optimization lesson, it is
        the honest declaration that this is the LCP element. Leaving it off would make the
        Phase 3 LCP baseline measure a queueing accident rather than the page.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element -- Naive on purpose until Phase 5.
          next/image is the *subject* of lessons L1.10 (AVIF bytes) and L1.12 (empty box rate);
          adopting it now would delete the before-measurement those lessons are built on.
          Phase 5 removes this suppression, and lint confirms the fix landed. */}
      <img
        className={styles.art}
        src={art}
        alt=""
        aria-hidden="true"
        width={1280}
        height={720}
        fetchPriority="high"
      />
      <div className={styles.scrim} />

      <h1 className={styles.name} id="billboard-name">
        {title.name}
      </h1>

      <div className={styles.facts}>
        {title.matchScore !== null ? (
          <span className={styles.match}>{title.matchScore}% match</span>
        ) : null}
        {title.year !== null ? <span>{title.year}</span> : null}
        {title.maturity ? <span className={styles.maturity}>{title.maturity}</span> : null}
        <span>{title.mediaType === "tv" ? "Series" : "Film"}</span>
      </div>

      <div className={styles.actions}>
        <Link className={styles.play} href={`/watch/${title.id}`}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.6-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
          </svg>
          Play
        </Link>
        <Link className={styles.info} href={`/title/${title.id}`}>
          <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z" />
          </svg>
          More Info
        </Link>
      </div>
    </section>
  );
}
