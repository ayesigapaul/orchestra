#!/usr/bin/env node
/**
 * Renders every inline ```mermaid block in the repository's Markdown to HTML under
 * docs/assets/diagrams/ — zero dependencies. It scans exactly what scripts/check-mermaid.mjs parses,
 * so the pages and CI's count can never differ.
 *
 * The Markdown stays the single source: diagrams version with the prose, and CI parses every one
 * with scripts/check-mermaid.mjs. These pages exist so the diagrams can be read in a browser without
 * a Mermaid-aware editor. They are generated and never edited by hand, and --check fails when a page
 * no longer matches its source — a render that disagrees with the document it came from is worse
 * than no render at all.
 *
 * One page per document that carries a diagram, plus index.html. Output is deterministic — no
 * timestamps, stable ordering — so --check can compare byte for byte.
 *
 * Diagrams render in the browser with Mermaid from a pinned CDN build, the same version CI parses
 * with. Offline, each page shows the diagram source instead.
 *
 * Usage: node scripts/build-diagrams.mjs           write the pages and remove orphans
 *        node scripts/build-diagrams.mjs --check   fail if a page is stale, missing or orphaned
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, unlinkSync, mkdirSync, lstatSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.');
const DOCS = join(ROOT, 'docs');
const OUT = join(DOCS, 'assets', 'diagrams');
// The scope scripts/check-mermaid.mjs parses. Keep the two identical.
const SKIP = new Set(['node_modules', '.git', '.next', 'archive', 'dist', 'build']);
const MERMAID = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js';
const CHECK = process.argv.includes('--check');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
      // index.md files are symlinks to a directory's README.md, so Mintlify can serve a section
      // index — it refuses to serve a page named README. Following them would count every such
      // document twice.
    if (lstatSync(p).isSymbolicLink()) continue;
    if (statSync(p).isDirectory()) { if (!SKIP.has(entry)) walk(p, out); }
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every diagram in a document, with the heading it sits under. A block opens on a line that is
 * exactly ```mermaid and closes at the next line beginning ```, which is the rule
 * check-mermaid.mjs applies, so both scripts see the same set.
 */
