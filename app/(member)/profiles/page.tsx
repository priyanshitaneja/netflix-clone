import Link from "next/link";
import type { Metadata } from "next";
import { TopNav } from "@/components/server/TopNav";
import styles from "./Profiles.module.css";
import shell from "../member.module.css";

export const metadata: Metadata = { title: "Who's watching?" };

/**
 * Profile picker.
 *
 * Static, and static on purpose: there is no personalization model behind this clone, so
 * offering four profiles that each produce an identical page would be a lie told in UI. The
 * profiles are labelled as what they are.
 *
 * The page exists because profile switching is one of the interactions Netflix's own performance
 * suite measures — "Fixing Performance Regressions Before they Happen" (Angus Croll, 24 Jan
 * 2022) lists ~50 tests "each reproducing an aspect of real member interaction", naming startup,
 * profile switching, scrolling through titles, selecting an episode and playback. Our perf
 * scenario 6 (`profile-switch`) needs a real route to navigate to.
 */
export default function ProfilesPage() {
  return (
    <>
      <TopNav currentPath="/profiles" />
      <main className={styles.wrap}>
        <h1 className={styles.title}>Who&rsquo;s watching?</h1>

        <ul className={styles.grid}>
          {["Priyanshi", "Guest", "Kids", "Offline"].map((name, i) => (
            <li key={name}>
              <Link className={styles.profile} href="/browse">
                <span className={styles.avatar} data-variant={i}>
                  {name.slice(0, 1)}
                </span>
                <span className={styles.name}>{name}</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className={shell.notice}>
          These profiles are decorative. There is no personalization model here, so every profile
          renders the same rows — and a picker that implied otherwise would be a lie told in UI.
          Phase 9&rsquo;s A/B harness is where per-profile assignment becomes real, and even then
          it can only prove the plumbing: at one user, no experiment can measure a lift.
        </p>
      </main>
    </>
  );
}
