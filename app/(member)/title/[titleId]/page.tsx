import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { BffFatal } from "@/lib/bff/types";
import { Row } from "@/components/server/Row";
import { TopNav } from "@/components/server/TopNav";
import { MyListButton } from "@/components/client/MyListButton";
import styles from "./Title.module.css";
import shell from "../../member.module.css";

/**
 * Title detail.
 *
 * The clearest demonstration of Netflix's three fallback modes in the app (Schmaus, 8 Dec
 * 2011). The title itself is **fail-fast** — without it there is no page, so we return a real
 * error rather than a shell about nothing — while "More Like This" is **fail-silent** and simply
 * disappears. `getPage("titleDetail")` encodes that pairing; this component only has to render
 * whatever survived.
 *
 * A `BffFatal` with status 404 becomes Next's `notFound()`. Anything else is re-thrown to
 * `error.tsx`, because "this title does not exist" and "our dependency is broken" must not look
 * the same to a user or to a monitor.
 */
export default async function TitlePage({ params }: PageProps<"/title/[titleId]">) {
  return (
    <>
      <TopNav />
      <Suspense fallback={<div className={styles.detailSkeleton} aria-hidden="true" />}>
        <TitleBody params={params} />
      </Suspense>
    </>
  );
}

async function TitleBody({ params }: { params: PageProps<"/title/[titleId]">["params"] }) {
  const { titleId } = await params;
  const ctx = await requestContext({ titleId });

  let page;
  try {
    page = await getPage("titleDetail", ctx);
  } catch (error) {
    if (error instanceof BffFatal && error.status === 404) notFound();
    throw error;
  }

  const detail = page.detail;
  if (!detail) notFound();

  const inMyList = ctx.myList.includes(detail.id);

  return (
    <article className={styles.detail}>
      <div className={styles.hero}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Naive on purpose until Phase 5.
            next/image is the *subject* of lessons L1.10 (AVIF bytes) and L1.12 (empty box rate);
            adopting it now would delete the before-measurement those lessons are built on.
            Phase 5 removes this suppression, and lint confirms the fix landed. */}
        <img
          className={styles.art}
          src={detail.artwork.backdrop ?? detail.artwork.poster}
          alt=""
          aria-hidden="true"
          width={1280}
          height={720}
          fetchPriority="high"
        />
        <div className={styles.scrim} />

        <div className={styles.heroBody}>
          <h1 className={styles.name}>{detail.name}</h1>

          <div className={styles.facts}>
            {detail.matchScore !== null ? (
              <span className={styles.match}>{detail.matchScore}% match</span>
            ) : null}
            {detail.year !== null ? <span>{detail.year}</span> : null}
            {detail.maturity ? <span className={styles.maturity}>{detail.maturity}</span> : null}
            {detail.runtimeMinutes !== null ? (
              <span>
                {Math.floor(detail.runtimeMinutes / 60)}h {detail.runtimeMinutes % 60}m
              </span>
            ) : null}
          </div>

          <p className={styles.synopsis}>{detail.synopsis}</p>

          <div className={styles.actions}>
            <Link className={styles.play} href={`/watch/${detail.id}`}>
              <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.6-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
              </svg>
              Play
            </Link>
            <MyListButton titleId={detail.id} initiallySaved={inMyList} />
          </div>

          <dl className={styles.meta}>
            {detail.cast.length > 0 ? (
              <>
                <dt>Cast</dt>
                <dd>{detail.cast.join(", ")}</dd>
              </>
            ) : null}
            {detail.genres.length > 0 ? (
              <>
                <dt>Genres</dt>
                <dd>
                  {detail.genres.map((genre, i) => (
                    <span key={genre.id}>
                      {i > 0 ? ", " : ""}
                      <Link className={styles.genreLink} href={`/genre/${genre.id}`}>
                        {genre.name}
                      </Link>
                    </span>
                  ))}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      </div>

      {page.meta.degradations.length > 0 ? (
        <p className={shell.notice}>
          Recommendations are unavailable on this render — the title loaded, the similar-titles
          dependency did not. That asymmetry is deliberate: one is required, the other optional.
        </p>
      ) : null}

      {page.rows.map((row) => (
        <Row key={row.id} row={row} />
      ))}
    </article>
  );
}
