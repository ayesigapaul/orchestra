---
title: "ADR-0015: Differentiate on governed, accountable actions — not on connectivity"
adr_id: ADR-0015
status: Accepted
date: 2026-09-11
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: [ADR-0003]
superseded_by: []
tags: [product, strategy, scope, positioning]
depends_on: [ADR-0001, ADR-0002]
---

# ADR-0015: Differentiate on governed, accountable actions — not on connectivity

## Status

Accepted. Supersedes [ADR-0003](adr-0003-governance-layer-positioning.md), whose central move —
build the control surface rather than the rails — is carried forward. What changes is which
capabilities count as the control surface, and how the absorption risk is rated.

## Context

ADR-0003 named five differentiated capabilities: reaching tools behind an enterprise firewall,
custodying BYOK credentials across tenants, policy and approval as an administered system, audit and
attribution that survives a security review, and quota-aware scheduling.

The survey in [`../80-reference/prior-art-survey.md`](../80-reference/prior-art-survey.md) and the
evaluation in [`../80-reference/mcp-evaluation.md`](../80-reference/mcp-evaluation.md) rate five of
nine differentiation claims contestable on 2026-09-10 evidence. Four survive: audit with exactly one
Principal and a Policy basis; Approval as administered, tenant-scoped configuration; compilation of
a declarative Workflow into enforcement points that cannot be written around; and cross-runtime
neutrality, durable only for buyers whose estate genuinely spans clouds and runtimes. The survey's
"thin ice to build a category on" belongs to the audit row alone.

The reachability claim is the clearest loss. Two model vendors now ship SaaS-to-private-network
tunnels with no inbound listener — precisely the problem ADR-0007 was drafted to solve — and an
Apache-2.0, foundation-governed gateway addresses part of it as well. Under ADR-0003's own test,
"commodity, and improving without us", that capability is commodity.

