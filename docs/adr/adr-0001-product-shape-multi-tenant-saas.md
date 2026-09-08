---
title: "ADR-0001: Product shape — multi-tenant SaaS"
adr_id: ADR-0001
status: Accepted
date: 2026-09-08
deciders: [product-owner, platform-architecture]
tags: [product, tenancy, commercial]
---

# ADR-0001: Product shape — multi-tenant SaaS

## Status

Accepted

## Context

The v0.1 vision brief described three mutually incompatible products without choosing between them.
It invoked a hosted-SaaS mental model ("Stripe for agent capabilities", §38), made tenant
isolation a core architectural requirement (§21), yet deferred tenant management, RBAC and
secret management to
Phase 3 (§31) and shipped a customer-replaceable reference backend (§13) — the shape of a
self-hosted framework.

These are not stylistic differences. They imply different data models, different security boundaries,
different packaging and different first-year engineering plans. The ambiguity blocked every
downstream decision.

## Decision drivers

- Multi-tenancy is the one property that cannot be retrofitted; every table, event, log line and
  cache key is affected.
- Commercial model, credential custody and deployment topology all derive from this choice.
- The product owner requires a SaaS commercial model.

## Considered options

1. **Hosted multi-tenant SaaS** — Orchestra operates the control plane and data plane; customers
   integrate via SDK and connector.
2. **Self-hosted / open-source platform** — customers deploy the whole platform; largely single-tenant
   per deployment.
3. **Internal platform** — built solely for first-party applications.

## Decision

Orchestra is a **hosted, multi-tenant SaaS platform**. Tenant is a first-class entity from the first
commit.

## Rationale

Option 1 is the product owner's stated commercial requirement. Options 2 and 3 would each simplify
the security model considerably, but neither supports the intended business.

Given option 1, multi-tenancy cannot be deferred. Retrofitting tenant isolation into a running
system is among the most expensive and error-prone migrations in software, and the failure mode —
cross-tenant data exposure — is existential for an enterprise product.

## Consequences

### Positive

- One operated deployment; upgrades, telemetry and incident response are centralised.
- Usage is directly observable, which makes metering and product learning possible.

### Negative

- **Reverses v0.1 §30 and §31.** Multi-tenancy, RBAC, tenant administration and secret management
  move from Phase 3 into MVP. This is a material MVP scope increase and must be planned as one.
- Orchestra becomes a processor of customer data, incurring DPA, residency, retention and
  subprocessor obligations from the first enterprise conversation.
- SOC 2 becomes a gating requirement for the first deal. It is calendar-bound, not effort-bound, and
  the clock should start before the product is finished.

### Neutral / follow-on work

- `tenant_id` MUST be present on every persisted record, every emitted event and every log line.
- Isolation strategy (shared schema with row-level security, schema-per-tenant, or
  database-per-tenant) is a separate decision — see `10-architecture/multi-tenancy.md`.
- A tenant-scoped, deny-by-default authorization model is required before any tool executes.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Cross-tenant data leakage | Medium | Existential | Enforce isolation at the storage layer, not in application code; mandatory tenant-scoping tests in CI |
| SOC 2 gates the first deal | High | High | Begin readiness work in parallel with engineering, not after |
| Enterprises refuse to route data through a third party | Medium | High | Validate with design partners; a self-hosted data plane remains a possible later variant |

## Revisit criteria

Reopen if design-partner conversations show that the target segment categorically refuses
third-party data processing. The likely response would be a hybrid topology — hosted control plane,
customer-deployed data plane — not a reversal of the commercial model.

## References

- [v0.1 vision brief](../archive/vision-v0.1-2026-09-08.md) — §13, §21, §30, §31, §38
