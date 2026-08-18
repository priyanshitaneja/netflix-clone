import styles from "./Footer.module.css";

const LINKS = [
  "FAQ",
  "Help Centre",
  "Terms of Use",
  "Privacy",
  "Cookie Preferences",
  "Corporate Information",
];

/**
 * Server component. No interactivity, so no client JS — the whole footer costs zero bytes
 * of JavaScript.
 *
 * The TMDB attribution here is not decoration, it is a licence requirement: their terms
 * mandate the logo (displayed less prominently than our own) plus the exact notice below.
 * It is also in the README. Rendering it server-side means it cannot be lost to a
 * hydration failure.
 */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <ul className={styles.links}>
          {LINKS.map((link) => (
            <li key={link}>
              <a href="#">{link}</a>
            </li>
          ))}
        </ul>

        <div className={styles.attribution}>
          {/* Inline SVG: one less request, and no dependency on a remote asset host. */}
          <svg
            className={styles.tmdbMark}
            viewBox="0 0 273 35"
            role="img"
            aria-label="The Movie Database"
            fill="none"
          >
            <rect width="273" height="35" rx="4" fill="#0d253f" />
            <text
              x="14"
              y="23"
              fill="#01b4e4"
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize="15"
              fontWeight="700"
              letterSpacing="1.5"
            >
              TMDB
            </text>
            <text
              x="72"
              y="23"
              fill="#90cea1"
              fontFamily="Helvetica, Arial, sans-serif"
              fontSize="11"
            >
              The Movie Database
            </text>
          </svg>

          <p>
            This product uses TMDB and the TMDB APIs but is not endorsed, certified, or
            otherwise approved by TMDB.
          </p>
          <p>
            A non-commercial teaching project. Not affiliated with, endorsed by, or
            connected to Netflix. Video assets are open test content served without DRM.
          </p>
        </div>
      </div>
    </footer>
  );
}
