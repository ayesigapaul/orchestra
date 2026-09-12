---
title: Glossary
doc_id: DOC-002
version: 0.9.0
status: Draft
last_updated: 2026-09-13
owners: [platform-architecture]
---

# Glossary

Canonical terms. Documentation, schemas, APIs and code MUST use these words with these meanings.
Where a term collides with LangGraph, MCP or AG-UI usage, the collision is called out — ambiguous
vocabulary is the most reliable predictor of an ambiguous contract.

---

## Tenancy and identity

**Tenant** — an isolated customer organisation. The unit of data isolation, billing, configuration
and audit. Every persisted record and every emitted event carries a `tenant_id`. No exceptions.

**Workspace** — an optional subdivision of a Tenant (e.g. *Finance*, *Logistics*), scoping agents,
workflows, connectors and policies. Enables delegated administration without cross-tenant risk.

**Principal** — any authenticated actor: a Platform User, an End User, a Service Account, or the
Connector itself. Every action in the audit log resolves to exactly one Principal.

**Platform User** — a person who administers Orchestra: defines agents, workflows, policies; approves
requests; reads audit logs. Authenticates via the tenant's IdP. **This is the seat-billable
identity.**

**End User** — a person interacting with an agent through the customer's own application. Identified
to Orchestra by the customer's backend via a scoped session token. **Not seat-billable** — see
[ADR-0009](adr/adr-0009-meter-first-defer-tiering.md).

**Service Account** — a non-human Principal used for machine-to-machine calls into the Gateway.

**Person** — a human, recorded once across every Tenant they belong to. A Person's name and email
come only from the identity provider, and a Tenant sees a Person only through its own Membership.
A Person is not a Principal and never acts: every action resolves to a Principal
([ADR-0024](adr/adr-0024-global-person-with-tenant-memberships.md)). An End User vouched for by
a customer's backend is a Person known to that Tenant alone, never merged with another.

**Membership** — a Person's place in one Tenant, and tenant-scoped. A Platform User and an End User
each belong to exactly one Membership, and a Tenant never sees a Person's Memberships elsewhere.

**Session Token** — a short-lived, narrowly scoped credential minted by Orchestra at the
request of the customer's backend and used by a client SDK. Never a tenant API key. Never present in
a browser or mobile bundle.

---

## Execution

**Agent** — a versioned, declarative definition: instructions, permitted tools, model binding,
policy bindings, and bounds. An Agent is configuration, not code.

**Workflow** — a versioned, declarative graph of Steps defining a business process. Steps may be
deterministic or agentic. Compiled, not interpreted. See
[`50-workflows/`](50-workflows/).

**Step** — one node in a Workflow. Typed: `agent`, `tool`, `approval`, `condition`, `parallel`,
`wait`, `transform`, `subworkflow`. Every Step declares a Side-Effect Class.

**Run** — one execution of an Agent or Workflow. The primary unit of execution, observability,
billing and audit. Pins the definition version it started with, for its whole life.

**Step Execution** — one execution of one Step within a Run. The unit at which idempotency keys,
retries and compensation apply. *Not* the Run.

**Conversation** — an ordered sequence of Messages between an End User and an Agent, spanning one or
more Runs.

**Checkpoint** — durable Run state permitting suspension and resumption. Supplied by the runtime;
never exposed in a public contract.

> **Collision note.** LangGraph also says *graph*, *node*, *state* and *checkpoint*. Orchestra's
> Workflow/Step/Run vocabulary is the public boundary; LangGraph's vocabulary MUST NOT appear in any
> customer-facing API, SDK, schema or document. See
> [ADR-0005](adr/adr-0005-langgraph-as-compilation-target.md).

---

## Capability and connectivity

**Tool** — a single invocable business capability with a versioned typed schema, a Side-Effect Class,
and an authorization binding. Exposed to Orchestra via MCP or a native adapter.

**Side-Effect Class** — the declared consequence class of a Tool or Step, and a primary input to
policy: `read` · `write` · `destructive` · `financial` · `external-communication`.

**Tool Catalog** — the tenant-scoped registry of Tools available for binding to Agents and Workflows.
Registration in the Catalog is an administrative act, distinct from an Agent being permitted to call
the Tool.

**Connector** — customer-deployed software running inside the customer's network. Establishes an
outbound session to Orchestra and proxies Tool traffic inward. Requires no inbound firewall rule. See
[ADR-0007](adr/adr-0007-outbound-connector-for-enterprise-reachability.md).

**MCP Server** — a Model Context Protocol server exposing Tools. Reached directly over HTTPS or via
a Connector.

---

## Governance

**Policy** — a tenant-authored rule evaluated at a Policy Enforcement Point, yielding
`allow` · `deny` · `require_approval`.

**Policy Enforcement Point (PEP)** — a place in the execution path where policy is evaluated and
enforced. Minimally: before any Tool invocation, at every Workflow Step boundary, and at Run
admission.

**Policy Decision** — a class of Audit Record: the recorded outcome of a PEP evaluation, holding a
reference to the Policy version that matched, the inputs, the verdict and the timestamp. Always
audited, including allows. See [ADR-0012](adr/adr-0012-policy-decisions-are-audit-records.md).

**Approval Request** — a human decision gate raised by a `require_approval` verdict. Carries the
proposed action, the evidence the agent relied on, the routing chain, and its resolution.

**Approval Chain** — the ordered or parallel set of Principals whose decisions an Approval Request
requires, derived from policy.

**Audit Record** — an append-only, immutable fact about something that happened, sufficient to
reconstruct who did what, when, on what basis, and under which Policy version. Audit is a product
surface, not a log level.

**Evidence Set** — the exact inputs an Agent relied upon when proposing an action: tool results,
retrieved context, prior messages. Attached to Approval Requests so a human approves on the same
information the model had, and retained for audit.

---

## Models

**Model Binding** — a tenant's configuration of one usable model: deployment surface, endpoint,
credential reference, the customer's own model identifier, and declared limits.

**Deployment Surface** — *where* a model is reached: Anthropic API, Azure OpenAI, AWS Bedrock,
Google Vertex AI, an OpenAI-compatible internal gateway, or a self-hosted endpoint. Orthogonal to
vendor: one vendor's model is reachable through several surfaces. See
[ADR-0006](adr/adr-0006-model-layer-as-credential-broker.md).

**BYOK** — Bring Your Own Key. The customer supplies the model credential; Orchestra custodies it under
envelope encryption and never resells tokens.

**Quota Envelope** — the customer's own provider-side rate and token limits for a Model Binding, which
Orchestra MUST schedule within. Under BYOK these are a steady-state capacity constraint, not an
exceptional failure mode.

---

## Interface

**Agent Event** — a normalised, ordered, replayable message on the Run event stream, admitted by the
Orchestra Agent Event Profile ([`30-protocol/event-protocol.md`](30-protocol/event-protocol.md)).
The profile is Orchestra's artefact and its own versioned contract; it pins an upstream draft event
format by commit and re-exports none of it as a promise. Provider-native and upstream-native
streaming formats are never exposed. See [ADR-0004](adr/adr-0004-adopt-ag-ui-event-protocol.md),
which is **Proposed**.

**UI Surface** — a declarative, agent-produced interface region rendered natively by an allow-listed
client renderer. Never executable code.

**UI Action** — a structured, validated event raised by an End User interacting with a UI Surface.

**Control Plane** — the Orchestra-operated administrative surface: agents, workflows, policies,
approvals, audit, connectors, credentials, usage. What the customer's platform team buys.

**Data Plane** — the execution path: Gateway, Runtime, Policy Enforcement Points, Model Broker,
Connector fabric.
