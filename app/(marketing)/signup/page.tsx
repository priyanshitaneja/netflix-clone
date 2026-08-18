import { Suspense } from "react";
import type { Metadata } from "next";
import { signup } from "./actions";
import styles from "./Signup.module.css";

export const metadata: Metadata = { title: "Finish signing up" };

/**
 * Step 2 of Netflix's signup flow, in spirit.
 *
 * Netflix's own account of this flow — "The Netflix Signup Flow: Our Journey to a
 * Responsive Design" (Joel Sass, 3 Mar 2014) — is about collapsing two separate stacks,
 * desktop and mobile, into one responsive codebase spanning 30" to 4" screens. That is
 * lesson L1.14, measured here: Lighthouse green at six viewport widths from one codebase.
 *
 * Structure worth reading closely, because it is lesson L1.1 in miniature. With
 * `cacheComponents: true`, touching `searchParams` anywhere outside `<Suspense>` makes the
 * whole route un-prerenderable — Next refuses the build rather than letting you ship a
 * page that blocks on request data. So the static shell (heading, copy, disclaimer)
 * prerenders, and only `<SignupForm>` — the part that genuinely depends on the request —
 * streams in behind a fallback. "Server-render only enough to bootstrap the view", enforced
 * by the compiler instead of by discipline.
 *
 * No client component in this subtree. The form posts to a server action, so the page's
 * only JavaScript is the framework floor.
 */
export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.step}>Step 1 of 3</p>
        <h1 className={styles.title}>Finish setting up your account</h1>
        <p className={styles.lede}>
          Nextflix is personalised for you. Create a profile to get started — no password,
          no payment, nothing stored about you.
        </p>

        {/* The promise is passed down, not awaited here — awaiting it in the page would
            opt the entire route out of prerendering. */}
        <Suspense fallback={<SignupFormSkeleton />}>
          <SignupForm searchParams={searchParams} />
        </Suspense>

        <p className={styles.note}>
          This is a non-commercial teaching project. Your email is validated and then
          discarded — only an opaque profile id is stored, in a cookie.
        </p>
      </div>
    </main>
  );
}

async function SignupForm({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const params = await searchParams;
  const prefill = typeof params.email === "string" ? params.email : "";
  const hasError = params.error === "email";

  return (
    <>
      {hasError ? (
        <p className={styles.error} role="alert">
          Please enter a valid email address.
        </p>
      ) : null}

      <form className={styles.form} action={signup}>
        <label className={styles.note} htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          className={styles.input}
          type="email"
          name="email"
          defaultValue={prefill}
          autoComplete="email"
          aria-invalid={hasError ? true : undefined}
          required
        />
        <button className={styles.cta} type="submit">
          Next
        </button>
      </form>
    </>
  );
}

/**
 * Reserves the form's layout box so streaming the real form in does not shift anything.
 * A fallback whose height differs from its content is a CLS bug wearing a loading skin.
 */
function SignupFormSkeleton() {
  return (
    <div className={styles.form} aria-hidden="true">
      <span className={styles.note}>Email address</span>
      <div className={styles.input} />
      <div className={styles.cta} />
    </div>
  );
}
