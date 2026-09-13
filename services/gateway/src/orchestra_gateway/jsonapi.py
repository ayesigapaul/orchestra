"""The HTTP contract: JSON:API 1.1 documents, and one error layer for every failure.

The rules are docs/30-protocol/http-conventions.md (ADR-0025). Every failure is mapped here, so a
framework's default error body never reaches a client (HC13), and each code carries the status,
title and retry safety that document's section 4 registers for it.
"""

import logging
import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from fastapi import Depends, FastAPI, Request
from fastapi.dependencies.models import Dependant
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.routing import APIRoute
from starlette.datastructures import Headers, MutableHeaders
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

MEDIA_TYPE = "application/vnd.api+json"
REQUEST_ID_HEADER = "Orchestra-Request-Id"

logger = logging.getLogger("orchestra_gateway.errors")

type Retry = Literal["safe", "unsafe", "indeterminate"]


@dataclass(frozen=True)
class Code:
    """A registered error code. Its status, title and retry safety never vary by occurrence."""

    name: str
    status: int
    title: str
    retry: Retry


MALFORMED = Code("request.malformed", 400, "The request is malformed", "unsafe")
INVALID_PARAMETER = Code(
    "request.invalid_parameter", 400, "A query parameter is unknown or malformed", "unsafe"
)
VALIDATION_FAILED = Code(
    "request.validation_failed", 422, "A request member is missing or invalid", "unsafe"
)
METHOD_NOT_ALLOWED = Code(
    "request.method_not_allowed", 405, "This method is not allowed on this path", "unsafe"
)
NOT_ACCEPTABLE = Code("request.not_acceptable", 406, "No acceptable representation", "unsafe")
UNSUPPORTED_MEDIA_TYPE = Code(
    "request.unsupported_media_type", 415, "Unsupported media type", "unsafe"
)
UNAUTHENTICATED = Code("auth.unauthenticated", 401, "A valid credential is required", "unsafe")
NOT_FOUND = Code("resource.not_found", 404, "The resource does not exist", "unsafe")
# The registry leaves this code's retry safety to HC10, which decides it per request.
INTERNAL = Code("server.internal", 500, "Something went wrong on our side", "indeterminate")

INTERNAL_DETAIL = (
    "The request could not be completed. Quote the request identifier when reporting it."
)