function diagrams(text) {
  const found = [];
  let heading = '';
  let fence = null;
  let buf = [];
  for (const line of text.split('\n')) {
    if (fence === 'mermaid') {
      if (line.startsWith('```')) { found.push({ heading, source: buf.join('\n') }); fence = null; buf = []; }
      else buf.push(line);
      continue;
    }
    if (fence) { if (line.startsWith('```')) fence = null; continue; }
    if (line === '```mermaid') { fence = 'mermaid'; continue; }
    if (line.startsWith('```')) { fence = 'other'; continue; }
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) heading = h[1].replace(/[`*]/g, '').trim();
  }
  return found;
}

function title(text, fallback) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const t = fm?.[1].match(/^title:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
  return t || text.match(/^# (.+)$/m)?.[1].trim() || fallback;
}

const pageName = (rel) => rel.replace(/\.md$/, '').split('/').join('.') + '.html';

const STYLE = `
:root { color-scheme: light dark; --bg: #fafaf9; --fg: #1c1917; --muted: #57534e; --card: #ffffff;
  --line: #e7e5e4; --link: #1d4ed8; }
@media (prefers-color-scheme: dark) { :root { --bg: #0c0a09; --fg: #f5f5f4; --muted: #a8a29e;
  --card: #1c1917; --line: #292524; --link: #93c5fd; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
header, main, footer { max-width: 1180px; margin: 0 auto; padding: 0 24px; }
header { padding-top: 32px; padding-bottom: 8px; }
h1 { font-size: 26px; margin: 4px 0; }
h2 { font-size: 17px; margin: 0 0 12px; }
.crumbs, .meta, footer { color: var(--muted); font-size: 13px; margin: 0; }
footer { padding-top: 8px; padding-bottom: 40px; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
.diagram { background: var(--card); border: 1px solid var(--line); border-radius: 10px;
  padding: 20px; margin: 20px 0; }
.frame { overflow-x: auto; }
pre.mermaid { margin: 0; text-align: center; background: transparent; }
details { margin-top: 12px; }
summary { cursor: pointer; color: var(--muted); font-size: 13px; }
pre.src { overflow-x: auto; margin: 8px 0 0; padding: 12px; border-radius: 6px; background: var(--bg);
  font: 12.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
.offline { color: var(--muted); }
.group h2 { margin: 28px 0 10px; }
ul.docs { list-style: none; padding: 0; margin: 0; background: var(--card);
  border: 1px solid var(--line); border-radius: 10px; }
ul.docs li { display: flex; justify-content: space-between; gap: 16px; padding: 10px 16px;
  border-top: 1px solid var(--line); }
ul.docs li:first-child { border-top: 0; }
.count { color: var(--muted); font-size: 13px; white-space: nowrap; }
`;

const head = (t) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t)}</title>
<style>${STYLE}</style>
</head>`;

function page({ docTitle, shown, src, items }) {
  const sections = items.map((d, i) => `
<section class="diagram" id="diagram-${i + 1}">
  <h2>${esc(d.label)}</h2>
  <div class="frame"><pre class="mermaid">
${esc(d.source)}
</pre></div>
  <details><summary>Mermaid source</summary><pre class="src">${esc(d.source)}</pre></details>
</section>`).join('');
  return `${head(`${docTitle} — diagrams`)}
<!-- Generated from ${shown} by scripts/build-diagrams.mjs. Do not edit: change the Markdown, then re-run the script. -->
<body>
<header>
  <p class="crumbs"><a href="index.html">All diagrams</a> · <a href="${src}">Source document</a></p>
  <h1>${esc(docTitle)}</h1>
  <p class="meta">${esc(shown)} · ${items.length} diagram${items.length === 1 ? '' : 's'}</p>
</header>
<main>${sections}
</main>
<footer><p class="offline" id="offline" hidden>Mermaid could not be loaded, probably because this machine is offline. Each diagram's source is shown instead.</p></footer>
<script src="${MERMAID}"></script>
<script>
  if (window.mermaid) {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    window.mermaid.initialize({ startOnLoad: true, theme: dark ? 'dark' : 'default', securityLevel: 'strict' });
  } else {
    document.getElementById('offline').hidden = false;
  }
</script>
</body>
</html>
`;
}

function index(entries, total) {
  const groups = new Map();
  for (const e of entries) {
    const g = e.group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  const body = [...groups].map(([g, list]) => `
<section class="group">
  <h2>${esc(g)}</h2>
  <ul class="docs">${list.map((e) => `
    <li><a href="${e.name}">${esc(e.docTitle)}</a><span class="count">${esc(e.shown)} · ${e.count} diagram${e.count === 1 ? '' : 's'}</span></li>`).join('')}
  </ul>
</section>`).join('');
  return `${head('Orchestra — diagrams')}
<!-- Generated by scripts/build-diagrams.mjs. Do not edit. -->
<body>
<header>
  <h1>Orchestra — diagrams</h1>
  <p class="meta">${total} diagrams across ${entries.length} documents, rendered from the Mermaid inline in the repository's Markdown. The Markdown is the source; these pages are regenerated with <code>node scripts/build-diagrams.mjs</code>.</p>
</header>
<main>${body}
</main>
<footer><p>Each page renders with Mermaid 11.4.1 from a CDN, the version CI parses with. Offline, pages show the diagram source.</p></footer>
</body>
</html>
`;
}

const pages = new Map();
const entries = [];
let total = 0;
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const found = diagrams(text);
  if (!found.length) continue;
  const fromRoot = relative(ROOT, file).split('\\').join('/');
  const inDocs = fromRoot.startsWith('docs/');
  const rel = inDocs ? fromRoot.slice('docs/'.length) : fromRoot;
  const docTitle = title(text, fromRoot);
  const seen = new Map();
  const items = found.map((d) => {
    const base = d.heading || docTitle;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...d, label: n > 1 ? `${base} (${n})` : base };
  });
  const name = (inDocs ? '' : 'repo.') + pageName(rel);
  const src = (inDocs ? '../../' : '../../../') + rel;
  const group = inDocs ? (rel.includes('/') ? rel.split('/')[0] : 'Documentation set') : 'Repository';
  pages.set(name, page({ docTitle, shown: fromRoot, src, items }));
  entries.push({ group, shown: fromRoot, docTitle, count: items.length, name });
  total += items.length;
}
if (!total) { console.error('No mermaid diagrams found in the repository. Refusing to pass vacuously.'); process.exit(1); }
pages.set('index.html', index(entries, total));

const existing = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith('.html')) : [];

if (CHECK) {
  const problems = [];
  for (const [name, html] of pages) {
    const p = join(OUT, name);
    if (!existsSync(p)) problems.push(`missing   ${name}`);
    else if (readFileSync(p, 'utf8') !== html) problems.push(`stale     ${name}`);
  }
  for (const f of existing) if (!pages.has(f)) problems.push(`orphaned  ${f}`);
  if (problems.length) {
    console.error(`\n${problems.length} HTML diagram page(s) do not match their Mermaid source:\n`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('\nRegenerate with: node scripts/build-diagrams.mjs\n');
    process.exit(1);
  }
  console.log(`Checked ${total} diagram(s) across ${entries.length} document(s).`);
  console.log('Every HTML page in docs/assets/diagrams/ matches its Mermaid source.');
} else {
  mkdirSync(OUT, { recursive: true });
  let written = 0;
  for (const [name, html] of pages) {
    const p = join(OUT, name);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== html) { writeFileSync(p, html); written++; }
  }
  let removed = 0;
  for (const f of existing) if (!pages.has(f)) { unlinkSync(join(OUT, f)); removed++; }
  console.log(`Rendered ${total} diagram(s) from ${entries.length} document(s) into docs/assets/diagrams/.`);
  console.log(`${written} page(s) written, ${removed} orphan(s) removed. Open docs/assets/diagrams/index.html.`);
}
