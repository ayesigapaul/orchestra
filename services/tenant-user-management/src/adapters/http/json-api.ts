// The HTTP contract: JSON:API 1.1 documents, and one error layer for every failure (ADR-0025, whose
// rules are docs/30-protocol/http-conventions.md). Every failure is mapped here, so a framework's
// default error body never reaches a client (HC13), and each code carries the status, title and
// retry safety that document's section 4 registers for it. Codes are added as operations need them.
import { randomUUID } from 'node:crypto';
import type { Context, Handler, Hono, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const MEDIA_TYPE = 'application/vnd.api+json';
export const REQUEST_ID_HEADER = 'Orchestra-Request-Id';

export type Retry = 'safe' | 'unsafe' | 'indeterminate';

export interface Code {
  readonly name: string;
  readonly status: ContentfulStatusCode;
  readonly title: string;
  readonly retry: Retry;
}

export const codes = {
  invalidParameter: {
    name: 'request.invalid_parameter',
    status: 400,
    title: 'A query parameter is unknown or malformed',
    retry: 'unsafe',
  },
  methodNotAllowed: {
    name: 'request.method_not_allowed',
    status: 405,
    title: 'This method is not allowed on this path',
    retry: 'unsafe',
  },
  notAcceptable: {
    name: 'request.not_acceptable',
    status: 406,
    title: 'No acceptable representation',
    retry: 'unsafe',
  },
  unsupportedMediaType: {
    name: 'request.unsupported_media_type',
    status: 415,
    title: 'Unsupported media type',
    retry: 'unsafe',
  },
  notFound: {
    name: 'resource.not_found',
    status: 404,
    title: 'The resource does not exist',
    retry: 'unsafe',
  },
  // The registry leaves this code's retry safety to HC10, which decides it per request.
  internal: {
    name: 'server.internal',
    status: 500,
    title: 'Something went wrong on our side',
    retry: 'indeterminate',
  },
} as const satisfies Record<string, Code>;

const INTERNAL_DETAIL =
  'The request could not be completed. Quote the request identifier when reporting it.';

export interface ErrorSource {
  readonly pointer?: string;
  readonly parameter?: string;
  readonly header?: string;
}

export interface ErrorObject {
  readonly id: string;
  readonly status: string;
  readonly code: string;
  readonly title: string;
  readonly detail?: string;
  readonly source?: ErrorSource;
  readonly meta: { readonly retry: Retry };
}

interface ErrorOptions {
  readonly retry?: Retry | undefined;
  readonly detail?: string | undefined;
  readonly source?: ErrorSource | undefined;
}

/** A failure raised on purpose, answered with one error object of its code. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly code: Code;
  readonly options: ErrorOptions;
  readonly headers: Readonly<Record<string, string>>;

  constructor(code: Code, options: ErrorOptions = {}, headers: Record<string, string> = {}) {
    super(code.name);
    this.code = code;
    this.options = options;
    this.headers = headers;
  }
}

/** Where a failure is logged. Only the composition root knows the logger. */
export interface Log {
  error(details: object, message: string): void;
}

export interface JsonApiEnv {
  Variables: { requestId: string };
}

type JsonApiContext = Context<JsonApiEnv>;

export function errorObject(
  requestId: string,
  code: Code,
  options: ErrorOptions = {},
): ErrorObject {
  return {
    id: requestId,
    status: String(code.status),
    code: code.name,
    title: code.title,
    ...(options.detail === undefined ? {} : { detail: options.detail }),
    ...(options.source === undefined ? {} : { source: options.source }),
    meta: { retry: options.retry ?? code.retry },
  };
}

/** Answers with a top-level JSON:API document carrying `data`, `errors` or `meta` (HC2). */
export function respond(
  c: JsonApiContext,
  members: object,
  status: ContentfulStatusCode = 200,
): Response {
  const document = { jsonapi: { version: '1.1' }, ...members };
  return c.body(JSON.stringify(document), status, {
    'Content-Type': MEDIA_TYPE,
    [REQUEST_ID_HEADER]: c.get('requestId'),
  });
}

export function fail(
  c: JsonApiContext,
  errors: readonly ErrorObject[],
  headers: Record<string, string> = {},
): Response {
  // HC7: the document takes the most general status covering all of its errors.
  const statuses = [...new Set(errors.map((error) => Number(error.status)))];
  const [only] = statuses;
  const general = Math.max(...statuses) >= 500 ? 500 : 400;
  const status = statuses.length === 1 && only !== undefined ? only : general;
  for (const [name, value] of Object.entries(headers)) c.header(name, value);
  return respond(c, { errors }, status as ContentfulStatusCode);
}

/** Splits a header value on a separator that is not inside a quoted string. */
function split(value: string, separator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of value) {
    if (char === '"') quoted = !quoted;
    if (char === separator && !quoted) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

/** A media type, lowercased, and the names of its parameters. */
function mediaType(value: string): { kind: string; parameters: Set<string> } {
  const [kind = '', ...parameters] = split(value, ';');
  const name = (parameter: string) => (parameter.split('=')[0] ?? '').trim().toLowerCase();
  return { kind: kind.toLowerCase(), parameters: new Set(parameters.map(name)) };
}

const outside = (parameters: Set<string>, allowed: readonly string[]) =>
  [...parameters].some((name) => !allowed.includes(name));

/**
 * The HC1 refusal a request earns before it is routed, if any. No JSON:API extension is supported,
 * so an `ext` parameter always names one this service cannot apply. A `profile` may be ignored, and
 * in `Accept`, `q` is a weight rather than a parameter.
 */
export function negotiationFailure(
  contentType: string | undefined,
  accept: string | undefined,
  hasBody: boolean,
): Code | undefined {
  if (contentType !== undefined) {
    const { kind, parameters } = mediaType(contentType);
    if (kind === MEDIA_TYPE && outside(parameters, ['profile'])) return codes.unsupportedMediaType;
    if (kind !== MEDIA_TYPE && hasBody) return codes.unsupportedMediaType;
  } else if (hasBody) {
    return codes.unsupportedMediaType;
  }

  if (accept) {
    const ours = split(accept, ',')
      .map(mediaType)
      .filter(({ kind }) => kind === MEDIA_TYPE);
    if (ours.length > 0 && ours.every(({ parameters }) => outside(parameters, ['profile', 'q']))) {
      return codes.notAcceptable;
    }
  }
  return undefined;
}

// Refusals raised by Hono or its middleware rather than by this service, mapped by status. A 500
// is not among them: it is an unhandled fault, and is logged as one.
const byStatus = new Map<number, Code>(
  Object.values(codes)
    .filter((code) => code !== codes.internal)
    .map((code) => [code.status, code]),
);

/** Puts the contract around an application: identifiers, negotiation and every error mapping. */
export function install(app: Hono<JsonApiEnv>, log: Log): void {
  app.use(async (c, next) => {
    const requestId = randomUUID();
    c.set('requestId', requestId);
    c.header(REQUEST_ID_HEADER, requestId);

    // A request carries a body only with a Content-Length above zero or a Transfer-Encoding.
    const length = c.req.header('content-length');
    const encoded = c.req.header('transfer-encoding') !== undefined;
    const hasBody = encoded || (length !== undefined && length !== '0');
    const contentType = c.req.header('content-type');
    const refusal = negotiationFailure(contentType, c.req.header('accept'), hasBody);
    if (refusal !== undefined) {
      const header = refusal === codes.unsupportedMediaType ? 'Content-Type' : 'Accept';
      return fail(c, [errorObject(requestId, refusal, { source: { header } })]);
    }
    await next();
  });

  app.notFound((c) => fail(c, [errorObject(c.get('requestId'), codes.notFound)]));

  app.onError((error, c) => {
    const requestId = c.get('requestId');
    if (error instanceof ApiError) {
      return fail(c, [errorObject(requestId, error.code, error.options)], { ...error.headers });
    }
    const known = error instanceof HTTPException ? byStatus.get(error.status) : undefined;
    if (known !== undefined) return fail(c, [errorObject(requestId, known)]);

    // The fault goes to the log. The client gets a generic detail and the request identifier to
    // quote (HC11), and a retry safety HC10 decides by method.
    log.error({ err: error, requestId }, 'unhandled fault');
    const retry = c.req.method === 'GET' || c.req.method === 'HEAD' ? 'safe' : 'indeterminate';
    return fail(c, [errorObject(requestId, codes.internal, { retry, detail: INTERNAL_DETAIL })]);
  });
}

type Method = 'get' | 'post' | 'patch' | 'delete';

export interface Operation {
  readonly handle: Handler<JsonApiEnv>;
  /** The query parameters the operation accepts. Any other is refused, never ignored (HC5). */
  readonly query?: readonly string[];
}

/**
 * Registers a path's operations. A method the path does not accept is answered 405 with `Allow`,
 * and a path that answers GET answers HEAD too, which Hono serves from the GET handler.
 */
export function resource(
  app: Hono<JsonApiEnv>,
  path: string,
  operations: Partial<Record<Method, Operation>>,
): void {
  const allowed = new Set<string>();
  for (const [method, operation] of Object.entries(operations)) {
    const verb = method.toUpperCase();
    allowed.add(verb);
    if (verb === 'GET') allowed.add('HEAD');

    const declared = new Set(operation.query ?? []);
    const refuseUndeclared: MiddlewareHandler<JsonApiEnv> = async (c, next) => {
      for (const name of Object.keys(c.req.queries())) {
        if (!declared.has(name)) {
          throw new ApiError(codes.invalidParameter, {
            detail: 'This operation does not accept this query parameter.',
            source: { parameter: name },
          });
        }
      }
      await next();
    };
    app.on(verb, path, refuseUndeclared, operation.handle);
  }

  const allow = [...allowed].sort().join(', ');
  app.all(path, (c) => {
    const error = errorObject(c.get('requestId'), codes.methodNotAllowed);
    return fail(c, [error], { Allow: allow });
  });
}
