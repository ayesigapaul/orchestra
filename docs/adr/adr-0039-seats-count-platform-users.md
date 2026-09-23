---
title: "ADR-0039: A seat is a Platform User, and Service Accounts are measured without being billed"
adr_id: ADR-0039
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: [ADR-0009]
superseded_by: []
tags: [commercial, metering, data-model, identity]
depends_on: [ADR-0001, ADR-0002, ADR-0011, ADR-0024]
---

# ADR-0039: A seat is a Platform User, and Service Accounts are measured without being billed

## Status

Accepted. Supersedes [ADR-0009](adr-0009-meter-first-defer-tiering.md), whose decision to meter from
day one and defer tiering, whose meter-record rules and whose other dimensions this record carries
forward unchanged. What it replaces is one dimension's wording — *Platform Users*, defined as
"distinct Principals authenticating to the Control Plane" — and what it adds is one measured,
never-billed dimension.

## Context

ADR-0009 settled the seat ambiguity that mattered most: a Tenant's Platform Users number in the tens
to hundreds while its End Users may number in the hundreds of thousands, so pricing the second
population as administrators misprices by orders of magnitude. It named nine dimensions, made
*Platform Users* the seat-billable one, and metered End Users separately and explicitly never
seat-billed.

It also left one thing unclean, in its own wording. The dimension is named **Platform Users** and
noted as "the seat-billable identity", while its definition counts "distinct **Principals**
authenticating to the Control Plane in a billing period". A Principal is not a Platform User. The
[`../GLOSSARY.md`](../GLOSSARY.md) names the Platform User as the seat-billable identity, and
[`quotas-and-metering.md`](../60-operations/quotas-and-metering.md) section 13 already reads the
dimension against its own name — and then registers that reading, because reading a decided
dimension narrower than its words is a commercial effect no document may take on its own.

The gap is not theoretical. A Service Account is a non-human Principal used for machine-to-machine
calls, and [ADR-0024](adr-0024-global-person-with-tenant-memberships.md) makes it a Principal on no
Membership. On ADR-0009's words, a customer's nightly integration job billing as an administrator is
the correct reading. Three documents register it as unanswered:
[`personas.md`](../00-overview/personas.md) section 5,
[`control-plane.md`](../10-architecture/control-plane.md) section 11 and
`quotas-and-metering.md` section 14 — the last marking it **ADR required**, because both narrowing
the seat-billed population and adding a dimension change a fixed commercial dimension set.

A fifth Principal subtype has since arrived. ADR-0030 adds the **Platform Operator**: a person
acting for Orchestra on one Tenant's records, tenant-scoped, and never a Platform User. Nothing
should be able to read the seat rule as billing a Tenant for Orchestra's own access to it.

Narrowing the seat costs nothing to correct now and cannot be corrected after an invoice. ADR-0009's
own mitigation for a metering gap is "over-collect early; dimensions are cheap, history is not", and
superseding an ADR to correct it does not need its revisit criteria met —
[ADR-0016](adr-0016-compile-to-the-langgraph-library.md) superseded
[ADR-0005](adr-0005-langgraph-as-compilation-target.md) on the same basis.

## Decision drivers

- One reading of the seat, in the ADR that decides it, not a document narrowing an ADR's words.
- No machine Principal priced as an administrator, and no Tenant billed for Orchestra's own access.
- Visibility of machine callers, which is a real operational and commercial signal, kept without
  billing it.
- Everything else ADR-0009 decided carried forward unchanged, because none of it is in question.
- Unrecorded usage is unrecoverable; an unset price is not.

## Considered options

1. **Keep ADR-0009's wording.** A Service Account that touches the Control Plane bills as a seat.
2. **Supersede it so the seat counts Platform Users only**, with no visibility of machine callers.
3. **Option 2, plus a measured, never-billed Service Accounts dimension.**

## Decision

**Option 3.**

### Carried forward from ADR-0009, unchanged

