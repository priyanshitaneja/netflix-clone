#!/usr/bin/env node
/**
 * Per-route first-load JS, measured from the build output.
 *
 * Why this exists: Next 16 removed JS bundle-size metrics from `next build`, and under
 * Turbopack there is no `.next/app-build-manifest.json` to read. `build-manifest.json`
 * only carries `rootMainFiles` (the shared runtime) and a Pages-Router `pages` map, so it
 * cannot answer "what does this route cost".
 *
 * What it does instead: parse the `<script>` tags and script preloads out of the HTML Next
 * actually emitted for each prerendered route, then size those exact files. That is the
 * closest thing to ground truth available without a browser — it is the set of JS the
 * browser is told to fetch for a cold load of that route.
 *
 * Limitation, stated rather than hidden: this only sees **prerendered** routes, because a
 * dynamic route has no emitted HTML. Dynamic routes get measured from real network
 * records in Phase 3 (Lighthouse `resource-summary:script:size`).
 *
 * Usage:
 *   node scripts/route-js.mjs                       # table
 *   node scripts/route-js.mjs --json out.json       # machine-readable
 *   node scripts/route-js.mjs --assert budgets.json # exit 1 on breach
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";

const APP_DIR = ".next/server/app";
const STATIC_PREFIX = "/_next/";

function htmlFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(p, acc);
    else if (entry.name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

/** `.next/server/app/index.html` -> `/`, `.next/server/app/browse/index.html` -> `/browse` */
function routeOf(htmlPath) {
  const rel = relative(APP_DIR, htmlPath).replace(/\.html$/, "");
  if (rel === "index") return "/";
  return "/" + rel.replace(/\/index$/, "");
}

function scriptsIn(html) {
  const tags = [...html.matchAll(/<script\s+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const preloads = [...html.matchAll(/<link\s+rel="preload"\s+as="script"[^>]*?href="([^"]+\.js)"/g)]
    .map((m) => m[1]);
  // Order-preserving dedupe: a file preloaded *and* script-tagged is fetched once.
  return [...new Set([...tags, ...preloads])].filter((s) => s.startsWith(STATIC_PREFIX));
}

function measure(files) {
  let raw = 0, gzip = 0, brotli = 0;
  const missing = [];
  for (const src of files) {
    const p = ".next/" + src.slice(STATIC_PREFIX.length);
    if (!existsSync(p)) { missing.push(src); continue; }
    const buf = readFileSync(p);
    raw += buf.byteLength;
    gzip += gzipSync(buf, { level: 9 }).byteLength;
    brotli += brotliCompressSync(buf, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    }).byteLength;
  }
  return { files: files.length, raw, gzip, brotli, missing };
}

function main() {
  if (!existsSync(APP_DIR) || !statSync(APP_DIR).isDirectory()) {
    console.error(`No ${APP_DIR}. Run \`npm run build\` first.`);
    process.exit(2);
  }

  const results = htmlFiles(APP_DIR)
    .map((f) => ({ route: routeOf(f), html: f, ...measure(scriptsIn(readFileSync(f, "utf8"))) }))
    // Internal routes are measured but reported after real ones.
    .sort((a, b) => Number(a.route.startsWith("/_")) - Number(b.route.startsWith("/_"))
      || a.route.localeCompare(b.route));

  const kb = (n) => (n / 1024).toFixed(1).padStart(7);
  console.log("\n  route                    files      raw     gzip   brotli");
  console.log("  " + "-".repeat(58));
  for (const r of results) {
    console.log(`  ${r.route.padEnd(24)} ${String(r.files).padStart(5)}  ${kb(r.raw)}  ${kb(r.gzip)}  ${kb(r.brotli)}   kB`);
    if (r.missing.length) console.log(`    ! missing from disk: ${r.missing.join(", ")}`);
  }
  console.log();

  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
    const out = {
      measuredAt: new Date().toISOString(),
      next: JSON.parse(readFileSync("package.json", "utf8")).dependencies.next,
      note: "Prerendered routes only. Bytes are of the JS files the emitted HTML asks the browser to fetch.",
      routes: Object.fromEntries(results.map((r) => [r.route, {
        files: r.files, raw: r.raw, gzip: r.gzip, brotli: r.brotli,
      }])),
    };
    writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(out, null, 2) + "\n");
    console.log(`  wrote ${process.argv[jsonIdx + 1]}\n`);
  }

  const assertIdx = process.argv.indexOf("--assert");
  if (assertIdx !== -1 && process.argv[assertIdx + 1]) {
    const budgets = JSON.parse(readFileSync(process.argv[assertIdx + 1], "utf8"));
    let failed = 0;
    for (const [route, limitKb] of Object.entries(budgets)) {
      const r = results.find((x) => x.route === route);
      if (!r) { console.error(`  BUDGET ERROR  ${route} has a budget but was not built`); failed++; continue; }
      const actual = r.gzip / 1024;
      const ok = actual <= limitKb;
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${route.padEnd(24)} ${actual.toFixed(1)} kB gzip vs ${limitKb} kB budget`);
      if (!ok) failed++;
    }
    console.log();
    if (failed) { console.error(`  ${failed} budget failure(s).\n`); process.exit(1); }
  }
}

main();
