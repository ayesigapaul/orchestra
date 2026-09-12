#!/usr/bin/env node
/**
 * Orchestra documentation validator — zero dependencies.
 *
 * Enforces the conventions in docs/README.md §3 and docs/VERSIONING.md:
 *   1. Front matter present and complete on every non-archived document
 *   2. Status values drawn from the permitted lifecycle
 *   3. doc_id uniqueness
 *   4. ADR filename, adr_id and title agree
 *   5. The ADR index lists every ADR, and every indexed ADR exists
 *   6. Relative links resolve on disk
 *   7. Mermaid fences are balanced and non-empty
 *
 * Usage: node scripts/validate-docs.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const DOCS = join(ROOT, 'docs');
const SKIP_DIRS = new Set(['archive', 'node_modules', '.git']);

const DOC_STATUS = ['Draft', 'In Review', 'Approved', 'Superseded', 'Deprecated'];
const ADR_STATUS = ['Proposed', 'Accepted', 'Rejected', 'Superseded', 'Deprecated'];

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

/** Recursively collect markdown files, skipping archive and vendored trees. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
      // section-index.md is a generated copy of the directory's README.md, written by
      // scripts/build-docs-nav.mjs because Mintlify will not serve a page named README and its
      // cloud build does not follow symlinks. Reading it would count the document twice.
      if (entry === 'section-index.md') continue;
    if (statSync(p).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(p, out);
    } else if (entry.endsWith('.md')) {
      out.push(p);
    }
  }
  return out;
}

/** Minimal YAML front-matter reader: scalars and inline [a, b] lists only, which is all we use. */
function frontMatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(4, end);
  const out = {};
  for (const line of block.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) continue;
    let [, key, value] = m;
    value = value.trim().replace(/^["'](.*)["']$/, '$1');
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1).trim();
      out[key] = inner ? inner.split(',').map((s) => s.trim().replace(/^["'](.*)["']$/, '$1')) : [];
    } else {
      out[key] = value;
    }
  }
  return out;
}

const files = walk(DOCS);
if (files.length === 0) {
  console.error('No documents found under docs/. Refusing to pass vacuously.');
  process.exit(1);
}

const docIds = new Map();
const adrFiles = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const fm = frontMatter(text);

  if (!fm) {
    fail(file, 'missing YAML front matter');
    continue;
  }

  const isAdr = file.includes(`${sep}adr${sep}`) && /adr-\d{4}-/.test(file);
  const isTemplate = /(?:adr-)?template\.md$/.test(file);

  if (!fm.title) fail(file, 'front matter missing "title"');

  if (isAdr) {
    adrFiles.push({ file, fm });
    for (const key of ['adr_id', 'status', 'date', 'deciders']) {
      if (!fm[key]) fail(file, `ADR front matter missing "${key}"`);
    }
    if (fm.status && !ADR_STATUS.some((s) => String(fm.status).startsWith(s))) {
      fail(file, `invalid ADR status "${fm.status}" (expected one of: ${ADR_STATUS.join(', ')})`);
    }
    const numFromName = file.match(/adr-(\d{4})-/)?.[1];
    const numFromId = String(fm.adr_id ?? '').match(/ADR-(\d{4})/)?.[1];
    if (numFromName && numFromId && numFromName !== numFromId) {
      fail(file, `adr_id ${fm.adr_id} does not match filename number ${numFromName}`);
    }
    if (fm.date && !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) {
      fail(file, `date "${fm.date}" is not ISO 8601 (YYYY-MM-DD)`);
    }
  } else if (!isTemplate) {
    for (const key of ['doc_id', 'version', 'status', 'last_updated', 'owners']) {
      if (!fm[key]) fail(file, `front matter missing "${key}"`);
    }
    if (fm.status && !DOC_STATUS.includes(fm.status)) {
      fail(file, `invalid status "${fm.status}" (expected one of: ${DOC_STATUS.join(', ')})`);
    }
    if (fm.version && !/^\d+\.\d+\.\d+$/.test(fm.version)) {
      fail(file, `version "${fm.version}" is not SemVer`);
    }
    if (fm.last_updated && !/^\d{4}-\d{2}-\d{2}$/.test(fm.last_updated)) {
      fail(file, `last_updated "${fm.last_updated}" is not ISO 8601 (YYYY-MM-DD)`);
    }
    if (fm.doc_id) {
      if (docIds.has(fm.doc_id)) {
        fail(file, `doc_id ${fm.doc_id} already used by ${relative(ROOT, docIds.get(fm.doc_id))}`);
      } else {
        docIds.set(fm.doc_id, file);
      }
    }
  }

  // Mermaid fences balanced and non-empty
  const fences = [...text.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)];
  const opens = (text.match(/^```mermaid$/gm) ?? []).length;
  if (opens !== fences.length) fail(file, `${opens} mermaid fence(s) opened but ${fences.length} closed`);
  fences.forEach((m, i) => {
    if (!m[1].trim()) fail(file, `mermaid block ${i + 1} is empty`);
  });

  // Relative links resolve on disk
  const body = text.slice(text.indexOf('\n---', 3) + 4);
  for (const m of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = resolve(dirname(file), href.split('#')[0]);
    if (!existsSync(target)) fail(file, `broken relative link: ${href}`);
  }
}

// ADR index consistency
const indexPath = join(DOCS, 'adr', 'README.md');
if (existsSync(indexPath)) {
  const index = readFileSync(indexPath, 'utf8');
  for (const { file, fm } of adrFiles) {
    const base = file.split(sep).pop();
    if (!index.includes(base)) fail(indexPath, `does not list ${base}`);
    if (fm.status && !index.includes(String(fm.status).split(' ')[0])) {
      warn(indexPath, `status "${fm.status}" for ${fm.adr_id} may be stale in the index table`);
    }
  }
  for (const m of index.matchAll(/\((adr-\d{4}-[a-z0-9-]+\.md)\)/g)) {
    if (!existsSync(join(DOCS, 'adr', m[1]))) fail(indexPath, `lists non-existent ADR ${m[1]}`);
  }
} else {
  fail(indexPath, 'ADR index is missing');
}

// Report
console.log(`Checked ${files.length} document(s), ${adrFiles.length} ADR(s), ${docIds.size} doc_id(s).`);
for (const w of warnings) console.log(`  warning  ${w}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  for (const e of errors) console.error(`  error    ${e}`);
  process.exit(1);
}
console.log('All documentation checks passed.');
