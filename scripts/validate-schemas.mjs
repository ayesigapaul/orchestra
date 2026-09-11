#!/usr/bin/env node
/**
 * Orchestra JSON Schema validator — zero dependencies.
 *
 * The schemas under docs/30-protocol/schemas/ are the source of truth for every wire
 * contract, and three of the rules that govern them fail silently. A schema that stops
 * parsing, an $id that drifts from its filename, or an `additionalProperties: false`
 * added in passing all look like working documents until a consumer breaks on a field
 * it was promised it could ignore. This makes CI the control rather than a reviewer's
 * memory, which is the same argument ADR-0011 makes for row-level security.
 *
 * Enforces:
 *   1. Every .schema.json parses
 *   2. $schema is Draft 2020-12
 *   3. $id agrees with the filename and sits under the published base URI
 *   4. additionalProperties is NEVER false, anywhere (docs/VERSIONING.md §6, rule R3)
 *   5. The file set, docs/VERSIONING.md §6 and schemas/README.md agree with each other
 *   6. Every schema carries a title and a description
 *
 * Usage: node scripts/validate-schemas.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const DIR = join(ROOT, 'docs', '30-protocol', 'schemas');
const VERSIONING = join(ROOT, 'docs', 'VERSIONING.md');
const README = join(DIR, 'README.md');
const BASE = 'https://raw.githubusercontent.com/ayesigapaul/orchestra/main/docs/30-protocol/schemas/';
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const errors = [];
const fail = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);

/** Walk every subschema, reporting the JSON Pointer of each `additionalProperties: false`. */
function findClosedObjects(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findClosedObjects(item, `${path}/${i}`, out));
    return out;
  }
  if (node === null || typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'additionalProperties' && value === false) out.push(`${path}/${key}`);
    findClosedObjects(value, `${path}/${key}`, out);
  }
  return out;
}

if (!existsSync(DIR)) {
  console.error(`${relative(ROOT, DIR)} does not exist.`);
  process.exit(1);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

if (files.length === 0) {
  console.error(`${relative(ROOT, DIR)} contains no schemas.`);
  process.exit(1);
}

for (const file of files) {
  const path = join(DIR, file);

  if (!/^[a-z0-9-]+\.v[0-9]+\.schema\.json$/.test(file)) {
    fail(path, 'filename does not match <entity>.v<MAJOR>.schema.json');
    continue;
  }

  let schema;
  try {
    schema = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(path, `does not parse: ${err.message}`);
    continue;
  }

  if (schema.$schema !== DIALECT) {
    fail(path, `$schema is "${schema.$schema}", expected "${DIALECT}"`);
  }

  const expectedId = BASE + file;
  if (schema.$id !== expectedId) {
    fail(path, `$id is "${schema.$id}", expected "${expectedId}"`);
  }

  const major = file.match(/\.v([0-9]+)\.schema\.json$/)[1];
  if (schema.$id && !schema.$id.includes(`.v${major}.`)) {
    fail(path, `$id does not embed the major version v${major}`);
  }

  for (const key of ['title', 'description']) {
    if (typeof schema[key] !== 'string' || schema[key].trim() === '') {
      fail(path, `missing ${key}`);
    }
  }

  for (const pointer of findClosedObjects(schema, '#', [])) {
    fail(path, `additionalProperties: false at ${pointer} — forbidden by VERSIONING.md §6, which rule R3 depends on`);
  }
}

// The file set, the VERSIONING listing and the section README must not drift apart.
const versioning = readFileSync(VERSIONING, 'utf8');
const readme = readFileSync(README, 'utf8');

for (const file of files) {
  if (!versioning.includes(file)) fail(VERSIONING, `§6 does not list ${file}`);
  if (!readme.includes(file)) fail(README, `does not list ${file}`);
}

for (const listed of versioning.match(/[a-z0-9-]+\.v[0-9]+\.schema\.json/g) ?? []) {
  if (!files.includes(listed)) fail(VERSIONING, `§6 lists ${listed}, which does not exist`);
}

if (errors.length) {
  console.error(`\n${errors.length} schema error(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`Checked ${files.length} schema(s) against VERSIONING.md §6.`);
console.log('All schemas parse, carry a correct $id, and leave every wire-facing object open.');
