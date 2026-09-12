#!/usr/bin/env node
/**
 * Generates docs/docs.json — the Mintlify site configuration — from the documentation tree.
 * Zero dependencies.
 *
 * The filesystem is the source: a document added under docs/ appears in the published navigation
 * without anyone remembering to edit a config file. Hand-maintained navigation is how a docs site
 * silently stops matching the repository it came from.
 *
 * Titles come from each document's front matter, which docs/README.md section 3 already requires
 * and scripts/validate-docs.mjs already enforces.
 *
 * Usage: node scripts/build-docs-nav.mjs           write docs/docs.json
 *        node scripts/build-docs-nav.mjs --check   fail if docs.json is stale
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? '.');
const DOCS = join(ROOT, 'docs');
const OUT = join(DOCS, 'docs.json');
const SKIP = new Set(['archive', 'assets', 'node_modules']);
const CHECK = process.argv.includes('--check');

// Directory labels. Anything unlisted is prettified from its name, so a new section still appears.
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
    if (statSync(p).isDirectory()) { if (!SKIP.has(entry)) walk(p, out); }
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

const groups = new Map();
for (const file of walk(DOCS)) {
  const rel = relative(DOCS, file).split('\\').join('/');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(rel.replace(/\.md$/, ''));
}

// README first inside a group — it is the section's own index — then the rest in path order.
const ordered = [...groups.entries()]
  .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
  .map(([dir, pages]) => ({
    group: label(dir),
    pages: pages.sort((a, b) => {
      const ra = a.endsWith('/README') || a === 'README';
      const rb = b.endsWith('/README') || b === 'README';
      return ra === rb ? a.localeCompare(b) : ra ? -1 : 1;
    }),
  }));

// Our documents link to each other as ../section/page.md, which is what GitHub renders and what
// scripts/validate-docs.mjs checks on disk. Mintlify serves pages without the extension, so every
// such link would 404. One redirect per page maps the .md URL onto the real one, which keeps a
// single source instead of rewriting 2000+ links into a form GitHub cannot follow.
const redirects = ordered.flatMap((g) => g.pages.map((p) => ({ source: `/${p}.md`, destination: `/${p}` })));

const config = {
  $schema: 'https://mintlify.com/docs.json',
  theme: 'mint',
  name: 'Orchestra',
  colors: { primary: '#1f6f43', light: '#4ade80', dark: '#0d3b24' },
  navigation: { tabs: [{ tab: 'Documentation', groups: ordered }] },
  redirects,
};
const json = JSON.stringify(config, null, 2) + '\n';
const pages = ordered.reduce((n, g) => n + g.pages.length, 0);

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) {
    console.error('docs/docs.json does not match the documentation tree.');
    console.error('Regenerate with: node scripts/build-docs-nav.mjs');
    process.exit(1);
  }
  console.log(`Checked ${pages} page(s) across ${ordered.length} group(s): docs/docs.json matches the tree.`);
} else {
  writeFileSync(OUT, json);
  console.log(`Wrote docs/docs.json — ${pages} page(s), ${ordered.length} group(s), ${redirects.length} redirect(s).`);
}
