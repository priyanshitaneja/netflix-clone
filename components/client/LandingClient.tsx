"use client";

/**
 * ============================================================================
 * THE NAIVE BASELINE — this file is meant to be replaced. Do not "fix" it.
 * ============================================================================
 *
 * Lesson L1.4 ("Delete the client framework from pages that do not need it") measures a
 * delta, and a delta needs a before. This is the before: the entire landing page as one
 * client component tree, which is what a competent engineer writes by default in an App
 * Router app. That is exactly why it is a fair baseline rather than a straw man.
 *
 * The interactive surface is deliberately the same list Addy Osmani names in
 * "A Netflix Web Performance Case Study" (5 Nov 2018) as what Netflix rewrote in vanilla
 * JS when they removed client-side React from their logged-out landing page: tabs, the
 * language switcher, and the cookie banner. Netflix reported ~200 kB of JS removed from a
 * 300 kB payload and loading/TTI down 50%.
 *
 * Phase 5 replaces this with server-rendered markup plus three small vanilla-JS islands,
 * and the measured before/after lands in docs/measurement/ledger.json.
 *
 * Provenance note: the *technique* is NF-3P — Netflix's work described by a Google
 * engineer, not a Netflix Tech Blog post. Netflix never published this themselves. The
 * widely repeated "80% JS reduction" figure is unsourced; Osmani's numbers are 200 kB of
 * 300 kB. See ledger H-04.
 */

import { useState, type FormEvent } from "react";
import { DEFAULT_LOCALE, LOCALES, type LocaleCode } from "@/lib/i18n";
import styles from "./LandingClient.module.css";

const TABS = [
  {
    id: "tv",
    label: "Watch on your TV",
    heading: "Enjoy it on the big screen",
    body: "Smart TVs, PlayStation, Xbox, Chromecast, Apple TV, Blu-ray players and more.",
  },
  {
    id: "download",
    label: "Download & go",
    heading: "Take it anywhere",
    body: "Save your favourites easily and always have something to watch offline.",
  },
  {
    id: "everywhere",
    label: "Watch everywhere",
    heading: "One plan, every device",
    body: "Stream on your phone, tablet, laptop and TV without paying more.",
  },
  {
    id: "kids",
    label: "Profiles for kids",
    heading: "Create profiles for children",
    body: "Send children on adventures with their favourite characters, in a space made just for them.",
  },
] as const;

const FAQS = [
  {
    q: "What is this?",
    a: "A teaching clone. It reproduces Netflix's published web engineering practices — server rendering, resilient data fetching, adaptive playback — and measures each one, rather than just imitating the interface.",
  },
  {
    q: "Where does the data come from?",
    a: "The TMDB API when a key is present, and committed JSON fixtures shaped identically when it is not. The application above the transport layer cannot tell the difference, which is why the whole app runs offline.",
  },
  {
    q: "Is any of this real Netflix code?",
    a: "None of it. Every technique here traces to a publicly published article, and anything that is general industry practice rather than something Netflix wrote about is labelled as such in the docs.",
  },
  {
    q: "Can it play real Netflix content?",
    a: "No. It plays open test streams over DASH and HLS with no DRM — a Widevine licence requires a commercial agreement, and there is no open-source CDM.",
  },
] as const;

