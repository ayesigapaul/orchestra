"""Credential resolution through Tenant User Management (docs/30-protocol/credential-resolution.md).

The Gateway sends a credential it has already verified, authenticated as itself with a client
credentials token (HC17). Only an answer that resolves establishes a Principal and a Tenant. A
rejection is final, and anything else — an error, an unreachable service, a passed deadline or an
answer that does not parse — is a failure to resolve, never a pass (CR7).
"""

import json
import logging
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

import httpx2

logger = logging.getLogger("orchestra_gateway.resolution")

MEDIA_TYPE = "application/vnd.api+json"
RESOLUTIONS = "credential-resolutions"

# A service token is replaced this long before it expires, so it is never presented as it lapses.
RENEW_BEFORE_EXPIRY_SECONDS = 30.0
# The pause before the one repeat the contract allows, bounded by what is left of the deadline.
REPEAT_PAUSE_SECONDS = 0.1


@dataclass(frozen=True)
class Identity:
    """The one Principal, in the one Tenant, that a credential resolved to."""

    tenant_id: str
    principal_id: str
    principal_kind: str


class Rejected(Exception):
    """The credential does not resolve. Tenant User Management never says why (CR6)."""


class ResolutionUnavailable(Exception):
    """Resolution did not complete, so nothing was established."""


class Resolver(Protocol):
    def resolve(self, credential: str) -> Identity: ...


class ServiceTokens:
    """The Gateway's own client credentials token, reused until shortly before it expires."""

    def __init__(
        self,
        client: httpx2.Client,
        *,
        token_url: str,
        client_id: str,
        client_secret: str,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._token_url = token_url
        self._auth = httpx2.BasicAuth(client_id, client_secret)
        self._clock = clock
        self._lock = threading.Lock()
        self._token: str | None = None
        self._renew_at = 0.0

    def current(self, *, timeout: float) -> str:
        with self._lock:
            if self._token is None or self._clock() >= self._renew_at:
                self._token, self._renew_at = self._obtain(timeout)
            return self._token

    def discard(self, token: str) -> None:
        """Forgets a token the callee refused, so the next call obtains another."""
        with self._lock:
            if self._token == token:
                self._token = None

    def _obtain(self, timeout: float) -> tuple[str, float]:
        requested_at = self._clock()
        try:
            response = self._client.post(
                self._token_url,
                data={"grant_type": "client_credentials"},
                auth=self._auth,
                timeout=timeout,
            )
        except httpx2.HTTPError as exc:
            raise ResolutionUnavailable("the token endpoint could not be reached") from exc
        if response.status_code != 200:
            raise ResolutionUnavailable(f"the token endpoint answered {response.status_code}")
        try:
            body = response.json()
            token, lifetime = body["access_token"], float(body["expires_in"])
        except (ValueError, KeyError, TypeError) as exc:
            raise ResolutionUnavailable("the token endpoint answered without a token") from exc
        if not isinstance(token, str) or not token:
            raise ResolutionUnavailable("the token endpoint answered without a token")
        return token, requested_at + max(0.0, lifetime - RENEW_BEFORE_EXPIRY_SECONDS)


class CredentialResolver:
    """Asks Tenant User Management which Principal and Tenant a verified credential resolves to."""

    def __init__(
        self,
        client: httpx2.Client,
        tokens: ServiceTokens,
        *,
        url: str,
        deadline_seconds: float,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._client = client
        self._tokens = tokens
        self._url = f"{url.rstrip('/')}/{RESOLUTIONS}"
        self._deadline_seconds = deadline_seconds
        self._clock = clock
        self._sleep = sleep

    def resolve(self, credential: str) -> Identity:
        deadline = self._clock() + self._deadline_seconds
        body = json.dumps({"data": {"type": RESOLUTIONS, "attributes": {"credential": credential}}})
        repeated = renewed = False
        while True:
            token = self._tokens.current(timeout=self._left(deadline))
            try:
                response = self._client.post(
                    self._url,
                    content=body,
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": MEDIA_TYPE,
                        "Accept": MEDIA_TYPE,
                    },
                    timeout=self._left(deadline),
                )
            except (httpx2.ConnectError, httpx2.ConnectTimeout) as exc:
                # No connection was made, so nothing was sent, and the one repeat is safe (HC19).
                if repeated:
                    raise ResolutionUnavailable("Tenant User Management is unreachable") from exc
                repeated = True
                self._pause(deadline)
                continue
            except httpx2.HTTPError as exc:
                # The deadline passed, or the exchange broke after the request was sent.
                raise ResolutionUnavailable("the resolution did not complete") from exc

            if response.status_code == 200:
                return _identity_from(response)

            # The callee's error is this service's to map, and its particulars go to the log (HC20).
            codes, retry, request_id = _errors_of(response)
            logger.warning(
                "credential resolution answered %s %s; Tenant User Management request %s",
                response.status_code,
                ", ".join(codes) or "without an error document",
                request_id,
            )
            if response.status_code == 401 and not renewed:
                # The Gateway's own token was refused. Another token changes the request, so
                # sending it again is not a repeat (HC10).
                renewed = True
                self._tokens.discard(token)
                continue
            if retry == "safe" and not repeated:
                repeated = True
                self._pause(deadline)
                continue
            raise ResolutionUnavailable(f"Tenant User Management answered {response.status_code}")

    def _left(self, deadline: float) -> float:
        left = deadline - self._clock()
        if left <= 0:
            raise ResolutionUnavailable("the resolution deadline passed")
        return left

    def _pause(self, deadline: float) -> None:
        self._sleep(min(REPEAT_PAUSE_SECONDS, self._left(deadline)))


def _identity_from(response: httpx2.Response) -> Identity:
    """The identity a 200 answer establishes. It raises Rejected for a rejection, and fails closed
    on anything it cannot read as exactly one Principal in one Tenant."""
    try:
        data = response.json()["data"]
        attributes = data["attributes"]
        kind, outcome = data["type"], attributes["outcome"]
    except (ValueError, KeyError, TypeError) as exc:
        raise ResolutionUnavailable("the answer is not a credential resolution document") from exc
    if kind != RESOLUTIONS or not isinstance(attributes, dict):
        raise ResolutionUnavailable("the answer is not a credential resolution document")
    if outcome == "rejected":
        raise Rejected
    fields = [attributes.get(name) for name in ("tenant_id", "principal_id", "principal_kind")]
    if outcome != "resolved" or not all(isinstance(value, str) and value for value in fields):
        raise ResolutionUnavailable("the answer does not establish one Principal in one Tenant")
    tenant_id, principal_id, principal_kind = fields
    return Identity(tenant_id=tenant_id, principal_id=principal_id, principal_kind=principal_kind)


def _errors_of(response: httpx2.Response) -> tuple[list[str], str | None, str | None]:
    """An error document's codes, the retry safety all its errors share, and its request id."""
    request_id = response.headers.get("orchestra-request-id")
    try:
        errors = response.json()["errors"]
        codes = [str(error["code"]) for error in errors]
        retries = {error["meta"]["retry"] for error in errors}
    except ValueError, KeyError, TypeError:
        return [], None, request_id
    return codes, retries.pop() if len(retries) == 1 else None, request_id
