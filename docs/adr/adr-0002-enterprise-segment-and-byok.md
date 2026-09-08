---
title: "ADR-0002: Enterprise segment with BYOK model credentials"
adr_id: ADR-0002
status: Accepted
date: 2026-09-08
deciders: [product-owner, platform-architecture]
tags: [product, security, models, commercial]
depends_on: [ADR-0001]
---

# ADR-0002: Enterprise segment with BYOK model credentials

## Status

Accepted

## Context

Target segment and model-credential ownership were unstated in v0.1, yet together they determine the
network topology, the security model, the commercial model and the entire shape of the model layer.

The product owner has fixed both: the target segment is **enterprise**, and customers **bring their
own model credentials (BYOK)**. Orchestra does not resell tokens.

## Decision drivers

- Enterprises with existing AI governance route model traffic through Azure OpenAI, AWS Bedrock,
  Google Vertex AI, or a mandated internal gateway — because that is where their commercial
  agreements, network controls and spend commitments already exist.
- Enterprise business systems (ERP, WMS, core banking) are not reachable from the public internet.
- Without token markup, revenue must derive from platform value, not usage arbitrage.

## Considered options

**Segment:** enterprise · mid-market · developer self-serve.
**Credentials:** Orchestra-owned keys with markup · BYOK · both.

## Decision

Target the **enterprise segment** with **BYOK** model credentials. Orchestra custodies customer
credentials under envelope encryption and never resells tokens.

## Rationale

Enterprise is the segment for which governance is a purchase driver rather than a feature — which is
the premise of [ADR-0003](adr-0003-governance-layer-positioning.md). BYOK is what that segment
demands, and it removes a class of commercial risk (token cost exposure, provider rate-limit
pooling, abuse) at the cost of removing an obvious revenue mechanism.

Critically, BYOK also changes the *shape* of the model layer, not merely its ownership — see
[ADR-0006](adr-0006-model-layer-as-credential-broker.md).

## Consequences

### Positive

- No provider cost exposure and no token-margin pressure.
- The customer's existing DPA, residency posture and spend controls carry over, removing several
  procurement objections.

### Negative

- Orchestra custodies enterprise LLM credentials, which is a serious security responsibility requiring
  KMS-backed envelope encryption, per-tenant data keys, key rotation, and provably no plaintext in
  logs or backups.
- The customer's provider quota becomes Orchestra's steady-state capacity ceiling. This demands
  quota-aware scheduling, which v0.1 did not contemplate.
- Model availability varies per tenant. Nothing in the platform may assume a specific model exists.
- Long enterprise sales cycles; the platform must satisfy security review before revenue.

### Neutral / follow-on work

- Distinguish the two meanings customers attach to BYOK: *control of spend and provider relationship*
  versus *data must not transit Orchestra infrastructure*. Only the second implies a hybrid data-plane
  topology. This MUST be tested with design partners before it is architected for.
- Deployment surfaces to support at MVP: Azure OpenAI, AWS Bedrock, Anthropic API, and a generic
  OpenAI-compatible base URL for internal gateways.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Credential compromise | Low | Existential | Envelope encryption, per-tenant data keys, no plaintext at rest or in logs, audited access paths |
| Customer quota exhaustion degrades UX | High | Medium | Quota-aware scheduling, transparent backpressure, explicit user-facing signals |
| BYOK actually means "no data egress" | Medium | High | Validate with design partners before committing to topology |
| Revenue model unproven without token markup | High | High | See [ADR-0009](adr-0009-meter-first-defer-tiering.md) |

## Revisit criteria

Reopen if a mid-market or self-serve motion is added, which would likely require an
Orchestra-keys-with-markup option alongside BYOK.
