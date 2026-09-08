---
title: "ADR-0006: Model layer is a credential and endpoint broker"
adr_id: ADR-0006
status: Accepted
date: 2026-09-08
deciders: [platform-architecture]
tags: [models, security, scope]
depends_on: [ADR-0002]
---

# ADR-0006: Model layer is a credential and endpoint broker

## Status

Accepted

## Context

v0.1 §10 and §11 specified an elaborate model layer: Provider / Model / Capability / Routing Policy
/ Invocation, with capability-based selection ("any model with vision and tool calling"), preference
policies ("prefer low latency", "prefer reasoning quality") and provider fallback. It was the most
developed machinery in the document.

Under [ADR-0002](adr-0002-enterprise-segment-and-byok.md) — enterprise, BYOK — most of it is
unimplementable:

1. **The axis is wrong.** v0.1 organises by *vendor*. Enterprises consume models by *deployment
   surface*: Azure OpenAI, AWS Bedrock, Google Vertex AI, an internal OpenAI-compatible gateway, or
a    vendor API directly. The same vendor's model is reachable through several surfaces, each with
   different authentication, identifiers, regional behaviour and quota. A `provider` field cannot
   express this.
2. **Capability routing has no inputs.** A tenant enables a small, fixed set of deployments, changed
   through a procurement process measured in weeks. There is nothing to route across.
3. **Rate limits are not a failure mode.** Under BYOK the tenant's own quota is a permanent capacity
   ceiling that must be scheduled within — a subsystem v0.1 does not contain, while §23 lists rate
   limiting merely as an error to retry.

## Decision drivers

- Build for how the target segment actually consumes models.
- Do not carry unimplementable abstractions in a pre-implementation architecture.
- Reallocate the effort to credential custody and quota management, which are unavoidable and absent.

## Considered options

1. **Retain the full router** as specified in v0.1.
2. **Reduce to a credential and endpoint broker** with explicit selection and ordered fallback.
3. **No abstraction** — bind directly to one provider SDK.

## Decision

The model layer is a **credential and endpoint broker**. Its responsibilities are:

- **Model Binding** — per tenant: deployment surface, endpoint, credential reference, the customer's
  own model identifier, declared limits.
- **Credential custody** — KMS-backed envelope encryption, per-tenant data keys, rotation, and no
  plaintext in logs, traces or backups.
- **Explicit selection** — an Agent or Step names a Model Binding.
- **Ordered fallback** — a declared list, attempted in order, with strict rules about what may be
  retried.
- **Quota-aware scheduling** — admission control and backpressure against each binding's Quota
  Envelope, with the resulting delay surfaced to the user rather than hidden.
- **Normalised invocation and streaming** — so provider-native formats never reach a public contract.

**Removed from scope:** capability-based selection, preference-based routing, and cost-optimising
policy engines.

## Rationale

Option 3 forfeits the multi-surface support the segment requires. Option 1 builds machinery with no
inputs. Option 2 keeps exactly the abstraction that is load-bearing — one internal invocation
interface, normalised streaming, so adding a surface later is not a rewrite — and discards the policy
layer above it that BYOK renders theoretical.

## Consequences

### Positive

- Substantially smaller surface, aimed at real customer configurations.
- Effort moves to credential custody and quota scheduling, which are mandatory and were unaddressed.
- Multi-surface support is correct from the start rather than bolted on.

### Negative

- **Contradicts v0.1 §10 and §11**, which should be reduced to roughly a third of their length when
  rewritten.
- A customer explicitly wanting cost-optimised routing is not served at MVP. Acceptable: they can
  express intent through explicit per-agent bindings.

### Neutral / follow-on work

- Fallback MUST distinguish a failed model call, which is safe to retry, from a partially executed
  tool call, which is not. This is v0.1 Rule 5 made concrete and belongs in the reliability spec.
- Quota Envelope discovery, configuration and enforcement need a dedicated design.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A deployment surface cannot be normalised | Medium | Medium | Adapter per surface; conformance tests; explicit unsupported-feature errors |
| Quota scheduling is under-designed and causes stalls | Medium | High | Model it as admission control with observable queue depth from day one |
| A design partner does require capability routing | Low | Low | Additive later; the broker does not preclude it |

## Revisit criteria

Reopen if the segment shifts toward self-serve, where Orchestra-owned keys and many concurrent models
would make routing meaningful again.
