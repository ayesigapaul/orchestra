#!/usr/bin/env node
/**
 * Generates docs/docs.json — the Mintlify site configuration — from the documentation tree, and
 * maintains the section-index.md aliases the site needs. Zero dependencies.
 *
 * The filesystem is the source: a document added under docs/ appears in the published navigation
 * without anyone editing a config file. Hand-maintained navigation is how a docs site silently stops
 * matching the repository it came from.
 *
 * Two Mintlify behaviours shape this, both established by testing a running server rather than by
 * reading about them:
 *
 *   1. It will not serve a page named README — it treats README.md as a repository readme. It does
 *      redirect a directory to that README, which then 404s. That was the site's 404 on every
 *      section and on the home page. It does serve a page named index. So each directory holding a
 *      README.md gets a generated section-index.md copy beside it, and the navigation points there. The
 *      README stays the file people edit; the copy is a build artifact, checked byte-for-byte in CI.
 *      A symlink was tried first and works under `mint dev` but NOT in Mintlify's cloud build, which
 *      does not follow them — verified against the deployed site. Every other script in scripts/
 *      skips section-index.md so the copy is never counted as a second document.
 *
 *   2. It serves pages without the .md extension, so the ../section/page.md links that GitHub
 *      follows would 404. One redirect per page fixes that, including the README URLs, which point
 *      at the section root.
 *
 * Usage: node scripts/build-docs-nav.mjs           write docs.json and the aliases
 *        node scripts/build-docs-nav.mjs --check   fail if either is stale or missing
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.');
const DOCS = join(ROOT, 'docs');
const OUT = join(DOCS, 'docs.json');
const SKIP = new Set(['archive', 'assets', 'node_modules']);
const CHECK = process.argv.includes('--check');

const LABELS = {
  '': 'Start here',
  '00-overview': 'Overview',
  '10-architecture': 'Architecture',
  '20-domain': 'Domain model',
  '30-protocol': 'Protocol',
  '40-governance': 'Governance',
  '50-workflows': 'Workflows',
  '60-operations': 'Operations',
  '70-delivery': 'Delivery',
  '80-reference': 'Reference',
  adr: 'Decisions (ADR)',
  rfc: 'Proposals (RFC)',
};
const label = (d) => LABELS[d] ?? d.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

function walk(dir, out = []) {
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (entry === 'section-index.md') continue; // a generated copy of README.md, not a document
    if (statSync(p).isDirectory()) { if (!SKIP.has(entry)) walk(p, out); }
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const problems = [];
let created = 0;

/** A directory's README.md needs an section-index.md copy beside it: Mintlify will not serve README. */
function ensureAlias(dir) {
  const readme = join(DOCS, dir, 'README.md');
  const alias = join(DOCS, dir, 'section-index.md');
  const want = readFileSync(readme, 'utf8');
  if (existsSync(alias) && readFileSync(alias, 'utf8') === want) return;
  if (CHECK) { problems.push(`stale or missing: docs/${dir ? dir + '/' : ''}section-index.md (copy of README.md)`); return; }
  writeFileSync(alias, want);
  created++;
}

const groups = new Map();
const entries = [];
for (const file of walk(DOCS)) {
  const rel = relative(DOCS, file).split('\\').join('/');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  const base = rel.replace(/\.md$/, '');
  const isReadme = base === 'README' || base.endsWith('/README');
  if (isReadme) ensureAlias(dir);
  const nav = isReadme ? (dir ? `${dir}/section-index` : 'section-index') : base;
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(nav);
  entries.push({ base, nav, isReadme, dir });
}

const ordered = [...groups.entries()]
  .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  .map(([dir, pages]) => ({
    group: label(dir),
    pages: pages.sort((a, b) => {
      const ia = a === 'section-index' || a.endsWith('/section-index');
      const ib = b === 'section-index' || b.endsWith('/section-index');
      return ia === ib ? a.localeCompare(b) : ia ? -1 : 1;
    }),
  }));

const redirects = [];
for (const e of entries.sort((a, b) => a.base.localeCompare(b.base))) {
  if (e.isReadme) {
    // Point the directory URL and both README URLs at the generated page. Mintlify redirects a
    // directory to its README on its own and then cannot serve it, so these are explicit.
    const target = `/${e.nav}`;
    if (e.dir) redirects.push({ source: `/${e.dir}`, destination: target });
    else redirects.push({ source: '/', destination: target });
    redirects.push({ source: `/${e.base}`, destination: target });
    redirects.push({ source: `/${e.base}.md`, destination: target });
  } else {
    redirects.push({ source: `/${e.nav}.md`, destination: `/${e.nav}` });
  }
}

const config = {
  $schema: 'https://mintlify.com/docs.json',
  theme: 'mint',
  name: 'Orchestra',
  // Site description for SEO and AI indexing. Kept here rather than in the Mintlify dashboard:
  // dashboard edits commit to docs.json, which this script regenerates, so they would be lost.
  description:
    'Orchestra is the governance layer for enterprise AI agents. Every consequential action is ' +
    'checked against policy, approved by a person where required, and recorded as durable evidence.',
  colors: { primary: '#10218b', light: '#7b8bf4', dark: '#081149' },
  logo: {
    light: '/assets/logo/orchestra-lockup-light.svg',
    dark: '/assets/logo/orchestra-lockup-dark.svg',
    href: '/',
  },
  favicon: '/assets/logo/favicon.svg',
  navigation: { tabs: [{ tab: 'Documentation', groups: ordered }] },
  redirects,
};
const json = JSON.stringify(config, null, 2) + '\n';
const pages = ordered.reduce((n, g) => n + g.pages.length, 0);

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) problems.push('docs/docs.json does not match the documentation tree');
  if (problems.length) {
    console.error(`\n${problems.length} problem(s) with the published site configuration:\n`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    console.error('\nRegenerate with: node scripts/build-docs-nav.mjs\n');
    process.exit(1);
  }
  console.log(`Checked ${pages} page(s) across ${ordered.length} group(s), and every section index alias.`);
  console.log('docs/docs.json matches the documentation tree.');
} else {
  writeFileSync(OUT, json);
  console.log(`Wrote docs/docs.json — ${pages} page(s), ${ordered.length} group(s), ${redirects.length} redirect(s).`);
  console.log(`${created} index copy/copies written.`);
}
