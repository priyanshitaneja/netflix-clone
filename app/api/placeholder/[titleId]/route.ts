import type { NextRequest } from "next/server";

/**
 * Generated placeholder poster art.
 *
 * Two reasons this exists rather than committed image files:
 *
 *  1. The committed fixtures carry `poster_path: null` throughout, because they are
 *     hand-authored and we will not invent TMDB image paths that resolve to somebody
 *     else's artwork. TMDB genuinely returns null posters for real titles, so this is a
 *     production code path, not fixture scaffolding.
 *  2. `OFFLINE=1` must work with no network at all.
 *
 * `OURS` — Netflix has published nothing resembling this. Their real dynamic image service,
 * Dynimo, is a Go binary on AWS Lambda behind Zuul and Open Connect, solving a genuinely
 * different problem: catalog-wide cache invalidation when creative changes, with 5-10x
 * traffic spikes on new releases (Stier & Okulist, 23 Mar 2020). Lesson L1.11 measures our
 * on-demand generation against that article's *shape*, and the honesty ledger records that
 * the implementations have nothing in common.
 */

const WIDTH = 500;
const HEIGHT = 750;

/** FNV-1a. Small, deterministic, and good enough to spread hues across a catalog. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

/** Break a title across lines without splitting words, so long names stay readable. */
function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.length > 0 ? lines : [text.slice(0, maxChars)];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ titleId: string }> },
) {
  const { titleId } = await params;
  const name = (request.nextUrl.searchParams.get("n") ?? titleId).slice(0, 90);

  const seed = hash(titleId);
  const hue = seed % 360;
  const hue2 = (hue + 40 + (seed % 60)) % 360;
  const angle = seed % 90;

  const lines = wrap(name, 16, 4);
  const fontSize = lines.length > 2 ? 46 : 56;
  const startY = HEIGHT / 2 - ((lines.length - 1) * fontSize * 1.15) / 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
      <stop offset="0%" stop-color="hsl(${hue} 55% 26%)"/>
      <stop offset="100%" stop-color="hsl(${hue2} 60% 11%)"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  <rect x="0" y="${HEIGHT - 6}" width="${WIDTH}" height="6" fill="hsl(${hue} 70% 45%)"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" fill="#ffffff" text-anchor="middle">
${lines
  .map(
    (line, i) =>
      `    <text x="${WIDTH / 2}" y="${startY + i * fontSize * 1.15}" font-size="${fontSize}" font-weight="700" opacity="0.94">${escapeXml(line)}</text>`,
  )
  .join("\n")}
  </g>
</svg>
`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Deterministic output for a given (id, name), so it can be cached forever.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
