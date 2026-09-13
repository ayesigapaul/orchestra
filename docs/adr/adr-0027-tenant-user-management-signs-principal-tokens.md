---
title: "ADR-0027: Tenant User Management signs the Principal Token that carries a Principal and Tenant between services"
adr_id: ADR-0027
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, security, identity, services]
depends_on: [ADR-0017, ADR-0020, ADR-0024, ADR-0025, ADR-0026]
---

# ADR-0027: Tenant User Management signs the Principal Token that carries a Principal and Tenant between services

## Status

Accepted.

## Context

[ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) has every call between
services carry the calling service's own token. It also forbids a callee from taking the Principal or
Tenant it acts for on the caller's word: the callee takes both from a signed token it verifies
([`http-conventions.md`](../30-protocol/http-conventions.md) HC18). ADR-0026 left open which token
that is and who signs it, and no internal operation that acts for a Principal may ship before that is
decided. [`identity-and-access.md`](../10-architecture/identity-and-access.md) section 3 names three
candidates.

Four facts bear on the choice.

- **Resolution exists.** The Gateway verifies every credential, and Tenant User Management resolves
  it to exactly one Principal and one Tenant
  ([`credential-resolution.md`](../30-protocol/credential-resolution.md)). Those are the only two
  services that ever see a client's credential.
- **Not every Principal holds an identity provider token.** A Platform User's credential comes from
  Keycloak ([ADR-0017](adr-0017-keycloak-for-identity.md)). An End User presents a Session Token that
  Orchestra itself mints ([`gateway-api.md`](../30-protocol/gateway-api.md) G4 and G5), and the
  credential class of a Service Account is undecided.
- **Authority outlives credentials.** A Run may suspend at an Approval Request for days, and its
  authority does not expire with the credential that admitted it (G6). Whatever acts for its
  Principal after resumption holds no live credential.
- **Orchestra already signs tokens.** G5 has the Gateway mint Session Tokens, so key custody and
  rotation are Orchestra's problem whichever option is chosen.

The product owner requires international naming and data standards, so the token uses standard
formats and registered claim names wherever they exist. The comparison below is the security review
the register row asked for. An independent review before the first external deployment is still
advisable.

## Decision drivers

- A callee verifies every fact it acts on, and trusts neither network location nor its caller's word
  (HC17, HC18).
- One mechanism for every Principal subtype, and for work that outlives the credential that started
  it.
- The callee receives Orchestra's own identifiers for the Principal and the Tenant, instead of
  resolving a credential again at every hop.
- A client's credential goes no deeper into the platform than it must.
- Standard formats any JOSE library verifies, with registered claim names.
- A signing key whose compromise is contained, and whose rotation is routine.
- A choice that stays cheap to reverse before the first customer (working rule 8).

## Considered options

