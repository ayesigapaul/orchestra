---
title: Workflows
doc_id: DOC-060
version: 0.10.0
status: Draft
last_updated: 2026-09-10
owners: [platform-architecture]
---

# Workflows

The declarative Workflow definition language and its execution semantics, per
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

## What ADR-0008 reduced

"Build a workflow engine" became "build a schema and a compiler". Orchestra owns the definition
language, the validating compiler, policy injection, versioning and the audit trail. Durability,
checkpointing, interrupts and resumption come from the runtime and are not built here.

Compilation is the governance mechanism rather than an implementation detail: the compiler emits a
Policy Enforcement Point at every Step boundary, so governance cannot be bypassed by how a definition
is written. A definition author cannot opt a Step out of evaluation.

Two rules exist because the pressure runs the other way. **A ninth step type requires an ADR** — the
risk ADR-0008 rates highest is the definition language growing into a programming language. And **a
cyclic graph is rejected** until an ADR admits one: not checking would not be neutral, it would
decide the question permissively and W1 would then freeze every definition written under it.
Admitting cycles later is MINOR; withdrawing them is MAJOR.

> **Status.** Examples under [`examples/`](examples/) are not yet written, and the
> `workflow-definition` schema that makes the language checkable lives in
> [`../30-protocol/schemas/`](../30-protocol/schemas/) and is not yet written either. Until it is,
> this section describes a contract that nothing validates.
