#!/usr/bin/env node
/**
 * Parses every ```mermaid block in the repository with the real mermaid parser,
 * so a broken diagram fails CI rather than rendering as an error box on GitHub.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { JSDOM } from 'jsdom';

const ROOT = resolve(process.argv[2] ?? '.');
const SKIP = new Set(['node_modules', '.git', '.next', 'archive', 'dist', 'build']);

const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node 22 defines globalThis.navigator as a getter-only accessor, so plain assignment throws.
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.DOMPurify = { sanitize: (s) => s, addHook: () => {} };

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
      // index.md is a generated copy of the directory's README.md, written by
      // scripts/build-docs-nav.mjs because Mintlify will not serve a page named README and its
      // cloud build does not follow symlinks. Reading it would count the document twice.
      if (entry === 'index.md') continue;
    if (statSync(p).isDirectory()) { if (!SKIP.has(entry)) walk(p, out); }
    else if (entry.endsWith('.md')) out.push(p);
  }
  return out;
}

let blocks = 0;
const failures = [];

for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const matches = [...text.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)];
  for (const [i, m] of matches.entries()) {
    blocks++;
    try {
      await mermaid.parse(m[1]);
    } catch (err) {
      failures.push(`${relative(ROOT, file)} (block ${i + 1}): ${err.message?.split('\n')[0] ?? err}`);
    }
  }
}

console.log(`Parsed ${blocks} mermaid block(s).`);
if (failures.length) {
  console.error(`\n${failures.length} diagram(s) failed to parse:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('All mermaid diagrams parse.');