Metering is a **first-class, auditable subsystem from the first commit**. The tier builder and
self-serve packaging are deferred entirely, and the first contracts are priced by hand and invoiced
manually. Meter records MUST be append-only, tenant-scoped, timestamped, idempotent under retry, and
reconcilable against the audit log, because billing data must be defensible in a commercial dispute.
Unrecorded usage is unrecoverable, unset prices are not, and no price, tier boundary or seat cost
exists anywhere in this repository.

### The seat

**A seat is a Platform User.** Of the Principal subtypes, only a Platform User consumes one:

| Principal subtype | Seat? | Why |
| --- | --- | --- |
| Platform User | **Yes** | The seat-billable identity, as the glossary has always had it |
| End User | No | Measured, explicitly never seat-billed — ADR-0009's own rule, unchanged |
| Service Account | No | Non-human, and a machine caller priced as an administrator misprices by construction. Measured instead, as a dimension of its own |
| Platform Operator | **Never** | Acts for Orchestra, not for the Tenant, and is not a Platform User. Billing a Tenant for Orchestra's own access to it would be charging a customer for being supported |
| Connector | No | Already metered as *Connectors, by health*; it is a machine Principal and never an administrator |

A Service Account, a Platform Operator or a Connector authenticating changes nothing else: each is a
Principal, and every act it takes is attributed and audited on the same terms
([`audit-model.md`](../40-governance/audit-model.md) section 3). What none of them does is consume a
seat.

### The metered dimensions

Ten dimensions, from day one. The first nine are ADR-0009's, with *Platform Users* stated against
its own name; the tenth is new.

| Dimension | Definition | Notes |
| --- | --- | --- |
| **Platform Users** | Distinct **Platform Users** authenticating to the Control Plane in a billing period | The seat-billable identity, and the only one |
| **End Users** | Distinct end-user subjects observed via session tokens | Measured, explicitly **not** seat-billed |
| **Service Accounts** | Distinct Service Accounts authenticating to Orchestra in a billing period, at the Control Plane or the Gateway | **Measured, never billed** — visibility of machine callers, on the same footing as model usage |
| **Runs** | Executions of an Agent or Workflow, by outcome | Primary usage dimension |
| **Step Executions** | Executions of individual steps | Depth signal for future pricing |
| **Active Agents / Workflows** | Definitions with at least one run in the period | |
| **Connectors** | Enrolled connector instances, by health | Likely a tier lever |
| **Approvals** | Raised and resolved | Governance-value signal |
| **Tool invocations** | By Tool and Side-Effect Class | |
| **Model usage** | Tokens and calls per Model Binding | **Reported to the customer, never billed** — visibility is a feature under BYOK |

Three dimensions are measured and never billed — End Users, Service Accounts and model usage — and
that is a property of the dimension, not a pricing decision deferred. Billing any of them would turn
a reporting surface into a markup.

**A new dimension needs the matching audited act.** A Service Account authenticating is an audited
fact, so that the dimension reconciles against the trail as `audit-model.md` section 7 requires of
every metered occurrence. `audit-model.md` section 3's enumeration gains that row.

**What this amends.**

- ADR-0009 is superseded, and its status and front matter say so.
- `quotas-and-metering.md` sections 8, 9, 13 and 14: ten dimensions rather than nine, the counting
  rule as a decision rather than a reading, and the register row discharged.
- `audit-model.md` sections 3 and 7: the seat row's grounding, a row for a Service Account
  authenticating, and the dimension count.
- `personas.md` section 5 and `control-plane.md` section 11: the seat question is answered, and both
  stop registering it.
- `domain-model.md` section 8: measured but never seat-billed now names the Service Account beside
  the End User.

## Rationale

**Option 1 prices a machine as an administrator.** It is defensible only as an accident of wording.
The glossary, the domain model, `personas.md`, `control-plane.md` and `quotas-and-metering.md` all
read the seat as the Platform User, and every one of them then flags the ADR's wider words. A
customer discovering that their integration account billed as a seat is a commercial argument
Orchestra would lose, and a correction after an invoice is a refund rather than an edit.

