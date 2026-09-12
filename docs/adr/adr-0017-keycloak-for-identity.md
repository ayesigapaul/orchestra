---
title: "ADR-0017: Keycloak is the identity provider, self-hosted"
adr_id: ADR-0017
status: Accepted
date: 2026-09-12
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [identity, architecture, security]
depends_on: [ADR-0001, ADR-0002, ADR-0011]
---

# ADR-0017: Keycloak is the identity provider, self-hosted

## Status

Accepted.

## Context

[ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) fixes a multi-tenant SaaS sold to
enterprises, and enterprise buyers require SSO against their own identity provider and user
lifecycle through SCIM. Nothing in the set had recorded how that is supplied.
[`../10-architecture/tech-stack.md`](../10-architecture/tech-stack.md) section 6 recommended buying
a managed broker and named self-hosting as the exception. The decision goes the other way, and the
reasons belong on the record rather than in prose.

Facts as of 2026-09-12. [Keycloak](https://www.keycloak.org/) 26.7.0 was released on 2026-07-09 and
adds a native SCIM API in preview, experimental multi-cluster high availability, and SAML step-up
authentication. Its **Organizations** feature — preview in 25.0, supported from 26.0 — models
multiple tenants inside one realm, each mapped to its own external identity provider and email
domain, which is the alternative to a realm per customer.

## Decision drivers

- Enterprise SSO and SCIM are procurement requirements, not features, in ADR-0001's segment.
- A managed broker prices per connection, which scales with exactly the thing the business wants
  more of.
- Some enterprise contracts require identity to be operated by the vendor rather than delegated to a
  third party, and a hosted broker cannot satisfy that at all.
- Orchestra's own isolation model is already self-operated: [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)
  puts tenant isolation in the datastore rather than in a vendor.

## Considered options

1. **A managed broker** — WorkOS or equivalent. Fastest path to a working enterprise connection, no
   identity infrastructure to operate, per-connection pricing.
2. **Keycloak, self-hosted.** No per-connection cost, no third party in the authentication path, and
   an answer to contracts that forbid one. Orchestra operates it, including upgrades and availability.
3. **Build SAML and SCIM directly.** Rejected without argument: certificate rotation, metadata
   parsing and per-IdP quirks are a permanent tax for no differentiation.

## Decision

**Keycloak, self-hosted, on the current release line (26.7.0 at the time of writing), is Orchestra's
identity provider.** Each Tenant maps to a Keycloak **Organization** within one realm, with its own
external identity provider and email domain.

**What Keycloak supplies:** authentication of Platform Users, enterprise SSO federation (OIDC and
SAML), user lifecycle through SCIM, and the token issuance the edge verifies.

**What Keycloak does not supply, and MUST NOT be used for:**

- **BYOK model credentials.** [ADR-0002](adr-0002-enterprise-segment-and-byok.md) requires envelope
  encryption with per-Tenant data keys and provably no plaintext in logs, traces or backups. That is
  a key-management problem and stays with a KMS. Keycloak is an identity provider, not a secret
  store, and putting customer provider keys in it would be a category error.
- **Authorization decisions.** Policy is Orchestra's
  ([`../40-governance/policy-model.md`](../40-governance/policy-model.md)), evaluated at enforcement
  points the compiler emits. Keycloak roles are an input to a Policy at most, never a substitute for
  one, and no Keycloak authorization feature may stand in for a Policy Decision.
- **Session Tokens for End Users.** Those are Orchestra-minted, because the Gateway resolves every
  credential to exactly one Principal and one Tenant
  ([`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) G3 to G7).

## Rationale

Option 1 is the right default for a company that wants to think about identity as little as
possible, and this is not that company: the enterprise segment ADR-0001 fixes contains buyers who
ask who operates the identity path, and per-connection pricing charges most exactly where the
business is trying to grow. Option 2 costs operations — Keycloak is a stateful service with an
upgrade cadence and an availability requirement that now sits on the critical path of every login —
and buys the answer to that procurement question outright.

The Organizations feature is what makes option 2 tractable. A realm per Tenant multiplies the
operational surface by the customer count; one realm with an Organization per Tenant keeps
administration proportionate to the product rather than to the customer list.

## Consequences

### Positive

- No per-connection pricing, and no third party in the authentication path to explain in a security
  review.
- Self-hosted identity is available where a contract requires it, rather than being a reason to lose
  the deal.
- Tenant-to-Organization mapping gives a single place to attach an enterprise's IdP.

### Negative

- **Orchestra now operates a stateful, security-critical service.** Upgrades, backups, availability
  and CVE response for Keycloak are Orchestra's, and an outage is a total authentication outage.
- SCIM is **preview** in 26.7.0, so the lifecycle half of the requirement rests on a feature that may
  still change.
- Multi-cluster high availability is experimental, which bounds what can be promised about identity
  availability until it is not.
- Keycloak expertise becomes a hiring and on-call requirement.

### Neutral / follow-on work

- Decide realm topology concretely — one realm with Organizations, and what an Organization maps to
  when a Tenant has several Workspaces ([`../20-domain/domain-model.md`](../20-domain/domain-model.md)
  section 3 keeps a Workspace administrative, never an isolation boundary).
- Decide how a Keycloak identity resolves to a **Principal**, since invariant I2 admits exactly one
  Principal per action and [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md)
  owns that mapping.
- Record how Service Accounts authenticate, which may or may not be Keycloak clients.
- The Session Token mint question in `gateway-api.md` section 3 is unaffected and still open.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Keycloak outage takes authentication down entirely | Medium | High | Availability design before first customer; multi-cluster HA is experimental, so plan around a single cluster |
| SCIM preview changes before it stabilises | Medium | Medium | Treat SCIM as provisional until it leaves preview; do not promise lifecycle automation in a contract first |
| Operating identity consumes more engineering than a broker subscription would cost | Medium | Medium | Revisit criteria below; the decision is reversible before a customer exists |
| Keycloak roles quietly become the authorization model | Medium | High | The prohibition above is normative: Policy is the only authorization decision |

## Revisit criteria

Reopen if operating Keycloak proves to cost more engineering attention than the per-connection
pricing it avoids; if a design partner requires an identity feature Keycloak cannot supply; or if
identity availability becomes the platform's dominant incident class.

## References

- [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) — the segment that makes SSO and SCIM
  procurement requirements
- [ADR-0002](adr-0002-enterprise-segment-and-byok.md) — credential custody, which this record
  explicitly does not move to Keycloak
- [Keycloak Organizations](https://www.keycloak.org/2024/06/announcement-keycloak-organizations)
