import { LandingClient } from "@/components/client/LandingClient";

/**
 * The logged-out landing page.
 *
 * In Phase 1 this server component does nothing but render one big client component —
 * the deliberate naive baseline for lesson L1.4. Phase 5 inverts it: the markup becomes
 * server-rendered here and only three small vanilla-JS islands ship to the browser.
 *
 * Measured floor worth knowing before you read any number from this route: a 100%
 * server-component route on Next 16.3.1 still ships ~169 kB gzip of framework JS
 * (react-dom 69.8, framework 47.3, polyfills 38.5, runtime 13.1). So "zero client JS" is
 * not reachable inside the App Router, and Phase 5 escapes the client runtime entirely
 * rather than pretending otherwise.
 */
export default function LandingPage() {
  return (
    <main>
      <LandingClient />
    </main>
  );
}
