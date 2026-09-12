#!/usr/bin/env node
/**
 * Enforces ADR-0020: services share a repository, never code. Zero dependencies.
 *
 * A boundary that exists only by convention erodes at the first deadline, so the rules that can be
 * checked mechanically are checked here, in CI, for every service under services/ and every front
 * end under apps/:
 *
 *   B1  each has its own manifest and lockfile
 *   B2  no workspace spans services; no path, file:, link: or workspace: dependency leaves the
 *       directory; no import reaches another service; no Dockerfile copies from outside its context
 *   ADR-0016  no Elastic-2.0 LangGraph server package appears in any lockfile or manifest
 *
 * Usage: node scripts/check-service-boundaries.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const ROOTS = ['services', 'apps'];
const SKIP = new Set(['node_modules', '.venv', '.git', '.next', 'dist', 'build', '__pycache__']);
const DENYLIST = ['langgraph-api', 'langgraph-runtime-inmem'];

const errors = [];
const fail = (path, msg) => errors.push(`${relative(ROOT, path) || '.'}: ${msg}`);
const read = (p) => readFileSync(p, 'utf8');
const inside = (base, target) => {
  const r = relative(base, target);
  return r === '' || (!r.startsWith('..') && !r.startsWith(sep) && !resolve(target).startsWith('..'));
};

function files(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) files(p, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(p);
  }
  return out;
}

// No workspace at the repository root: a root workspace would resolve every service together.
if (existsSync(join(ROOT, 'pnpm-workspace.yaml'))) fail(join(ROOT, 'pnpm-workspace.yaml'), 'a root pnpm workspace spans services (B2)');
if (existsSync(join(ROOT, 'pyproject.toml')) && /\[tool\.uv\.workspace\]/.test(read(join(ROOT, 'pyproject.toml')))) {
  fail(join(ROOT, 'pyproject.toml'), 'a root uv workspace spans services (B2)');
}
if (existsSync(join(ROOT, 'package.json')) && /"workspaces"\s*:/.test(read(join(ROOT, 'package.json')))) {
  fail(join(ROOT, 'package.json'), 'root package.json declares workspaces (B2)');
}

const units = [];
for (const r of ROOTS) {
  const base = join(ROOT, r);
  if (!existsSync(base)) continue;
  for (const name of readdirSync(base).sort()) {
    const dir = join(base, name);
    if (statSync(dir).isDirectory() && !name.startsWith('.')) units.push({ name, dir, kind: r });
  }
}

// Python package names each Python service owns, so an import of another service's package is
// detectable. Only a service with a pyproject.toml counts: a TypeScript service's src/domain is a
// folder rather than a Python package, and would otherwise claim the name "domain" for itself.
const pyPackages = new Map();
for (const u of units) {
  const src = join(u.dir, 'src');
  if (!existsSync(join(u.dir, 'pyproject.toml')) || !existsSync(src)) continue;
  for (const pkg of readdirSync(src)) if (statSync(join(src, pkg)).isDirectory()) pyPackages.set(pkg, u.name);
}

for (const u of units) {
  const py = existsSync(join(u.dir, 'pyproject.toml'));
  const node = existsSync(join(u.dir, 'package.json'));
  if (!py && !node) { fail(u.dir, 'no pyproject.toml or package.json — a service owns its manifest (B1)'); continue; }

  if (py) {
    const manifest = read(join(u.dir, 'pyproject.toml'));
    if (!existsSync(join(u.dir, 'uv.lock'))) fail(u.dir, 'no uv.lock — a service owns its lockfile (B1)');
    if (/\[tool\.uv\.workspace\]/.test(manifest)) fail(join(u.dir, 'pyproject.toml'), 'declares a uv workspace (B2)');
    for (const m of manifest.matchAll(/path\s*=\s*"([^"]+)"/g)) {
      if (!inside(u.dir, resolve(u.dir, m[1]))) fail(join(u.dir, 'pyproject.toml'), `path dependency "${m[1]}" leaves the service (B2)`);
    }
    for (const f of files(u.dir, ['.py'])) {
      const text = read(f);
      for (const m of text.matchAll(/^\s*(?:from|import)\s+([A-Za-z_]\w*)/gm)) {
        const owner = pyPackages.get(m[1]);
        if (owner && owner !== u.name) fail(f, `imports "${m[1]}", which belongs to service "${owner}" (B2)`);
      }
      if (/sys\.path\.(?:insert|append)\([^)]*\.\./.test(text)) fail(f, 'adds a parent directory to sys.path (B2)');
    }
  }

  if (node) {
    const pkg = JSON.parse(read(join(u.dir, 'package.json')));
    if (!existsSync(join(u.dir, 'pnpm-lock.yaml'))) fail(u.dir, 'no pnpm-lock.yaml — a service owns its lockfile (B1)');
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const [dep, spec] of Object.entries(pkg[field] ?? {})) {
        if (typeof spec !== 'string') continue;
        if (spec.startsWith('workspace:')) fail(join(u.dir, 'package.json'), `"${dep}" uses a workspace: dependency (B2)`);
        const m = spec.match(/^(?:file|link|portal):(.+)$/);
        if (m && !inside(u.dir, resolve(u.dir, m[1]))) fail(join(u.dir, 'package.json'), `"${dep}" points outside the service (B2)`);
      }
    }
    for (const f of files(u.dir, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])) {
      const text = read(f);
      for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]*)['"]/g)) {
        if (!inside(u.dir, resolve(dirname(f), m[1]))) fail(f, `import "${m[1]}" reaches outside the service (B2)`);
      }
    }
  }

  const dockerfile = join(u.dir, 'Dockerfile');
  if (existsSync(dockerfile)) {
    for (const m of read(dockerfile).matchAll(/^\s*(?:COPY|ADD)\s+(?!--from)([^\n]+)$/gim)) {
      if (m[1].split(/\s+/).slice(0, -1).some((src) => src.includes('..'))) fail(dockerfile, `copies from outside the build context: ${m[1].trim()} (B1)`);
    }
  }
}

// ADR-0016: the Elastic-2.0 server tier is out of bounds, and a transitive install is nobody's decision.
for (const u of units) {
  for (const f of files(u.dir, ['uv.lock', 'pnpm-lock.yaml', 'pyproject.toml', 'package.json'])) {
    const text = read(f);
    for (const name of DENYLIST) {
      if (new RegExp(`(^|[^\\w-])${name}([^\\w-]|$)`, 'm').test(text)) fail(f, `depends on ${name}, an Elastic-2.0 package ADR-0016 excludes`);
    }
  }
}

if (errors.length) {
  console.error(`\n${errors.length} service boundary violation(s) — see ADR-0020:\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}
console.log(`Checked ${units.length} service(s): ${units.map((u) => `${u.kind}/${u.name}`).join(', ') || 'none yet'}.`);
console.log('No workspace, path dependency, cross-service import or excluded licence found.');
