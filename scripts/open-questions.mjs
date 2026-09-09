#!/usr/bin/env node
/**
 * Orchestra open-questions index — zero dependencies.
 *
 * Every specification document ends with an open-questions register. They are the single source of
 * truth and this script never writes to them; it only reads. A seventh copy of the list would drift
 * from the registers the moment one changed, and drift in a decision log is worse than no log.
 *
 * Two modes:
 *   node scripts/open-questions.mjs           report, ADR-required questions first
 *   node scripts/open-questions.mjs --check    fail if a register defers to a document that
 *                                              neither exists nor is planned by a section README
 *
 * The --check mode exists because of a real failure: five questions were once deferred into
 * documents that never received them. A register row naming a decider nobody will write is a
 * question that has been filed rather than answered.
 *
 * Registers vary in shape — some carry an explicit "ADR required?" column, some fold the marker
 * into a "Needs" column, some have neither — so column roles are resolved from the header.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, basename } from 'node:path';

const ROOT = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.');
const DOCS = join(ROOT, 'docs');
const CHECK = process.argv.includes('--check');
const SKIP_DIRS = new Set(['archive', 'node_modules', '.git']);

/** Recursively collect markdown files, skipping archived and vendored trees. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(p, out);
    } else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

/** Split a markdown table row into trimmed cells, tolerating leading and trailing pipes. */
const cells = (line) =>
  line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());

const isSeparator = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

/**
 * Extract every register row from one document. A register is the first markdown table appearing
 * under a heading matching "open questions"; some documents carry more than one table under it.
 */
function registerRows(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rows = [];
  let inSection = false;
  let header = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(/^(#{2,4})\s+(.*)$/);
    if (heading) {
      // A new heading of the same or higher level ends the register section.
      inSection = /open questions?/i.test(heading[2]);
      header = null;
      continue;
    }
    if (!inSection) continue;

    if (/^\s*\|/.test(line) && !isSeparator(line)) {
      const c = cells(line);
      if (!header) {
        header = c.map((h) => h.toLowerCase().replace(/\*\*/g, ''));
        continue;
      }
      if (c.length < 2 || !c[0]) continue;
      rows.push({ file, header, cells: c });
    } else if (line.trim() === '' && header) {
      header = null; // blank line ends a table; a later one under the same heading starts fresh
    }
  }
  return rows;
}

/** Which column carries what, resolved per table rather than assumed. */
function roles(header) {
  const find = (re) => header.findIndex((h) => re.test(h));
  const adrCol = find(/adr/);
  let deciderCol = find(/decid|would decide|owner|home/);
  if (deciderCol === -1) deciderCol = header.length - 1;
  return { adrCol, deciderCol };
}

const ADR_MARK = /\bADR\b/i;
const YES_MARK = /^\s*(\*\*)?yes(\*\*)?\b/i;

function needsAdr(row) {
  const { adrCol } = roles(row.header);
  if (adrCol !== -1) {
    const v = row.cells[adrCol] || '';
    return ADR_MARK.test(v) || YES_MARK.test(v);
  }
  // No dedicated column: a bolded ADR marker anywhere in the row counts.
  return row.cells.some((c) => /\*\*ADR\*\*/i.test(c));
}

/** Document paths a cell refers to, whether backticked or written as a markdown link. */
function referencedDocs(cell) {
  const out = new Set();
  for (const m of cell.matchAll(/`([^`]+\.md)`/g)) out.add(m[1]);
  for (const m of cell.matchAll(/\]\(([^)]+\.md)\)/g)) out.add(m[1]);
  for (const m of cell.matchAll(/`([a-z0-9-]+\/)`/g)) out.add(m[1]);
  return [...out];
}

/**
 * Documents a section README lists as planned, so a not-yet-written decider is not an error.
 * Returns full repo-relative paths and bare basenames: a register legitimately writes the filename
 * and its directory as separate tokens — "`execution-semantics.md` in [`../50-workflows/`](...)" —
 * so a bare name must not be resolved against the citing document's own directory.
 */
function plannedDocuments() {
  const paths = new Set();
  const names = new Set();
  for (const readme of walk(DOCS).filter((f) => basename(f) === 'README.md')) {
    const dir = dirname(readme);
    for (const m of readFileSync(readme, 'utf8').matchAll(/^[-*]\s+`?\[?`?([^`\]]+\.md)`?\]?/gm)) {
      paths.add(relative(ROOT, join(dir, m[1])));
      names.add(basename(m[1]));
    }
  }
  for (const f of files) names.add(basename(f));
  return { paths, names };
}

const files = walk(DOCS);
const rows = files.flatMap(registerRows);

if (rows.length === 0) {
  console.error('No open-questions registers found. Refusing to pass vacuously.');
  process.exit(1);
}

if (CHECK) {
  const planned = plannedDocuments();
  const problems = [];
  for (const row of rows) {
    const { deciderCol } = roles(row.header);
    const cell = row.cells[deciderCol] || '';
    for (const ref of referencedDocs(cell)) {
      if (ref.endsWith('/')) continue; // a section, not a document
      // A bare filename names a document whose directory the row gives separately; match by name.
      if (!ref.includes('/')) {
        if (planned.names.has(ref)) continue;
        problems.push(
          `${relative(ROOT, row.file)}: defers to "${ref}", which no section README plans and no ` +
            `document is named\n    question: ${row.cells[0].slice(0, 96)}`
        );
        continue;
      }
      const fromDoc = resolve(dirname(row.file), ref);
      const fromDocs = resolve(DOCS, ref.replace(/^\.\.\//, ''));
      if (existsSync(fromDoc) || existsSync(fromDocs)) continue;
      if (planned.paths.has(relative(ROOT, fromDoc)) || planned.paths.has(relative(ROOT, fromDocs))) continue;
      problems.push(
        `${relative(ROOT, row.file)}: defers to "${ref}", which does not exist and is not listed as ` +
          `a planned document by any section README\n    question: ${row.cells[0].slice(0, 96)}`
      );
    }
  }
  if (problems.length) {
    console.error(`\n${problems.length} unresolvable decider reference(s):\n`);
    for (const p of problems) console.error(`  ${p}\n`);
    process.exit(1);
  }
  console.log(`Checked ${rows.length} open question(s) across ${new Set(rows.map((r) => r.file)).size} register(s).`);
  console.log('Every register defers to a document that exists or is planned.');
  process.exit(0);
}

const adr = rows.filter(needsAdr);
const later = rows.filter((r) => !needsAdr(r));

const show = (list, title) => {
  console.log(`\n${title} — ${list.length}\n${'='.repeat(title.length + 6)}`);
  let current = '';
  for (const row of list) {
    const doc = relative(ROOT, row.file);
    if (doc !== current) {
      current = doc;
      console.log(`\n  ${doc}`);
    }
    const { deciderCol } = roles(row.header);
    const q = row.cells[0].replace(/\s+/g, ' ');
    const by = (row.cells[deciderCol] || '').replace(/\s+/g, ' ').replace(/\*\*/g, '');
    console.log(`    - ${q.length > 104 ? q.slice(0, 101) + '...' : q}`);
    if (by) console.log(`      decided by: ${by.length > 96 ? by.slice(0, 93) + '...' : by}`);
  }
};

show(adr, 'Needs an ADR');
show(later, 'Settled by a later document');

console.log(
  `\n${rows.length} open question(s) across ${new Set(rows.map((r) => r.file)).size} register(s). ` +
    `${adr.length} need an ADR.\n`
);
