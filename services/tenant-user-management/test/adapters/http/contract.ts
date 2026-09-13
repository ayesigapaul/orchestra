// Checks a response against this service's OpenAPI document (HC15). The document is a copy that
// scripts/build-openapi.mjs keeps identical to docs/30-protocol/openapi, because a service reads
// nothing outside its own directory (ADR-0020).
import { readFileSync } from 'node:fs';
import ajv2020 from 'ajv/dist/2020.js';
import { expect } from 'vitest';
import { parse } from 'yaml';
import {
  type ErrorObject,
  MEDIA_TYPE,
  REQUEST_ID_HEADER,
} from '../../../src/adapters/http/json-api.ts';

interface Node {
  readonly $ref?: string;
  readonly required?: boolean;
  readonly headers?: Record<string, Node>;
  readonly responses?: Record<string, Node>;
}

export interface Body {
  readonly jsonapi?: { readonly version: string };
  readonly data?: unknown;
  readonly meta?: Record<string, unknown>;
  readonly errors?: readonly ErrorObject[];
}

const documentUrl = new URL('../../../openapi.yaml', import.meta.url);
const document: unknown = parse(readFileSync(documentUrl, 'utf8'));
const ajv = new ajv2020.default({ strict: false, allErrors: true, validateFormats: false });
ajv.addSchema(document as object, 'openapi');

const escape = (token: string) => token.replaceAll('~', '~0').replaceAll('/', '~1');

// Resolves a local $ref, returning the pointer that was reached and the node there.
function follow(node: Node, pointer: string): [string, Node] {
  if (node.$ref === undefined) return [pointer, node];
  const target = node.$ref.replace(/^#/, '');
  let value: unknown = document;
  for (const token of target.split('/').slice(1)) {
    value = (value as Record<string, unknown>)[token.replaceAll('~1', '/').replaceAll('~0', '~')];
  }
  return [target, value as Node];
}

async function expectBody(res: Response, schemaPointer: string): Promise<Body> {
  expect(res.headers.get('content-type')).toBe(MEDIA_TYPE);
  const body = (await res.json()) as Body;
  const validate = ajv.compile({ $ref: `openapi#${schemaPointer}` });
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
  for (const error of body.errors ?? []) expect(error.id).toBe(res.headers.get(REQUEST_ID_HEADER));
  return body;
}

/** The response is one its operation documents: a listed status, headers and body. */
export async function expectDocumented(res: Response, path: string, method: string): Promise<Body> {
  const operation = `/paths/${escape(path)}/${method.toLowerCase()}`;
  const [, { responses = {} }] = follow({ $ref: `#${operation}` }, operation);
  const listed = responses[String(res.status)];
  expect(listed, `${method} ${path} answered ${res.status}, which is not documented`).toBeDefined();
  const [pointer, response] = follow(listed ?? {}, `${operation}/responses/${res.status}`);
  for (const [name, header] of Object.entries(response.headers ?? {})) {
    const [, resolved] = follow(header, '');
    if (resolved.required) expect(res.headers.has(name), `required header ${name}`).toBe(true);
  }
  return expectBody(res, `${pointer}/content/${escape(MEDIA_TYPE)}/schema`);
}

/** A failure on a path or method with no operation is still an error document. */
export function expectErrorDocument(res: Response): Promise<Body> {
  return expectBody(res, '/components/schemas/ErrorDocument');
}
