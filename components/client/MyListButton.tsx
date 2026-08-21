"use client";

import { useState, useTransition } from "react";
import { toggleMyList } from "@/app/(member)/my-list/actions";
import styles from "./MyListButton.module.css";

/**
 * Add/remove a title from My List, optimistically.
 *
 * One of only three client components in the member surfaces, and it is a client component for
 * a real reason: the response must be immediate. A server round trip before the icon changes
 * makes the button feel broken even when it works.
 *
 * The optimistic update is rolled back if the action throws, which is the part people skip. An
 * optimistic UI that cannot revert is not optimistic, it is wrong — it silently tells the user
 * something happened that did not.
 */
export function MyListButton({
  titleId,
  initiallySaved,
}: {
  titleId: string;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const optimistic = !saved;
    setSaved(optimistic);

    startTransition(async () => {
      try {
        const result = await toggleMyList(titleId);
        // Trust the server's answer over ours — they can disagree if the cookie changed in
        // another tab.
        setSaved(result.saved);
      } catch {
        setSaved(!optimistic);
      }
    });
  }

  return (
    <button
      type="button"
      className={styles.button}
      onClick={toggle}
      aria-pressed={saved}
      data-pending={pending ? "" : undefined}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        {saved ? (
          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
        ) : (
          <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
        )}
      </svg>
      {saved ? "In My List" : "My List"}
    </button>
  );
}