1. **Relay the original credential**, which each callee verifies and resolves again.
2. **Exchange the credential at the identity provider** for a token scoped to the callee, through
   OAuth 2.0 Token Exchange ([RFC 8693](https://www.rfc-editor.org/rfc/rfc8693)) at Keycloak.
3. **A token signed by Tenant User Management**, the service that resolves the credential, scoped to
   one callee.

## Decision

**Option 3.** Tenant User Management is the only service that signs a *Principal Token*, and the only
issuer a callee trusts for one.

**The token.** A Principal Token is a JSON Web Token ([RFC 7519](https://www.rfc-editor.org/rfc/rfc7519))
signed as a JWS, with an asymmetric algorithm registered for JOSE in
[RFC 7518](https://www.rfc-editor.org/rfc/rfc7518). ES256 is the default. Its header is explicitly
typed, as [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725) recommends, so it cannot pass for an
access token or an ID token. Its claims use registered names wherever one exists.

| Claim | Meaning | Name defined by |
| --- | --- | --- |
| `iss` | Tenant User Management's issuer identifier | RFC 7519 |
| `sub` | The Principal's identifier | RFC 7519 |
| `aud` | The one service the token is for | RFC 7519 |
| `iat`, `nbf`, `exp` | A lifetime of minutes, never longer than the credential or grant it was issued from | RFC 7519 |
| `jti` | The token's own identifier, for audit and replay detection | RFC 7519 |
| `act` | The service acting for the Principal, nesting each earlier service in the chain | RFC 8693 section 4.1 |
| `tenant_id` | The Principal's Tenant | Orchestra, as a private claim under RFC 7519 section 4.3, because no registered claim names a tenant |
| `principal_kind` | Whether the Principal is a Platform User, an End User or a Service Account | Orchestra, as a private claim |

**Bound to its caller.** A callee accepts a Principal Token only when the outermost `act` names the
same client its own service token authenticated (HC17). A token taken from one service is useless to
any other.

**Issuance.** A service obtains a Principal Token from Tenant User Management, for one callee. It
presents its own service token and one of these:

- the credential a client presented, which Tenant User Management verifies and resolves exactly as
  credential resolution does;
- a Principal Token issued to that service, to reach the next hop. The new token gains the service in
  `act`, and it never outlives the token it came from.

Tenant User Management records which services may ask for which audiences, and refuses every other
request.

**Work that outlives its credential.** At admission, a service that will act for a Principal later,
such as the run supervisor, can obtain a grant for the durable record it holds, such as the Run. That
grant is also signed by Tenant User Management. It names the record, the Principal, the Tenant and the
service, and Tenant User Management is its only audience. On resumption, the service exchanges the
grant for Principal Tokens. Tenant User Management verifies its own signature, and checks that the
Principal's Membership still stands. The service never names a Principal on its own word, so HC18
holds without a privileged path. The grant is revoked when the record ends, and every exchange is an
Audit Record.

**Verification.** A callee verifies a Principal Token as it verifies any credential. It checks the
signature against Tenant User Management's published key set, the explicit type, the issuer, itself
as the audience, the lifetime with a small allowance for clock skew, and the binding to its caller.
A token that fails is `auth.unauthenticated`, and the reason goes only to the callee's log.

**Transport.** The token travels in a request header of its own, beside the service token in
`Authorization`, and never in a body or a query. The protocol document names the header.

**Keys.** In production, the signing key is held where it cannot be read, in a key management
service or a hardware security module. In the local stack, it is held in a file. The public keys are
published as a JWK Set ([RFC 7517](https://www.rfc-editor.org/rfc/rfc7517)). That one resource is
served as `application/jwk-set+json`, not as a JSON:API document, because every JOSE library reads
that format and none reads JSON:API. A new key is published before it signs anything, and a retired
key stays published until every token it signed has expired.

**What this amends.**

- ADR-0026's follow-on work on which token carries the Principal and Tenant is discharged.
- [ADR-0025](adr-0025-json-api-http-contract.md) gains one exception: the key set is served in its own
  standard media type.
- `http-conventions.md` HC18, `identity-and-access.md` section 3 and `credential-resolution.md` CR3
  now name this token, and the register rows in `http-conventions.md` section 9 and
  `identity-and-access.md` section 12 are discharged.

## Rationale

**Option 1 fails G6.** A Run resumed days after admission has no credential left to relay, so a second
mechanism would be needed anyway. Relaying also spreads bearer credentials, Session Tokens included,
to every internal service, and [`threat-model.md`](../40-governance/threat-model.md) T3 treats the
holder of one as an adversary. It makes every callee accept the Gateway's audience, and repeats
resolution at every hop.

**Option 2 covers only what the identity provider issued.** A token signed by the identity provider
and scoped to each callee is attractive. But an End User's Session Token is Orchestra's own (G5), so
Keycloak cannot exchange it, and a Service Account's credential is undecided. Option 2 fails G6 as
option 1 does, and puts Keycloak on every internal hop. Its token carries the identity provider's
subject and organization rather than Orchestra's Principal and Tenant, so every callee would resolve
again.

**Option 3 carries Orchestra's own identifiers, verified once, to every callee.** It covers every
Principal subtype, because issuance starts from whatever resolution accepted. It covers resumed work
through a grant that Tenant User Management signed itself. Tenant User Management already owns
Principals and resolution ([ADR-0024](adr-0024-global-person-with-tenant-memberships.md)), so it is
the one service that can say who a Principal is without asking another. Its cost is a signing key,
which Orchestra carries for Session Tokens regardless.

## Consequences

### Positive

- Callees trust one issuer and one key set, verify with any JOSE library, and never resolve a
  credential again.
- A client's credential stops at the Gateway and Tenant User Management.
- Every internal call names its Principal, its Tenant and its chain of acting services, for audit.
- A removed Membership stops new Principal Tokens within minutes, resumed work included.

### Negative

- **A signing key that can speak for any Principal in any Tenant.** Its custody and rotation are as
  security-critical as the linking functions of ADR-0024.
- Tenant User Management is on the path of every internal call that acts for a Principal, except
  where a caller reuses a token within its lifetime.
- One resource departs from ADR-0025's media type rule.
- The grant for resumed work is long-lived by design, and has to be revocable.

### Neutral / follow-on work

- Specify the token, its explicit type, its claims, the issuance and exchange operations, the header,
  the grant and the key set in `docs/30-protocol/`. That document comes before the first internal
  operation that acts for a Principal.
- Add *Principal Token* to the glossary.
- Build issuance and verification with that first operation, and not before.
- Choose production key custody with the deployment design.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The signing key is stolen, and tokens are forged for any Principal | Low | High | A key management service or hardware module holds it; lifetimes are minutes; every issuance is audited by `jti`; rotation is routine |
| Another service replays a token | Medium | High | The audience is one callee, and the outermost `act` must match the caller's own service token |
| A Principal Token is confused with another JWT | Low | High | Explicit typing under RFC 8725, a dedicated issuer, and audience checks |
| Resumed work acts for a Principal without a credential | Medium | High | Only through a grant Tenant User Management signed at admission, bound to the record and the service, checked against the current Membership, revoked with the record, and audited |
| Tenant User Management becomes a bottleneck on internal calls | Medium | Medium | Callers reuse a token for its audience within its lifetime; measure before optimizing |

## Revisit criteria

Reopen this decision in any of these cases:

- The identity provider can exchange Orchestra's Session Tokens and Service Account credentials, and
  carry Orchestra's identifiers.
- A workload identity and delegation standard across the deployment makes a platform-signed token
  redundant.
- Issuing tokens for internal calls is measured to cost more than reusing them within their lifetime
  recovers.

## References

- [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) and
  [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) HC17 to HC20: calls
  between services
- [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 3:
  the three candidates
- [`../30-protocol/credential-resolution.md`](../30-protocol/credential-resolution.md): resolution,
  where issuance starts
- [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G4 to G6: Session Tokens, and
  authority that outlives them
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T3: the holder of a bearer
  credential
- [RFC 7515](https://www.rfc-editor.org/rfc/rfc7515), [RFC 7517](https://www.rfc-editor.org/rfc/rfc7517),
  [RFC 7518](https://www.rfc-editor.org/rfc/rfc7518) and [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519):
  JWS, JWK, JWA and JWT
- [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693): the `act` claim and token exchange
- [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725): JSON Web Token best current practices