function isProbablyEmail(value: string): boolean {
  // Deliberately permissive. Real validation is the server's job (see the signup action);
  // this only catches obvious typos before a round trip.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function LandingClient() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [cookiesAcknowledged, setCookiesAcknowledged] = useState(false);

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isProbablyEmail(email)) {
      event.preventDefault();
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(null);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.bar}>
          <span className={styles.wordmark}>Nextflix</span>

          <div className={styles.langWrap}>
            <svg className={styles.langIcon} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 9h-2.95a15.6 15.6 0 0 0-1.2-5.3A8 8 0 0 1 18.9 11ZM12 4.04c.83 1.2 1.66 3.3 1.9 6.96h-3.8c.24-3.66 1.07-5.76 1.9-6.96ZM4.26 13h2.95c.13 1.9.5 3.7 1.2 5.3A8 8 0 0 1 4.26 13Zm2.95-2H4.26a8 8 0 0 1 4.15-5.3A15.6 15.6 0 0 0 7.21 11ZM12 19.96c-.83-1.2-1.66-3.3-1.9-6.96h3.8c-.24 3.66-1.07 5.76-1.9 6.96Zm3.59-1.66c.7-1.6 1.07-3.4 1.2-5.3h2.95a8 8 0 0 1-4.15 5.3Z" />
            </svg>
            <label className={styles.visuallyHidden} htmlFor="locale">
              Language
            </label>
            <select
              id="locale"
              className={styles.lang}
              value={locale}
              onChange={(e) => setLocale(e.target.value as LocaleCode)}
            >
              {LOCALES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <a className={styles.signIn} href="/browse">
            Sign In
          </a>
        </div>

        <div className={styles.heroBody}>
          <h1 className={styles.headline}>Unlimited films, TV programmes and more</h1>
          <p className={styles.sub}>Watch anywhere. Cancel at any time.</p>
          <p className={styles.pitch}>
            Ready to watch? Enter your email to create or restart your membership.
          </p>

          <form className={styles.form} action="/signup" method="get" onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <input
                id="email"
                className={styles.input}
                type="email"
                name="email"
                placeholder=" "
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              <label className={styles.label} htmlFor="email">
                Email address
              </label>
            </div>
            <button className={styles.cta} type="submit">
              Get Started
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
            {emailError ? (
              <p className={styles.error} id="email-error" role="alert">
                {emailError}
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="reasons-heading">
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle} id="reasons-heading">
            More reasons to join
          </h2>

          {/*
            Roving-tabindex is NOT implemented here on purpose — the naive version leaves
            every tab in the tab order. Lesson L5.2 fixes it and measures tab stops per
            row going from N to 1. That lesson derives from the W3C ARIA APG, not from
            Netflix: they have published nothing on web accessibility (ledger H-02).
          */}
          <div className={styles.tablist} role="tablist" aria-label="More reasons to join">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={styles.tab}
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={t.id === activeTab}
                aria-controls={`panel-${t.id}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/*
            Only the selected panel is rendered — so the other three panels' text is not
            in the HTML at all. That is a real cost the Phase 5 rewrite removes by
            server-rendering every panel and toggling visibility in CSS, which also makes
            the tabs work with JavaScript disabled.
          */}
          <div
            className={styles.panel}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
          >
            <h3>{tab.heading}</h3>
            <p>{tab.body}</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-heading">
        <div className={styles.sectionInner}>
          <h2 className={styles.sectionTitle} id="faq-heading">
            Frequently asked questions
          </h2>

          <ul className={styles.faqList}>
            {FAQS.map((item) => {
              const open = openFaq === item.q;
              return (
                <li key={item.q}>
                  <button
                    className={styles.faqButton}
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : item.q)}
                  >
                    {item.q}
                    <span className={`${styles.plus} ${open ? styles.plusOpen : ""}`} aria-hidden="true">
                      +
                    </span>
                  </button>
                  {open ? <p className={styles.faqAnswer}>{item.a}</p> : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {cookiesAcknowledged ? null : (
        <div className={styles.cookie} role="region" aria-label="Cookie preferences">
          <p className={styles.cookieText}>
            This project stores a profile identifier locally so the personalized rows and
            My List work. No analytics are sent anywhere except this app&rsquo;s own
            performance collector, which runs on your machine.
          </p>
          <div className={styles.cookieActions}>
            <button className={styles.cta} onClick={() => setCookiesAcknowledged(true)}>
              OK
            </button>
            <button className={styles.ghost} onClick={() => setCookiesAcknowledged(true)}>
              Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
