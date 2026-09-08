---
title: "ADR-0009: Meter from day one, defer tiering"
adr_id: ADR-0009
status: Accepted
date: 2026-09-08
deciders: [product-owner, platform-architecture]
tags: [commercial, metering, data-model]
depends_on: [ADR-0001, ADR-0002]
---

# ADR-0009: Meter from day one, defer tiering

## Status

Accepted

## Context

Under [ADR-0002](adr-0002-enterprise-segment-and-byok.md), BYOK removes token markup as a revenue
mechanism. The intended commercial model is tiers composed from seats, runs, agents and connectors.

The project is pre-customer. No price point, tier boundary or packaging assumption has been tested,
and enterprise contracts of this kind are hand-negotiated rather than self-served.

Metering and tiering have opposite risk profiles. **Metering cannot be applied retroactively** —
usage that was not recorded is gone. **Tiering is trivially changed** as long as the underlying
counts exist.

A specific ambiguity must also be resolved. "Seat" is undefined and the two candidates differ by
orders of magnitude: the customer's *platform users* who administer agents (tens to hundreds), or
their *end users* who converse with agents (potentially hundreds of thousands, if the SDK is embedded
in a customer-facing application). Mispricing this is fatal.

Relatedly, v0.1 §8's domain model contains no Tenant, User or Principal at all — yet approvals need
to record who approved, audit needs who requested, and seats need who counts.

## Decision drivers

- Unrecorded usage is unrecoverable; unset prices are not.
- Pre-customer packaging assumptions are guesses.
- Billing data must be defensible in a commercial dispute.

## Considered options

1. **Build the full tier builder now.**
2. **Meter now, price per deal, build tiering when customers exist.**
3. **Defer both.**

## Decision

Build **metering as a first-class, auditable subsystem from the first commit.** Defer the tier
builder and self-serve packaging entirely. Price the first contracts by hand.

Metered dimensions from day one:

| Dimension | Definition | Notes |
| --- | --- | --- |
| **Platform Users** | Distinct Principals authenticating to the Control Plane in a billing period | The seat-billable identity |
| **End Users** | Distinct end-user subjects observed via session tokens | Measured, explicitly **not** seat-billed |
| **Runs** | Executions of an Agent or Workflow, by outcome | Primary usage dimension |
| **Step Executions** | Executions of individual steps | Depth signal for future pricing |
| **Active Agents / Workflows** | Definitions with at least one run in the period | |
| **Connectors** | Enrolled connector instances, by health | Likely a tier lever |
| **Approvals** | Raised and resolved | Governance-value signal |
| **Tool invocations** | By Tool and Side-Effect Class | |
| **Model usage** | Tokens and calls per Model Binding | **Reported to the customer, never billed** — visibility is a feature under BYOK |

Meter records MUST be append-only, tenant-scoped, timestamped, idempotent under retry, and
reconcilable against the audit log.

## Rationale

Option 1 builds machinery against untested assumptions and creates commitment to a model no customer
has validated. Option 3 forfeits data that cannot be recovered. Option 2 preserves optionality at
almost no cost.

Metering End Users separately from Platform Users also settles the seat ambiguity in the data model
before it becomes a pricing mistake.

## Consequences

### Positive

- Pricing can be designed from evidence rather than assumption.
- Token reporting under BYOK becomes a customer-visible feature — cost attribution by department,
  agent and workflow — rather than a billing mechanism.

### Negative

- Manual invoicing for early customers. Acceptable at this stage and normal for enterprise contracts.
- Metering must be built correctly before it is commercially needed, which can feel premature.

### Neutral / follow-on work

- **Adds Tenant, Workspace, Principal, Platform User, End User and Service Account to the domain
  model**, which v0.1 §8 omitted entirely. Required by audit and approval independently of billing.
- Meter reconciliation and dispute handling need a runbook before the first invoice.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Metering gaps discovered after customers exist | Medium | High | Over-collect early; dimensions are cheap, history is not |
| Double counting under retry | Medium | Medium | Idempotent meter writes keyed on the event id |
| Chosen dimensions do not match eventual pricing | Medium | Low | Breadth of collection is the hedge |

## Revisit criteria

Reopen once three or more customers are in production and real usage shapes are observable. Tiering
should be designed from that data.
