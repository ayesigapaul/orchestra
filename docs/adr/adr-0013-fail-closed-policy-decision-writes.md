---
title: "ADR-0013: Policy Decision writes are fail-closed; other audit writes may degrade"
adr_id: ADR-0013
status: Accepted
date: 2026-09-09
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, audit, reliability]
depends_on: [ADR-0001, ADR-0003, ADR-0012]
---

# ADR-0013: Policy Decision writes are fail-closed; other audit writes may degrade

## Status

Accepted

## Context

The governance documents disagreed about what happens when the audit store is unreachable. The
policy model required a Policy Decision to be durable before the gated action is attempted. The
audit model recorded the same question as unmade and needing a decision. An implementer reading one
would build a system that halts; reading the other, one that degrades to fail-open.

This is not a detail. Under [ADR-0003](adr-0003-governance-layer-positioning.md) the product is
the ability to answer, under audit, who approved an action and on what basis. An action taken while
its Policy Decision could not be recorded is exactly the thing the platform sells against, and it
fails silently — nothing in the resulting trail shows that anything is missing.

The opposing pressure is equally real. A Policy Enforcement Point fires at every Step boundary
([ADR-0005](adr-0005-langgraph-as-compilation-target.md),
[ADR-0008](adr-0008-declarative-workflow-definitions.md)), so a blocking durable write on that path
makes the audit store's availability the platform's availability ceiling.

Both prior positions treated audit writes as one undifferentiated class. They are not.

## Decision drivers

- An unrecorded Policy Decision is indistinguishable, afterwards, from an action nobody governed.
- [ADR-0001](adr-0001-product-shape-multi-tenant-saas.md) requires deny-by-default before any Tool
  executes; proceeding when the platform cannot record why is the opposite posture.
- Making every audit write blocking couples unrelated failure domains — connector health telemetry
  should not be able to stop a Run.
- Availability arguments must not be allowed to erode the control the product is sold on.

## Considered options

1. **Fail closed throughout** — any audit write failure halts the governed action.
2. **Fail open** — audit writes are best-effort; execution proceeds.
3. **Split by record class** — Policy Decisions fail closed; other audit facts may degrade.

## Decision

**Option 3.**

- A **Policy Decision MUST be durable before the gated action is attempted.** If it cannot be
  written, the action MUST NOT proceed. This is the fail-closed path, and it applies at every Policy
  Enforcement Point.
- **Other Audit Records MAY degrade** — buffered, retried, written behind the action — provided the
  degradation is itself observable. Connector health transitions and comparable operational facts
  are in this class.
- Degradation MUST be visible: a period in which audit writes were degraded MUST be recoverable
  from the trail, so that a gap is never silent.
- The classification of a record is a property of the record class, not a runtime choice. An
  implementation MUST NOT downgrade a Policy Decision to the degradable class under load.

**Durable does not mean remote.** The requirement is that the decision survives a crash before the
gated action happens, not that it has reached the audit store. A durable local append — an fsync to
a write-ahead log, then asynchronous replication to the audit store — satisfies this rule and keeps
the network round-trip off the enforcement path. What the rule forbids is the best-effort case:
proceeding first and writing when convenient, where a crash in between loses the record and nothing
in the trail shows that anything is missing.

## Rationale

Option 1 is the strictest reading and the easiest to defend in a security review, but it makes every
audit write, including operational telemetry, a hard dependency of execution. That trades
availability for assurance the stricter class already provides.

Option 2 forfeits the product. A governance platform that proceeds when it cannot record the
decision has no claim to make.

Option 3 puts the strict guarantee exactly where the value is. The distinction is principled rather
than a compromise: a Policy Decision is the evidence that a control operated, and evidence written
after the fact that it guards is not evidence. Operational facts describe the system rather than
authorise an action, and a buffered write of one loses nothing that cannot be reconstructed.

The latency cost on the strict path is real and is accepted knowingly. It is a floor on how fast a
governed Step can be, and that floor is the product working rather than a defect in it.

## Consequences

### Positive

- The central guarantee is unambiguous: no governed action proceeds unrecorded.
- Operational audit volume cannot take execution down with it.
- The failure mode is loud. A platform that stops is diagnosed; a platform that quietly stops
  recording is discovered during an audit, much later.

### Negative

- **Audit store availability bounds the availability of every governed action.** This is the
  deliberate cost and it should be stated plainly to buyers rather than discovered by them.
- A durable local write sits on the latency path of every Step boundary and every Tool invocation.
  This is a local fsync rather than a network round-trip, but it is not free and it is unavoidable.
- Degraded periods for the second class require their own representation, so that a gap is
  attributable rather than invisible.

### Neutral / follow-on work

- Which record classes fall on which side is specified in `40-governance/audit-model.md`, within the
  rule set here. The split itself is not reopened there.
- What storage satisfies the local durable append, and the replication lag budget to the audit
  store, are datastore questions constrained by
  [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) and not decided here. The durability
  boundary itself is decided above.
- Replication lag is now a governed property rather than an operational detail: a decision that is
  locally durable but not yet replicated is still unreadable through the audit surface, so the lag
  bounds how current an audit query can be. `60-operations/observability.md` owns the signal.
- `60-operations/reliability.md` owns the failure taxonomy and the observable signals for a degraded
  period.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Audit store outage halts all governed execution | Medium | High | The accepted cost; mitigate with storage availability, not by weakening the rule |
| Latency pressure motivates reclassifying Policy Decisions as degradable | Medium | Existential | Classification is a property of the record class and normative here, not a runtime tuning knob |
| A degraded period passes unnoticed | Medium | High | Degradation MUST be recoverable from the trail; a silent gap is the failure this ADR exists to prevent |

## Revisit criteria

Reopen if a design partner demonstrates that the availability cost is unacceptable in their
environment, in which case the answer is likely a stronger storage guarantee rather than a weaker
rule; or if a third record class emerges that fits neither side.

## References

- [ADR-0003](adr-0003-governance-layer-positioning.md) — audit as the purchase driver
- [ADR-0012](adr-0012-policy-decisions-are-audit-records.md) — the record model this classifies over