The absorption risk is no longer hypothetical. ADR-0003 rated "a rail provider adds governance and
absorbs the category" at Medium likelihood, citing no evidence — and the evidence was already
available on the day it was accepted. Microsoft now describes centralised agent governance,
approval flows, ownership, policy enforcement and auditability as platform capabilities, with
guidance covering per-action authorisation, human approval, orchestration limits and action audit
logging ([Windows 365 for Agents governance and
auditability](https://learn.microsoft.com/en-us/windows-365/agents/governance-auditability)), an
administration surface for agent governance
([Agentic Center of Enablement](https://learn.microsoft.com/en-us/power-platform/release-plan/2026wave1/power-platform-governance-administration/automate-governance-agentic-center-enablement)),
and a risk-based model with named ownership, decision rights, release gates, approval and audit
trails ([Govern agents by
risk](https://learn.microsoft.com/en-us/agents/center-of-excellence/govern-agents-risk)). The
predicted shape has shipped.

Retaining the five-part story is therefore actively harmful: it directs a pre-customer year at
capabilities that vendors with far greater distribution are absorbing now.

## Decision drivers

- Do not defend ground the market has already taken.
- A differentiation claim that primary evidence contradicts is worse than a narrower one that holds.
- Pre-customer, the cost of competing on a commodity is a year, not a feature.
- A claim that governance itself is uniquely Orchestra's is untenable on this evidence and would
  discredit the rest of the record.

## Considered options

1. **Re-rate the five rows** and keep the structure.
2. **Narrow to the two durable rows** — approvals and audit — and claim those.
3. **Re-found the claim on governed actions**, treating connectivity as substrate and making the
   governance model and its evidence semantics the differentiation.
4. **Concede the category** and reposition entirely.

## Decision

**Adopt option 3. Orchestra does not differentiate on how agents reach tools. It differentiates on
the governance state and evidence attached to those actions.**

The product thesis becomes a claim about what an action *is*:

> A consequential agent action is a **governed state transition** with an accountable Principal, an
> applicable Policy, an explicit approval state where one is required, and durable evidence of the
> decision.

That is narrower than "governance" and more specific than "approvals and audit". It names a model,
not a feature list.

The layering follows from it, and the architecture already matches:

| Layer | Contents | Claim |
| --- | --- | --- |
| Substrate | Tunnels, model providers, tool protocols, execution runtime | Commodity. Orchestra consumes it |
| Orchestration | Definition schema, compiler, run supervisor | Necessary, owned, not the differentiation |
| Governance | Principal, Policy, approval, authorization | Where the claim begins |
| Evidence | Defensible action history: who authorised what, under which Policy, and what actually happened | The claim |

Capabilities are re-sorted accordingly:

| Capability | Strategic status |
| --- | --- |
| Firewall and tunnel connectivity | Commodity substrate |
| BYOK credentials, budgets, metering | Commodity platform capability |
| Tool Catalog and tool authorization | Expected platform capability |
| Policy enforcement | Market requirement, not a moat |
| Deterministic execution | An execution property, not differentiation |
| Enforcement points a definition cannot be written around | **Differentiation, and structural.** Compilation emits a Policy Enforcement Point at every Step boundary; a competitor's guardrails are guidance a modeller may skip. This is an architectural property rather than a feature, which is why it is hard to add without rebuilding |
| Administered approvals | Potential differentiation |
| Principal, Policy and durable evidence together | The core thesis |

**What this ADR explicitly does not claim.** Governance is not uniquely Orchestra's, and the
evidence above makes that claim untenable. Neither is the existence of the primitives — named
ownership, approval, release gates, audit trails are all shipping elsewhere. The claim is the
**particular governance model and evidence semantics** Orchestra builds: one accountable Principal
per action with no unattributed path, a Policy version pinned for the life of a Run, an approval
carrying the Evidence Set the model relied on, and a decision record durable before the action it
gates. Those are choices, and they are what a superseding record would have to attack.

## Rationale

Option 1 preserves a structure the evidence has emptied. Option 2 is honest but leaves the claim as
a feature list — approvals and audit are features, and features get copied. Option 4 discards
capability that is real.

Option 3 keeps what survived and makes it load-bearing. Approvals and audit stop being two rows in a
table and become the two halves of one claim about what an action is. It also makes the product
boundary coherent for the first time: Orchestra stops asserting ownership of the tunnel, which it
does not have and is not going to get, and asserts ownership of the record of what happened, which
it can define.

The decisions already taken support it rather than needing revision.
[ADR-0012](adr-0012-policy-decisions-are-audit-records.md) makes a Policy Decision a class of Audit
Record over a versioned Policy. [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) makes the
decision durable before the action it gates. Together those are the evidence semantics this ADR
claims as the differentiation — they were written as governance rules and turn out to be the product.

**"Durable" does not mean "safe forever."** The moat is not the primitives, and the same vendors are
moving toward exactly this territory. What can be defended is the model's coherence and the fact
that competitors attach governance to their own substrate, while Orchestra's claim is
substrate-neutral by construction.

## Consequences

### Positive

- The claim matches the evidence, so a security or procurement conversation does not open with a
  contestable assertion.
- Engineering effort stops competing with hyperscaler distribution on connectivity.
- Substrate improvements — better tunnels, better runtimes — become tailwinds rather than threats,
  which is ADR-0003's original argument now applied to the right layer.
- ADR-0007's connector is demoted from differentiation to plumbing, which is a relief rather than a
  loss: it is Proposed, unbuilt, and its premise is contested.

### Negative

- **The connector's justification weakens.** It may still be needed for reachability where vendor
  tunnels do not fit, but it can no longer be sold as differentiation. Whether it survives at all is
  now a question for ADR-0007's validation rather than a foregone conclusion.
- Evidence semantics are harder to demonstrate than a tunnel. A buyer sees connectivity working in a
  minute and an audit model in a procurement review.
- The claim is narrower, so the addressable story is narrower with it.

### Neutral / follow-on work

- `00-overview/product-thesis.md` is ADR-0003 expanded and must be rewritten against this record.
  `vision.md` and `scope-and-non-goals.md` carry the five-part story and need the same treatment.
- ADR-0007's revisit criteria should be re-read in this light: its value is now reachability where
  vendor tunnels do not reach, not differentiation.
- `70-delivery/mvp-definition.md`, unwritten, should scope against this claim rather than the
  five-part one — the first vertical slice is an approval surface with defensible evidence, not a
  connectivity demonstration.
- The evidence semantics named above should be stated once, normatively, in
  [`../40-governance/`](../40-governance/) rather than only here.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A platform vendor ships the same governance model on their own substrate | **High** | High | Rated High on shipped evidence, not on inference. Compete on substrate neutrality and depth of the model; a vendor's governance stops at their own runtime |
| Evidence semantics are too abstract to sell | Medium | High | Lead with the approval surface, which is concrete; the model is what survives the security review that follows |
| The two durable rows are also absorbed | Medium | Existential | Then the category is gone and this record is superseded again. Naming it here is the honest position |
| Narrowing reads as retreat internally | Medium | Low | The claim is more specific, not smaller; a feature list was never a position |

## Revisit criteria

Reopen if a platform vendor ships a substrate-neutral governance and evidence model, which would
remove the last structural distinction; if design partners consistently buy connectivity and treat
governance as a checkbox, which would falsify the thesis rather than the analysis; or if the
approval and evidence model proves undemonstrable in a sales cycle, which is a packaging problem
that would still need answering.

## References

- [ADR-0003](adr-0003-governance-layer-positioning.md) — superseded by this record
- [ADR-0012](adr-0012-policy-decisions-are-audit-records.md) and
  [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) — the evidence semantics claimed here
- [`../80-reference/prior-art-survey.md`](../80-reference/prior-art-survey.md) and
  [`../80-reference/mcp-evaluation.md`](../80-reference/mcp-evaluation.md) — the evidence
