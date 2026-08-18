/**
 * The locale list the landing page's language switcher offers.
 *
 * Netflix's real signup flow is one responsive codebase serving 30" down to 4" screens
 * (Sass, 2014) and localized per region; ours is a small honest subset. Copy lives here
 * rather than in the component so the Phase 5 rewrite — which drops React from this page
 * entirely — can reuse it from a vanilla-JS island without a framework dependency.
 */
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALES.some((l) => l.code === value);
}
