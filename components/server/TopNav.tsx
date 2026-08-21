import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/client/SearchBox";
import styles from "./TopNav.module.css";

const LINKS = [
  { href: "/browse", label: "Home" },
  { href: "/genre/878", label: "Sci-Fi" },
  { href: "/genre/18", label: "Drama" },
  { href: "/genre/35", label: "Comedy" },
  { href: "/my-list", label: "My List" },
] as const;

/**
 * The member navigation bar.
 *
 * A server component that mounts exactly one client child. `<SearchBox>` needs `useRouter`
 * and `useSearchParams`, so it must be a client component — and `useSearchParams` reads
 * request data, which under `cacheComponents: true` would opt every page rendering this nav
 * out of prerendering. The `<Suspense>` boundary contains that: the nav's static shell
 * prerenders and only the search input streams.
 *
 * That is the same mechanism as the signup page, applied to a shared component, and it is
 * why the boundary belongs here rather than in each page.
 *
 * `currentPath` is passed in rather than read from a hook, because `usePathname` would make
 * this whole component client-side — trading the entire nav's markup for one `aria-current`
 * attribute.
 */
export function TopNav({ currentPath }: { currentPath?: string }) {
  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link className={styles.wordmark} href="/browse">
        Nextflix
      </Link>

      <ul className={styles.links}>
        {LINKS.map((link) => {
          const current = link.href === currentPath;
          return (
            <li key={link.href}>
              <Link
                className={`${styles.link} ${current ? styles.current : ""}`}
                href={link.href}
                aria-current={current ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className={styles.spacer} />

      <Suspense fallback={null}>
        <SearchBox />
      </Suspense>

      <Link className={styles.avatar} href="/profiles" aria-label="Switch profile">
        N
      </Link>
    </nav>
  );
}
