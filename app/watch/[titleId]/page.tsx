import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/bff";
import { requestContext } from "@/lib/bff/context";
import { BffFatal } from "@/lib/bff/types";
import styles from "./Watch.module.css";

/**
 * The watch page — deliberately a placeholder until Phase 6.
 *
 * It resolves the title and shows the exact stream URLs the player will consume, but mounts no
 * player. That is not laziness: the `Player` abstraction is the single most delicate piece of the
 * build, and shipping a half-player now would poison the Phase 3 baselines it is measured
 * against.
 *
 * What Phase 6 adds here, and why the plumbing is arranged this way already:
 *
 *  - A `Player` interface with **two** adapters, `dashjs@5.2.1` and `hls.js@1.7.0`. Netflix ships
 *    DASH in browsers — they contributed fragmented MP4 and Common Encryption to MPEG-DASH
 *    ("Update on HTML5 Video for Netflix", Eddy/Trunnell/Gallagher, 21 Mar 2017) — while hls.js
 *    is the wider industry default. Tears of Steel serves an identical five-rung ladder over both
 *    protocols, which is what makes comparing them a controlled experiment rather than a vibe.
 *  - The player mounts via `next/dynamic(…, { ssr: false })` **and** `await import()` inside an
 *    effect. Both libraries touch `window`/`MediaSource` at import time, and a static import
 *    would put the whole player in the initial client chunk of every route in the app.
 *  - QoE instrumentation for five of the six metrics Netflix publishes — play delay, rebuffer
 *    rate, playback errors, user-initiated aborts and average bitrate ("Streaming Video
 *    Experimentation at Netflix", Martin Tingley, 17 Sep 2018). The sixth, VMAF, is a
 *    full-reference metric requiring the source video and is **not computable in a browser**; it
 *    is recorded as `not-measurable` rather than estimated.
 *
 * There is no DRM and there never will be: EME is a standard API, but a Widevine CDM licence
 * requires a commercial agreement and no open-source CDM exists. All streams here are clear.
 */
export default async function WatchPage({ params }: PageProps<"/watch/[titleId]">) {
  return (
    <Suspense fallback={<div className={styles.stage} aria-hidden="true" />}>
      <WatchBody params={params} />
    </Suspense>
  );
}

async function WatchBody({ params }: { params: PageProps<"/watch/[titleId]">["params"] }) {
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

  return (
    <main className={styles.wrap}>
      <div className={styles.stage}>
        <p className={styles.badge}>Player arrives in Phase 6</p>
        <h1 className={styles.title}>{detail.name}</h1>
        <p className={styles.body}>
          The stream is resolved and ready. What is missing is the <code>Player</code>
          abstraction and its two adapters — built and measured in Phase 6, against these exact
          URLs.
        </p>

        <dl className={styles.streams}>
          <dt>DASH</dt>
          <dd>
            <code>{detail.streams.dash[0]}</code>
          </dd>
          <dt>HLS</dt>
          <dd>
            <code>{detail.streams.hls[0]}</code>
          </dd>
        </dl>

        <div className={styles.actions}>
          <Link className={styles.back} href={`/title/${detail.id}`}>
            Back to title
          </Link>
          <a
            className={styles.ghost}
            href={detail.streams.hls[0]}
            target="_blank"
            rel="noreferrer"
          >
            Open manifest
          </a>
        </div>
      </div>
    </main>
  );
}