class ApiError(Exception):
    """A failure raised on purpose, answered with one error object of its code."""

    def __init__(
        self,
        code: Code,
        *,
        detail: str | None = None,
        source: Mapping[str, str] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(code.name)
        self.code = code
        self.detail = detail
        self.source = source
        self.headers = headers


class JsonApiResponse(JSONResponse):
    media_type = MEDIA_TYPE


def document(**members: Any) -> dict[str, Any]:
    """A top-level JSON:API document, carrying `data`, `errors` or `meta` (HC2)."""
    return {"jsonapi": {"version": "1.1"}, **members}


def error_object(
    request_id: str,
    code: Code,
    *,
    retry: Retry | None = None,
    detail: str | None = None,
    source: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "id": request_id,
        "status": str(code.status),
        "code": code.name,
        "title": code.title,
    }
    if detail:
        error["detail"] = detail
    if source is not None:
        error["source"] = dict(source)
    error["meta"] = {"retry": retry or code.retry}
    return error


def error_response(
    request_id: str, errors: list[dict[str, Any]], *, headers: Mapping[str, str] | None = None
) -> JsonApiResponse:
    # HC7: the document takes the most general status covering all of its errors.
    statuses = {int(error["status"]) for error in errors}
    if len(statuses) == 1:
        status = statuses.pop()
    else:
        status = 500 if max(statuses) >= 500 else 400
    return JsonApiResponse(
        document(errors=errors),
        status_code=status,
        headers={**(headers or {}), REQUEST_ID_HEADER: request_id},
    )


def _split(value: str, separator: str) -> list[str]:
    """Splits a header value on a separator that is not inside a quoted string."""
    parts: list[str] = []
    current: list[str] = []
    quoted = False
    for char in value:
        if char == '"':
            quoted = not quoted
        if char == separator and not quoted:
            parts.append("".join(current))
            current = []
        else:
            current.append(char)
    parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def _media_type(value: str) -> tuple[str, set[str]]:
    """A media type, lowercased, and the names of its parameters."""
    kind, *parameters = _split(value, ";") or [""]
    return kind.lower(), {parameter.partition("=")[0].strip().lower() for parameter in parameters}


def negotiation_failure(headers: Headers, *, has_body: bool) -> Code | None:
    """The HC1 refusal a request earns before it is routed, if any.

    No JSON:API extension is supported, so an `ext` parameter always names one this service cannot
    apply. A `profile` may be ignored, and in `Accept`, `q` is a weight rather than a parameter.
    """
    content_type = headers.get("content-type")
    if content_type is not None:
        kind, parameters = _media_type(content_type)
        if kind == MEDIA_TYPE and parameters - {"profile"}:
            return UNSUPPORTED_MEDIA_TYPE
        if kind != MEDIA_TYPE and has_body:
            return UNSUPPORTED_MEDIA_TYPE
    elif has_body:
        return UNSUPPORTED_MEDIA_TYPE

    accept = headers.get("accept")
    if accept:
        ours = [
            names for kind, names in map(_media_type, _split(accept, ",")) if kind == MEDIA_TYPE
        ]
        if ours and all(names - {"profile", "q"} for names in ours):
            return NOT_ACCEPTABLE
    return None


class JsonApiMiddleware:
    """Gives every response its request identifier (HC12), and refuses what HC1 excludes."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = str(uuid.uuid4())
        scope.setdefault("state", {})["request_id"] = request_id

        headers = Headers(scope=scope)
        has_body = headers.get("content-length", "0") != "0" or "transfer-encoding" in headers
        refusal = negotiation_failure(headers, has_body=has_body)
        if refusal is not None:
            header = "Content-Type" if refusal is UNSUPPORTED_MEDIA_TYPE else "Accept"
            error = error_object(request_id, refusal, source={"header": header})
            await error_response(request_id, [error])(scope, receive, send)
            return

        async def send_with_request_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)[REQUEST_ID_HEADER] = request_id
            await send(message)

        await self.app(scope, receive, send_with_request_id)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


async def _on_api_error(request: Request, exc: ApiError) -> Response:
    request_id = _request_id(request)
    error = error_object(request_id, exc.code, detail=exc.detail, source=exc.source)
    return error_response(request_id, [error], headers=exc.headers)


# Refusals the framework raises before a handler runs, such as an unknown path or a method the path
# does not accept. Only the headers the contract names for them are passed on.
_BY_STATUS = {
    code.status: code
    for code in (MALFORMED, UNAUTHENTICATED, NOT_FOUND, METHOD_NOT_ALLOWED, NOT_ACCEPTABLE)
} | {415: UNSUPPORTED_MEDIA_TYPE, 422: VALIDATION_FAILED}


async def _on_http_exception(request: Request, exc: HTTPException) -> Response:
    code = _BY_STATUS.get(exc.status_code)
    if code is None:
        return await _on_unhandled(request, exc)
    headers: dict[str, str] = {}
    for name, value in (exc.headers or {}).items():
        if name.lower() == "allow":
            headers["Allow"] = ", ".join(sorted(method.strip() for method in value.split(",")))
        elif name.lower() == "www-authenticate":
            headers["WWW-Authenticate"] = value
    request_id = _request_id(request)
    return error_response(request_id, [error_object(request_id, code)], headers=headers)


async def _on_validation_error(request: Request, exc: RequestValidationError) -> Response:
    request_id = _request_id(request)
    return error_response(request_id, [_problem(request_id, problem) for problem in exc.errors()])


def _problem(request_id: str, problem: Mapping[str, Any]) -> dict[str, Any]:
    location, *path = problem.get("loc") or ("body",)
    detail = problem.get("msg")
    if problem.get("type") == "json_invalid" or (location == "body" and not path):
        return error_object(request_id, MALFORMED)
    if location == "query":
        source = {"parameter": str(path[0])}
        return error_object(request_id, INVALID_PARAMETER, detail=detail, source=source)
    if location == "header":
        source = {"header": str(path[0])}
        return error_object(request_id, VALIDATION_FAILED, detail=detail, source=source)
    if location == "path":
        # A malformed identifier names no resource, and saying why would describe the id space.
        return error_object(request_id, NOT_FOUND)
    pointer = "".join("/" + str(part).replace("~", "~0").replace("/", "~1") for part in path)
    return error_object(request_id, VALIDATION_FAILED, detail=detail, source={"pointer": pointer})


async def _on_unhandled(request: Request, exc: Exception) -> Response:
    # The fault and its traceback go to the log. The client gets a generic detail and the request
    # identifier to quote (HC11), and a retry safety HC10 decides by method.
    request_id = _request_id(request)
    logger.error("unhandled fault on request %s", request_id, exc_info=exc)
    retry: Retry = "safe" if request.method in {"GET", "HEAD"} else "indeterminate"
    error = error_object(request_id, INTERNAL, retry=retry, detail=INTERNAL_DETAIL)
    return error_response(request_id, [error])


def reject_unknown_query_parameters(request: Request) -> None:
    """HC5: a query parameter the operation does not declare is refused, never ignored."""
    route = request.scope.get("route")
    declared = _query_parameters(route.dependant) if isinstance(route, APIRoute) else set()
    for name in request.query_params:
        if name not in declared:
            raise ApiError(
                INVALID_PARAMETER,
                detail="This operation does not accept this query parameter.",
                source={"parameter": name},
            )


def _query_parameters(dependant: Dependant) -> set[str]:
    names = {field.alias for field in dependant.query_params}
    for dependency in dependant.dependencies:
        names |= _query_parameters(dependency)
    return names


def install(app: FastAPI) -> None:
    """Puts the contract around an application. Call it before adding any route."""
    app.router.dependencies.append(Depends(reject_unknown_query_parameters))
    app.add_middleware(JsonApiMiddleware)
    app.add_exception_handler(ApiError, _on_api_error)
    app.add_exception_handler(HTTPException, _on_http_exception)
    app.add_exception_handler(RequestValidationError, _on_validation_error)
    app.add_exception_handler(Exception, _on_unhandled)
