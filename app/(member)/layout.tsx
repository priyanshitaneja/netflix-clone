import type { ReactNode } from "react";
import styles from "./member.module.css";

/**
 * Shell for the signed-in surfaces.
 *
 * Deliberately thin, and deliberately does **not** render the top navigation. `TopNav` takes a
 * `currentPath` so it can set `aria-current="page"`, and there is no server-side way to read
 * the pathname in a layout — `usePathname` is a client hook, and reaching for it here would
 * turn the entire navigation into a client component to obtain one attribute. Each page
 * renders its own `<TopNav currentPath="…" />` instead. Six explicit lines beat one implicit
 * client boundary.
 */
export default function MemberLayout({ children }: { children: ReactNode }) {
  return <div className={styles.shell}>{children}</div>;
}