**Option 2 corrects the seat and loses the signal.** The count of machine callers matters
operationally, matters in a capacity conversation, and is exactly the kind of history ADR-0009 says
cannot be recovered later. Dropping it to fix the seat trades a cheap thing for an unrecoverable one.

**Option 3 costs one more dimension to reconcile**, which is the price ADR-0009 already argues is
worth paying: "over-collect early; dimensions are cheap, history is not". It leaves the seat
unambiguous in the record that decides it, keeps the machine-caller signal, and commits to no price
for it.

**Naming the Platform Operator explicitly** costs nothing and closes a reading nobody wants. It is
not a Platform User, so the dimension already excludes it; saying so means no future implementer has
to derive it.

## Consequences

### Positive

- One reading of the seat, in the ADR that decides it, with no document narrowing an ADR's words.
- No machine Principal and no Orchestra operator is ever priced as an administrator.
- Machine callers are visible from day one, on a dimension that can inform pricing later without
  having been priced now.
- Three registers close, and `quotas-and-metering.md` section 13 stops holding a commercial reading
  it was not entitled to make.
- Everything ADR-0009 decided survives intact, so nothing built against it changes.

### Negative

- **The seat-billed population is narrower than ADR-0009's words**, which is a commercial effect.
  It is the right one, and it is smaller than the alternative.
- One more dimension to collect, store and reconcile, and one more audited act to enumerate.
- A dimension that is measured and never billed invites the question of whether it ever should be,
  and answering that later looks like a price rise.
- The Service Accounts dimension spans two authentication surfaces, so it does not key on one entry
  point the way *Platform Users* does.

### Neutral / follow-on work

- Add the Service Account authentication act to the audit enumeration, and give it the occurrence
  identifier every metered occurrence carries.
- Meter reconciliation and dispute handling still need a runbook before the first invoice, which is
  ADR-0009's follow-on and is not discharged.
- The glossary's *Platform User* entry already names the seat; no vocabulary changes here.
- Whether a Service Account's Gateway authentication is audited per authentication or per credential
  resolution is the metering design's, with `credential-resolution.md`.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The narrower seat turns out to underprice a customer whose work is mostly machine-driven | Medium | Medium | The Service Accounts dimension is collected from day one, so the evidence for a different model exists before the model is needed |
| The Service Accounts count is read as a price signal by a customer | Low | Medium | It is stated as measured and never billed wherever it appears, in the same words as model usage |
| A Service Account's authentications are counted differently at the two surfaces | Medium | Low | One occurrence identifier and one dimension definition; reconciliation surfaces a mismatch as a defect |
| A Platform Operator's access is counted somewhere as tenant usage | Low | Medium | Named explicitly here as never a seat, and it is not a Platform User |
| Superseding ADR-0009 is read as reopening metering or tiering | Low | Medium | This record carries both forward verbatim in its own Decision, and changes neither |

## Revisit criteria

Reopen this decision in any of these cases:

- Three or more customers are in production and real usage shapes are observable, which is ADR-0009's
  own criterion and the point at which tiering should be designed from data.
- A customer's machine callers dominate their usage, making a never-billed dimension the wrong shape.
- A new Principal subtype arrives whose relationship to the seat is not obvious from this table.
- A pricing model that is not seat-based makes the dimension's name the wrong question.

## References

- [ADR-0009](adr-0009-meter-first-defer-tiering.md) — superseded; meter from day one and defer
  tiering are carried forward
- [ADR-0002](adr-0002-enterprise-segment-and-byok.md): why token markup is not a revenue mechanism
- [ADR-0024](adr-0024-global-person-with-tenant-memberships.md): Principals, and a Service Account on
  no Membership
- [`../GLOSSARY.md`](../GLOSSARY.md): Platform User, End User, Service Account
- [`../60-operations/quotas-and-metering.md`](../60-operations/quotas-and-metering.md) sections 8, 9,
  13 and 14
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) sections 3 and 7: the audited
  act behind a metered dimension, and reconciliation
- [`../00-overview/personas.md`](../00-overview/personas.md) section 5 and
  [`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) section 11: the
  registers this answers
