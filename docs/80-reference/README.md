---
title: Reference
doc_id: DOC-090
version: 0.13.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Reference

Evaluations of external protocols and prior art. These record the evidence a decision rested on, so
that the reasoning survives independently of the decision record and can be re-examined when the
thing evaluated moves.

## Documents

| Document | Records the evidence behind |
| --- | --- |
| [`ag-ui-evaluation.md`](ag-ui-evaluation.md) | [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) — specification maturity, governance, ordering and replay, and the client bindings |
| [`a2ui-evaluation.md`](a2ui-evaluation.md) | [ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md) — version and stability, renderer availability, and the component catalog |
| [`mcp-evaluation.md`](mcp-evaluation.md) | Tool connectivity as a commodity rail — specification maturity, governance concentration, reachability, tool poisoning and schema versioning |
| [`langgraph-evaluation.md`](langgraph-evaluation.md) | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) — what the runtime supplies, what it does not, and the licence boundary between the two |
| [`prior-art-survey.md`](prior-art-survey.md) | [ADR-0015](../adr/adr-0015-governed-action-positioning.md) — where Orchestra sits against established products, and which differentiation claims survive |

## These evaluations moved two decisions

The section exists to let a decision be re-examined against evidence rather than memory, and on
2026-09-10 it did exactly that. Two Accepted ADRs were superseded as a result.

`langgraph-evaluation.md` established that the runtime supplies execution semantics under a
permissive licence but that run supervision — queueing, worker leasing and recovery, per-Tenant
concurrency, scheduling, drain — ships under terms a hosted multi-tenant product cannot build on.
[ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) followed.

`prior-art-survey.md` and `mcp-evaluation.md` together rated five of nine differentiation claims
contestable, reachability most clearly: two model vendors now ship SaaS-to-private-network tunnels
with no inbound listener. [ADR-0015](../adr/adr-0015-governed-action-positioning.md) followed, moving
the claim from connectivity to governed, accountable actions.

Neither evaluation decided anything. Each reported evidence, named the ADR it bore on, and said what
a superseding record would have to argue — which is the whole of an evaluation's job.

> **Status.** An evaluation is a snapshot, and all five state the date they were carried out. The
> projects they assess move quickly; a finding true on the investigation date may not be true when
> the decision is revisited, and each document says so. Every claim carries its source, and each
> records what an adversarial verification pass overturned — because a reader of a research record
> needs to know which findings were fragile.
