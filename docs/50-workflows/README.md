---
title: Workflows
doc_id: DOC-060
version: 0.17.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
---

# Workflows

The declarative Workflow definition language and its execution semantics, per
[ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md), which carries forward the
declarative-and-compiled decision of superseded
[ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md).

This section is not one of the two normative sections — only [`../30-protocol/`](../30-protocol/)
and [`../40-governance/`](../40-governance/) bind. But the **definition language is a permanent
public contract**: [`../VERSIONING.md`](../VERSIONING.md) section 8 calls customer-authored workflows
the most dangerous versioning problem in the platform, because executions are long-lived and an
approval may sit for days. W1 freezes a published version; R3 makes the contract additive-only.

## Documents

| Document | Specifies |
| --- | --- |
| [`workflow-dsl.md`](workflow-dsl.md) | The definition language, what the compiler validates, and why compilation is the governance mechanism |
| [`step-types.md`](step-types.md) | The eight step types, what each declares, and what a Policy Enforcement Point sees at its boundary |
| [`execution-semantics.md`](execution-semantics.md) | Version pinning, idempotency, compensation, cancellation and the failure taxonomy |
| [`examples/`](examples/) | Three processes walked through as governed Runs — invoice payment, purchase approval and a shipment exception — each with a trace of every enforcement point |

## What ADR-0008 reduced, and what ADR-0014 put back

"Build a workflow engine" became "build a schema and a compiler". Half of that held. Orchestra does
not build graph execution, checkpointing, interrupts or the resume mechanism, which are the runtime
library's ([ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md)). But the reduction
conflated execution semantics with run supervision, and
[ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) names the second as Orchestra's:
persisting run intent, leasing work to workers, per-Tenant concurrency, waking a waiting Run, and
job-level retry. Orchestra owns the definition language, the validating compiler, policy injection,
versioning, the audit trail and the run supervisor.

Compilation is the governance mechanism rather than an implementation detail: the compiler emits a
Policy Enforcement Point at every Step boundary, so governance cannot be bypassed by how a definition
is written. A definition author cannot opt a Step out of evaluation.

Two rules exist because the pressure runs the other way. **A ninth step type requires an ADR** — the
risk ADR-0008 rates highest is the definition language growing into a programming language. And **a
cyclic graph is rejected** until an ADR admits one: not checking would not be neutral, it would
decide the question permissively and W1 would then freeze every definition written under it.
Admitting cycles later is MINOR; withdrawing them is MAJOR.

> **Status.** Three worked examples are written under [`examples/`](examples/).
> [`../30-protocol/schemas/workflow-definition.v1.schema.json`](../30-protocol/schemas/workflow-definition.v1.schema.json)
> now fixes the document shape `workflow-dsl.md` section 2 specifies — and fixes only that. It
> deliberately does not make the language checkable: L9 puts that authority in the compiler rather
> than the schema, because ignoring an unknown construct would drop an author's intent, and where
> that intent was a governance one the loss is invisible. The expression syntax, the input type
> notation and the branch labels stay unconstrained there because they are undecided here.
