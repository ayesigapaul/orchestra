---
title: Gateway API
doc_id: DOC-043
version: 0.14.0
status: Draft
last_updated: 2026-09-23
owners: [platform-architecture]
depends_on: [ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0010, ADR-0011, ADR-0012, ADR-0013, ADR-0042]
---

# Gateway API

The resource-oriented HTTP surface: what a customer's backend, a client SDK and the Control Plane
front end all call. It fixes the resource model, the authentication shapes, how a tenant is
established, which of two idempotency mechanisms a caller is using, and which outcomes an
implementation MUST keep distinguishable. It is not an endpoint catalogue.

## 1. Standing and scope

**Normative** ([`../README.md`](../README.md) section 3): implementations must conform. Keywords
carry their [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) meanings, and rules are numbered
`G1`–`G30` so other documents can cite them. **A citation MUST name this file** — `gateway-api.md`
G3 — because `G` is not unique across the normative set:
[`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) numbers its gate
rules `G1`–`G3`, and [`event-protocol.md`](event-protocol.md) numbered its carriage guarantees the
same way before moving them to `EG1`–`EG4`. Citations of another document's rules below are
qualified the same way, since `A`, `D` and `E` collide across
[`../40-governance/policy-model.md`](../40-governance/policy-model.md), `approval-workflows.md` and
[`../40-governance/audit-model.md`](../40-governance/audit-model.md) too. Renumbering the corpus
onto document-unique prefixes, as `event-protocol.md` has begun to, would be the durable fix and is
nobody's assignment yet.

**JSON Schema is the source of truth for every wire contract**
([`schemas/README.md`](schemas/README.md)). Prose describes intent precisely enough that a schema
can be derived from it and names which planned file carries it; no file under [`schemas/`](schemas/)
exists yet, and where a schema and this prose ever disagree the schema governs.
Orchestra is **pre-implementation and pre-customer**: no platform code, no endpoint implemented.
**No timeout, retention period, page size, rate limit, payload cap or credential lifetime appears
below**, because none is decided anywhere in this repository.

Three **Proposed** ADRs reach this document and are marked where they bear, none of them binding:
[ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) for the Run event stream this contract
attaches to, specified in [`event-protocol.md`](event-protocol.md);
[ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) for the Connector
resource entirely; [ADR-0010](../adr/adr-0010-a2ui-genui-interchange.md) for declarative UI, which
belongs to [`ui-protocol.md`](ui-protocol.md). The definition language, the policy language and
which container serves which path are owned by [`../50-workflows/`](../50-workflows/),
[`../40-governance/policy-model.md`](../40-governance/policy-model.md) and
[`../10-architecture/containers.md`](../10-architecture/containers.md).

## 2. What VERSIONING already fixed

[`../VERSIONING.md`](../VERSIONING.md) fixes this API's versioning shape completely, and it is cited
section by section rather than re-decided: section 4 for the major version in the path, dated
revisions in an `Orchestra-Version` header resolving to the tenant's pin and never to `latest`,
`Idempotency-Key` on every state-changing endpoint with the original response returned on replay,
`Deprecation` and `Sunset` headers, and support windows of 24 months for a revision after its
successor's release and 36 months for a major after its successor's GA; section 10 for the 12- and
24-month deprecation notices; section 7 for rejecting an unsupported revision or profile range at
session establishment; section 6 for `additionalProperties` never being `false` on a wire-facing
object. Nothing below may contradict any of it, and where a figure is repeated here that document
holds the only copy.

**Section 5 binds this contract too, and is not reopened below.** Stream resumption uses SSE
`Last-Event-ID`. The exact resumption semantics are specified by
[`event-protocol.md`](event-protocol.md) O4 and are not restated here; the Gateway is the component
that assigns `seq` and serves the replay, within the Run's event-retention
window and MUST fail explicitly rather than silently skip a gap. The Gateway is the component that
assigns `seq` and serves that replay, and [`event-protocol.md`](event-protocol.md) section 5 carries
the rest — contiguous per-Run `seq`, gap detection by arithmetic, at-least-once delivery
deduplicated on `event_id`. Only the window's length is open, and that document owns it. The stream
itself rests on [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md), **Proposed**: if it is
rejected the carrier changes, and these obligations are Orchestra's own either way, since the
upstream format supplies neither ordering nor replay.

**G1 — The must-ignore rule governs this contract** (R3). A consumer MUST silently ignore fields,
resource states, error codes, Side-Effect Class values and metered dimensions it does not recognise,
and MUST NOT fail, warn loudly or drop the envelope. Every additive change below relies on it.

**G2 — Must-ignore is a compatibility rule, not a defaulting rule.** An implementation MUST NOT
substitute a permissive default: an unrecognised Side-Effect Class MUST NOT become `read`, and an
unrecognised failure code MUST NOT become safe to retry. Where a value is security-relevant the safe
degradation is *unknown*, never *benign*.

## 3. Authentication shapes

[`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) sections 2
and 3 own the identity model, and enumerate one authentication shape per Principal subtype: five,
not two. Two *entry points* authenticate — the Control Plane's and the Gateway's, section 6 — and
the two are not the same count. What binds on this contract is the following.

**G3 — A Platform User administers through the Control Plane, authenticated by the tenant's
identity provider.** Orchestra holds no password and runs no sign-in of its own; that authentication
is an audited act and the seat-billable dimension (ADR-0009).

**G4 — An End User reaches this contract only with a Session Token.** Whatever credential a Service
Account presents is not a Session Token
([`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 3);
it is an access token the identity provider issued through the OAuth 2.0 client credentials grant,
which [ADR-0047](../adr/adr-0047-service-accounts-authenticate-with-client-credentials.md) records
as an **interim** class, and **no credential of either kind may appear in a browser or mobile
bundle, in client source, or in any artifact shipped to a device**
([`../GLOSSARY.md`](../GLOSSARY.md), `threat-model.md` T5). "Tenant API key" still appears in the
glossary only in the negative, as what a Session Token is never, and no credential on this contract
is one: a Service Account's is issued and signed by the identity provider, never minted or custodied
by Orchestra.

**G5 — Minting is a Gateway operation performed by a Service Account**, which presents its own
credential and asks Orchestra for a short-lived, narrowly scoped token for a named End User.
Orchestra does not authenticate the End User; it trusts an assertion the backend makes, which
[`../40-governance/threat-model.md`](../40-governance/threat-model.md) names boundary B1 and places
in its trusted-by-assumption set. Issuance and revocation are audited
([`../40-governance/audit-model.md`](../40-governance/audit-model.md) section 3); revocation removes
an authority, never an identity and never a recorded attribution.

**G6 — A Session Token's expiry bounds what may be started or sent, never the life of a Run
already admitted.** A Run may suspend at an Approval Request for days; were its authority to expire
with the admitting token, no suspended Run could resume. The Run records its Principal and pins its
versions at admission. This discharges the assignment
[`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 9
makes here, whatever the lifetime turns out to be.

```mermaid
flowchart LR
  IDP["Tenant identity provider"] -->|"federated sign-in"| CPE["Control Plane entry point"]
  BE["Customer backend — Service Account"] -->|"mint request"| GWE["Gateway entry point"]
  GWE -->|"Session Token"| BE
  BE -->|"hands the token to its own client"| APP["End User client — SDK"]
  APP -->|"Session Token"| GWE
  CPE --> API["One contract — this document"]
  GWE --> API
  API --> PEP["Run admission enforcement point"]
```

The mint is a command, and so a resource the caller creates (G28). Its path follows the layout
section 5 fixes, which [`ui-protocol.md`](ui-protocol.md) section 1 assigns to this document,
[`../VERSIONING.md`](../VERSIONING.md) section 4 fixes only as far as the `/v1` prefix, and
[ADR-0033](../adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) decides.

```http
POST /v1/session-tokens
Authorization: Bearer <service-account-credential>
Orchestra-Version: 2026-09-08
Idempotency-Key: <client-generated-uuid>
```

That last header is a collision worth naming, and the rule below resolves it.

**G30 — A replayed mint returns the mint, never the token.** `Idempotency-Key` requires the
original response on replay ([`../VERSIONING.md`](../VERSIONING.md) section 4) and a Session Token
is a live bearer credential, so **the response stored against the key MUST carry the mint's
identifier and its expiry, and MUST NOT carry the bearer value.** A replay returns that stored
response — the mint without the token — and a caller that lost the first response cannot recover
the token from it: it mints again, and the token it lost expires unused. **No live credential is
stored for replay**, on this contract or behind it. The same holds of any other command whose first
response carries a credential. G29 is unaffected: the replay names the same mint resource, so the
act is recognisably the one that already happened rather than a second one.

## 4. Tenant scoping, and the two idempotency keys

**G7 — The Tenant is resolved from the presented credential.** A tenant identifier a caller can
set, in a path segment, query parameter, body field or header, MUST NOT exist on this contract.
Where one appears in a representation it is an echo of what the credential established, never an
input. A caller-supplied tenant is an isolation defect, not a convenience.
[`credential-resolution.md`](credential-resolution.md) specifies the resolution.

**G8 — Every persisted record, emitted event and log line carries a tenant identifier** (invariant
I1, ADR-0011); isolation is enforced by row-level security in the datastore, and a missing tenant
predicate in application code MUST NOT be sufficient on its own to cross a boundary. A **reference
to another Tenant's resource MUST NOT be answered differently from a reference to one that does not
exist** — separating *forbidden* from *absent* across the boundary is an existence oracle, stated
as observable behaviour because the status vocabulary is undecided.

**G9 — A Workspace narrows visibility and administration and is not an isolation boundary** (domain
model section 3, `tool-authorization.md` TA4); it is enforced in application code and can be nowhere
else, since row-level security filters on the Tenant. A platform operator reaches this contract only
as a Platform Operator Principal of one Tenant
([ADR-0030](../adr/adr-0030-platform-operator-and-observed-conditions.md)), and G7 applies to it
unchanged: that Tenant is resolved from the credential, never set by the caller.

Two different mechanisms are called an idempotency key, and this is the likeliest place for a
serious bug.

**G10 — `Idempotency-Key` is request deduplication at the API boundary**: a header on one HTTP
request, caller-generated, scoped to that request, living for the retention window. **A Step
Execution's idempotency key is a different mechanism with a different lifetime** — idempotency,
retry and compensation are scoped to a Step Execution, never to the Run (invariant I4,
[ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md) follow-on 3). It is not a header,
not caller-supplied, and appears here only as a recorded attribute of a Step Execution. An
implementation MUST NOT derive one from the other, map one onto the other, or write "the idempotency
key" unqualified.

**G11 — A replayed submission MUST NOT create a second Run and MUST NOT re-run admission**, which
writes a Policy Decision for every evaluation (`policy-model.md` D1); re-evaluating would record two
admission decisions for one submission. The Gateway keeps no durable state, so it is not the
Gateway that honours this from a stored response: the **Run Supervisor** admits Runs, and it holds
the key with the Run in its own schema and returns what it stored
([ADR-0034](../adr/adr-0034-policy-decisions-commit-with-the-gated-change-and-leave-by-outbox.md),
[`../10-architecture/containers.md`](../10-architecture/containers.md) section 3). **A replayed
approval decision MUST NOT record a second decision**, since every Audit Record resolves to exactly
one Principal (`audit-model.md` A3).

**G12 — An idempotent replay is not a retry of a side effect.** Returning a stored response is
safe; re-attempting a partially executed Tool call is not (CLAUDE.md working rule 6,
`tool-authorization.md`
TA18), and the two MUST NOT share a code path. The window's length, and what happens when a key is
reused with a different payload, are decided nowhere; section 9 registers both.

## 5. The resource model

Derived from [`../20-domain/domain-model.md`](../20-domain/domain-model.md). Every resource is
tenant-scoped by G7. *Operations* names what may be done; G26 to G29, after the table, map it onto
paths.

| Resource | What it is | Operations | Governing rule | Schema |
| --- | --- | --- | --- | --- |
| Run | One execution of an Agent version or Workflow version | Submit, read, list; cancel, by a command (G28); attach the event stream | `policy-model.md` E1, V1; lifecycle section 2 | `run.v1` |
| Agent, Workflow, and their versions | Stable named definitions; publishing freezes an immutable version | Author a draft, publish, set current; read and retire a version | ADR-0008; VERSIONING W1–W4 | `workflow-definition.v1`; none for Agent |
| Approval Request | A gate raised by a `require_approval` verdict | Read; decide, or reassign the chain of a pending one, each by a command created against it (G28); never create, expire or re-raise | `policy-model.md` V2; `approval-workflows.md`; [ADR-0043](../adr/adr-0043-approval-chains-and-separation-of-duties.md) | `approval-request.v1` |
| Evidence Set | The exact inputs the Agent relied on | Read, under a separate narrower authorization | `approval-workflows.md` E1–E6 | `approval-request.v1` |
| Policy, Policy version | Tenant-authored rules, immutably versioned | Author a draft, publish; never edit a published version | ADR-0012; `policy-model.md` P5 | `policy-rule.v1` |
| Tool | A capability registered in the Tenant's Tool Catalog | Register, re-register, read, list | Invariant I5; TA1–TA3, TA9 | None planned |
| Capability grant | An Agent's or a Workflow's permission to call one registered Tool, within what its pinned version declares | Grant, revoke — audited separately from registration; a revocation stops the next invocation of a Run in flight | Invariant I5; TA1–TA3, TA5, TA19–TA23 | None planned |
| Connector | Customer-deployed software proxying Tool traffic inward | Enrol, read health, revoke | ADR-0007 — **Proposed** | `connector-envelope.v1` is the tunnel, not this |
| Model Binding | Surface, endpoint, credential reference, declared limits | Create, update, register or rotate a credential by reference | ADR-0006, ADR-0002; `threat-model.md` T5 | None planned |
| Session Token | A short-lived scoped client credential | Mint and revoke, each a command (G28) | GLOSSARY; section 3 | None planned |
| Audit Record | An append-only immutable fact | Read and query — and the read is itself audited | `audit-model.md` A1–A8 | `audit-record.v1` |
| Usage | Metered dimensions for a period | Read | ADR-0009 | None planned |
| Workspace, Principal | Administrative identity and scope inside a Tenant | Create, update, remove | ADR-0011; `identity-and-access.md` | None planned |
| Tenant | The isolation boundary every other row sits inside | Read and update. **No create and no remove on this contract**: G7 resolves the Tenant from the credential, so no caller can create the Tenant its own credential presupposes. A Tenant is created by an internal Tenant User Management operation that only Orchestra's provisioning client may call, for a Platform Operator, and the act is the first record in the new Tenant's trail ([ADR-0031](../adr/adr-0031-tenant-user-management-creates-tenants.md)). Onboarding stays an insert rather than an infrastructure step ([ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md)) | ADR-0011; `identity-and-access.md` | None planned |

**Addressing.** The paths follow JSON:API's recommended layout under `/v1`, as
[ADR-0033](../adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) decides, and
four rules map the operations above onto them.

**G26 — One collection per resource type.** Every resource type has one collection at
`/v1/{type}`, named by its `type` ([`http-conventions.md`](http-conventions.md) HC3), and each
resource is at `/v1/{type}/{id}`, resolved within the Tenant the credential established (G7). A
resource is created by `POST` to its collection and read at its own path, whatever relates to it.

**G27 — Relationships are links, never nesting.** A resource names what it relates to in
`relationships`, with `self` and `related` links of the forms
`/v1/{type}/{id}/relationships/{relationship}` and `/v1/{type}/{id}/{relationship}`, and no path is
nested deeper. No path segment names a Tenant (G7) or a Workspace (G9). A Workspace is a
relationship of the resources it scopes, and a collection narrowed by it takes a `filter[...]`
parameter ([`http-conventions.md`](http-conventions.md) HC5).

**G28 — A command is a resource that is created.** An operation that asks the platform to act,
rather than to store a representation the caller supplies, is created by `POST` in a collection of
its own, names what it acts on in `relationships`, and is answered as HC4 answers any creation. A
lifecycle transition a caller asks for is a command — deciding an Approval Request, cancelling a
Run, minting or revoking a Session Token. No operation writes a resource's lifecycle state
directly, and no path carries a verb.

**G29 — Every command has its own identifier.** A command stays readable at its own path, the Audit
Record of the act names it ([`../40-governance/audit-model.md`](../40-governance/audit-model.md)
A4), and a replay under the same `Idempotency-Key` returns the stored response naming the same
resource (G10, G11). Each command's type name, path and relationships are fixed when its operation
is specified, here and in the Gateway's OpenAPI document ([`http-conventions.md`](http-conventions.md)
HC14).

### 5.1 Runs

A Run pins the version it started with and executes it to completion, even after that version is
retired (invariant I3, VERSIONING W2–W3).

**G13 — A Run refused at admission is a created Run in `Denied`, not a failed submission.** `deny`
is refusal, not failure (`policy-model.md` V1), `Denied` is a real state with a persisted record
(lifecycle 2.1), and ADR-0009 meters Runs by outcome — a refusal that vanishes into a transport
error destroys the dimension a review cares about most. **Execution MUST NOT begin before the
admission Policy Decision is durable**
([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md); `policy-model.md` E5 and D3,
whose labels `approval-workflows.md` also uses for different rules): submission MAY return with the
Run in `Pending`, and MUST NOT return one in `Running` whose decision is not yet durable. The
Gateway authenticates the caller and forwards the submission; the Run Supervisor evaluates
admission and commits the Run, or its refusal, with the admission Policy Decision in one
transaction, so the durability this rule requires is that commit
([ADR-0034](../adr/adr-0034-policy-decisions-commit-with-the-gated-change-and-leave-by-outbox.md)).

**G14 — Resumption, migration and reopening are not operations on a Run.** A Run suspends at an
Approval Request or at a `wait` step, one state with a recorded reason (lifecycle 2.2), and resumes
when the request resolves or the wait elapses. Neither is a caller's to invoke: resuming a gated Run
directly would bypass the gate, and elapsed time has no acting Principal to attribute a resume to
(`audit-model.md` section 9). Terminal is permanent (lifecycle section 1): re-running means a new
Run referencing the old, and W3 forbids an in-flight migration ever being added.

**G15 — Cancellation stops orchestration, not side effects**: a Run cancelled mid-invocation
leaves that invocation in an unknown state, and unknown is not the same as not done (lifecycle 2.4).
It is authorized as an administrative act rather than by Policy — it is not one of the three
enforcement points, and
[ADR-0032](../adr/adr-0032-administrative-grants-are-orchestra-defined-roles.md) adds none to the
administrative path. **This document takes the assignment
[`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 7
makes; the table below is normative here.** The transition is audited with the cancelling Principal
and any Step Execution in flight.

| Principal | May cancel | Basis |
| --- | --- | --- |
| Platform User | Holding a role that permits cancellation, as an administrative grant — tenant-scoped, optionally Workspace-narrowed ([ADR-0032](../adr/adr-0032-administrative-grants-are-orchestra-defined-roles.md)) | The stop ADR-0003 implies must be reachable from the Control Plane |
| Service Account | With the same administrative grant | A backend that can start a Run must be able to stop one |
| End User | Only in a Conversation they are party to, and only where the Session Token's scope says so | Deny-by-default: absent an explicit scope, no |
| Connector | Never | Reachability is not authority (TA8) |
| Platform Operator | Under an administrative grant with an end time, issued on Orchestra's side for a recorded support case or incident | Operator access is an act by a Platform Operator Principal and needs no consent from the Tenant ([ADR-0030](../adr/adr-0030-platform-operator-and-observed-conditions.md)); how issuing the grant is authorized is registered in `identity-and-access.md` section 12 |

The End User row contains an undefined term: **what a Session Token's scope may contain is not
decided**, and it belongs to the delegation decision `tool-authorization.md` section 6 marks
ADR-required. Section 9 repeats that classification unchanged.

### 5.2 Definitions and their versions

**G16 — A published version has no update and no delete operation, and their absence is the
contract.** Publishing freezes an immutable version (W1); an operation that edited one would make
every Run's pin a lie. Retirement drains rather than kills (W4). **Archival is not an operation at
all**: it is caused by the last pinned Run reaching a terminal state, or by the last version naming
it being archived ([ADR-0041](../adr/adr-0041-nested-versions-execute-inside-the-parent-run.md)), so
no Principal acts and there is nothing for a caller to invoke — which is the whole of what this
contract decides about it. Its
Audit Record carries that cause and no Principal
([ADR-0030](../adr/adr-0030-platform-operator-and-observed-conditions.md), `audit-model.md` section
9). The compiled artifact is retained and never returned (ADR-0005, `audit-model.md` section 3).

**G17 — No rail vocabulary appears in any representation.** The orchestration runtime's, a model
provider's and the tool protocol's vocabularies MUST NOT appear in a field name, enum value,
resource name or error code (CLAUDE.md working rule 2,
[ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md), `audit-model.md` A8), and a
Checkpoint is never addressable (invariant I6). A rail-minted identifier MAY be carried as an opaque
value where it lets a customer reconcile against their own provider-side records — under BYOK
those are the customer's — but MUST NOT be typed, named or structured so as to expose the rail.

An Agent version and a Workflow version each pin the *major* version of each Tool schema they
declare (W5); a bump surfaces as an actionable warning and MUST NOT alter a published version, its
declaration or a capability grant. An invocation whose pinned major the Tool's origin no longer
serves is a precondition deny (section 7;
[`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) TA24).

### 5.3 Approval Requests and Evidence Sets

An Approval Request exists only as the consequence of a `require_approval` verdict
(`policy-model.md` V2), so **no create operation exists** and every request has a causing Policy
Decision. A decision on a request is a command, created against it (G28). The representation MUST
carry the proposed action as it would execute
(`approval-workflows.md` R1) and each evidence item's provenance (its E6), and MUST label a
model-generated justification as the Agent's argument rather than evidence (its E2). The Evidence
Set is immutable from raise time (its E4) and **MUST be read under a separate, narrower
authorization than the audit surface**, a Principal resolved into an Approval Chain reading the
Evidence Set of the request they decide on a request-scoped basis rather than a standing grant.
That rule is derived in
[`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 6,
which is informative and routes the binding form to
[`../40-governance/audit-model.md`](../40-governance/audit-model.md); that document's section 13
still registers who may read an Evidence Set as open, and section 9 here repeats its
classification.

**G18 — An approval resolution MUST NOT be represented as an `allow`.** The verdict was
`require_approval` and the resolution is a separate governance fact (`policy-model.md` V3): audit
must distinguish an action permitted by rule from one permitted by a human. What satisfies a chain,
who may sit in one, reassignment and decision deadlines are decided by
[ADR-0043](../adr/adr-0043-approval-chains-and-separation-of-duties.md) and stated in
[`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) sections 5 to 7.
One request carries the chain of every matching `require_approval` rule, and a gate no matching rule
gives a chain is refused at raise rather than raised. Reassigning a chain of a pending request is an
administrative act under an administrative grant, audited with its cause and the chain before and
after; it never records a decision, and never makes the acting Principal eligible. **Expiry and
re-raise are not operations**: a request expires when the earliest deadline its Policies declared
passes, much as a version is archived when its last pinned Run ends (G16), and proposing the action
again raises a new request from a new verdict. `Expired` MUST be distinct from `Rejected`.

### 5.4 Tools, the Tool Catalog and capability grants

Registration is not permission (invariant I5, TA1). **Registering a Tool and granting an Agent or a
Workflow permission to call it MUST be distinct operations, separately authorized and separately
audited**; a contract in which registration also permits invocation collapses what makes
authorization deny-by-default. Reachability is not authority (TA8): a Tool's representation MUST NOT
imply permission from the fact that Orchestra can reach its origin. The Side-Effect Class is
declared at registration (TA9) and enumerated; adding a value is additive under R2 and R3, subject
to G2. **A capability grant is a resource of its own, and the Tools a version declares are part of
the version** ([ADR-0042](../adr/adr-0042-declared-tools-and-capability-grants.md)). A grant names
an Agent or a Workflow and one registered Tool, never a version, and carries no condition on an
invocation, a restriction on arguments being a Policy's. Revoking a grant MUST take effect at the
next Tool enforcement point, Runs in flight included. How a grant is addressed on this contract
waits on the endpoint shape section 9 registers.

### 5.5 Connectors and Model Bindings

> **Connectors rest on a Proposed decision.**
> [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) binds only after
> design-partner validation. If it is rejected the Connector resource leaves this contract, Tools
> are reached over direct HTTPS only, and nothing else here changes.

A Connector is a Principal, so its enrolment credential is not a Session Token. Enrolment, first
session, every version negotiation outcome including refusals, and revocation are audited. A
connector below the minimum supported version is refused with an explicit, actionable error and
never silently degraded ([`../VERSIONING.md`](../VERSIONING.md) section 9).

**G19 — No operation on this contract returns credential material in any form**, masked, truncated,
re-encrypted or partial. The narrow ground is already settled: `threat-model.md` T5 forbids
rendering a credential in plaintext to any interface, support tool, export or error surface, and
[ADR-0002](../adr/adr-0002-enterprise-segment-and-byok.md) custodies by reference. The wider claim
— that custody is write-only with respect to every Principal — is derived in
[`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 10,
which names `threat-model.md` T5 as its normative home and records that T5 currently holds it open;
G19 does not wait on it. The credential is held by reference, so rotation changes the material
behind a stable reference and nothing a Tenant authored moves.

Deployment Surface is an enumerated value orthogonal to vendor
([ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md)); there is no `provider` field,
because one vendor's model is reachable through several surfaces with different authentication,
identifiers, regional behaviour and quota. The customer's own model identifier is an opaque
customer-supplied value under G17. An Agent version selects Model Bindings in order — a primary
and a declared fallback list — and **fallback between Tools MUST NOT exist**, because a second
Tool is a second side effect, not a second attempt at the first.

### 5.6 Audit and usage

Audit is a product surface, not a log level, readable by the Tenant's own Principals rather than
only by the platform operator (`audit-model.md` section 8), and read-only here. **No Principal reads
it by virtue of a subtype**: an explicit administrative grant is required, and a Service Account
holding one is a Principal like any other — `identity-and-access.md` section 6 derives both and
routes the binding form to `audit-model.md`, whose section 13 still registers the rule as open.
**G20 — A read of the audit surface or of an Evidence Set produces an Audit Record** naming the
reading Principal and the query scope (`audit-model.md` section 3, whose single combined row for the
two reads that document is expected to split when the authorization rule lands there); the recursion
terminates because the record of a read is an ordinary record. Records within a Run carry a
deterministic ordering key, and wall-clock timestamps MUST NOT be the sole basis for order
(`audit-model.md` A7). Retention periods are decided nowhere, and export — format, transport,
completeness proof — has no design.

Usage is read-only over ADR-0009's dimensions. **Model token usage is reported and never billed**;
under BYOK the tokens are already the customer's. Attribution beyond the metered dimensions does not
exist, and "department" maps onto Workspace. **No price, tier, package or invoice resource exists**:
ADR-0009 defers tiering and early contracts are priced by hand.

## 6. Whether the administrative API is this contract

[`../10-architecture/control-plane.md`](../10-architecture/control-plane.md) section 13 assigns this
question here. **Answer: one resource-oriented contract, served at two authenticating entry
points.** [`../VERSIONING.md`](../VERSIONING.md) enumerates nine versioned artifacts and contains
exactly one HTTP API; a second administrative contract would be a tenth, needing its own path major,
revision timeline, support window and deprecation notices, none of which that document provides. The
resources are the same resources — a Run submitted by a Service Account and cancelled by a
Platform User, an Approval Request raised on the execution path and decided administratively, a Tool
registered administratively and invoked under Policy — so two contracts would need two names or
two shapes for one thing, and a synonym for an existing term is a defect (CLAUDE.md working rule 3).
What differs between the paths is authentication and authorization, not representation.

**G25 — Attaching a Run's event stream is not a Session Token surface.** It is an operation on the
Run resource (section 5), and **any credential this contract accepts MAY establish a stream**: the
Tenant resolves from the authenticated Principal at stream establishment, whatever credential
established it, and what the profile requires is only that the credential resolve to exactly one
Principal and one Tenant before the first event ([`event-protocol.md`](event-protocol.md) sections 4
and 9, on [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md), **Proposed**). A
Session-Token-only stream would be unsatisfiable on this contract: G3 gives a Platform
User no Session Token at all, and [`ui-protocol.md`](ui-protocol.md) puts the approval surface,
delivered as an Agent Event, in front of one — so the single surface the first vertical slice ships
would have no delivery path. **The stream is attached whole or not at all**: `seq` is minted once
per Run, so that profile admits no per-reader filtering and this contract has no partial-stream
operation to offer — a Principal not entitled to everything a Run's stream carries is served a
narrower read by another surface, not a narrowed stream. Which container serves which path is
[`../10-architecture/containers.md`](../10-architecture/containers.md)'s, and its section 3 gives
the Gateway as the event-stream boundary while drawing the Admin Console no edge to it; section 9
carries that gap.

The cost, stated rather than hidden: one revision timeline couples administrative refinements to
execution changes, so a revision forced by the Control Plane moves the pin for a customer who only
submits Runs. Accepted because R3 keeps most changes revision-free, and two timelines would double
what a customer's change-management process must track.

## 7. Error taxonomy

A policy deny, an approval gate, a quota wait and an unreachable connector are different outcomes.
The envelope, code vocabulary and status mapping are decided by
[ADR-0025](../adr/adr-0025-json-api-http-contract.md): a JSON:API 1.1 error document, specified with
its code registry in [`http-conventions.md`](http-conventions.md). The governance rules below bounded
that choice, and they bind every code added to the registry:

- **G21 — Every failure MUST carry a retry-safety classification with three values, not two** —
  *safe*, *unsafe*, *indeterminate*. ADR-0006 requires that a failed model call, safe to retry, be
  distinguishable from a partially executed tool call, which is not; a boolean cannot express
  indeterminate, and unknown is not the same as not done.
- **G22** — a governance refusal MUST be distinguishable from a fault (`policy-model.md` V1), and
  `require_approval` MUST NOT be a failure at all: the Run is `Suspended`, or stays `Compensating`
  where the gated action is a compensating action, and the gate is a resource (its V2).
- **G23** — a refusal MUST NOT carry Policy rule text or the matched Policy version's content. It
  MAY carry an opaque decision reference; reading the decision is an audit read under section 5.6.
- **G24** — the taxonomy MUST be at least two levels, so an unrecognised code degrades to a
  recognised class under R3; under G2 that degradation is *unknown*, never *safe*.

| Outcome | What happened | Retry safety | Rule |
| --- | --- | --- | --- |
| Policy deny | A rule refused it; nothing was attempted | Never — re-attempting is not a retry | `policy-model.md` V1 |
| Precondition deny | No Catalog registration, a Tool the pinned version does not declare, no capability grant standing for it, or a pinned schema major the origin no longer serves; names no Policy | Never | `policy-model.md` A4; `tool-authorization.md` TA6, TA21, TA24 |
| Evaluation incomplete, or decision not durable | Fail closed; the gated action MUST NOT proceed | Safe — nothing ran | `policy-model.md` A3, N2 and D3; ADR-0013 |
| Approval gate | Not a failure; the Run suspended, or stays `Compensating` where the gated action is a compensating action | Not applicable | `policy-model.md` V2 |
| Quota wait | The customer's own provider-side ceiling; capacity, not fault | Wait, do not fail | ADR-0006 |
| Model call failed | No effect outside Orchestra | Safe | ADR-0006 |
| Tool call, outcome unknown | The far side may have acted | Indeterminate — never blind | Invariant I4 and ADR-0008, which hold whatever becomes of ADR-0007; `tool-authorization.md` TA18 is the connector-path instance |
| Connector refused | A governance-visible outcome, not an outage | Never | `tool-authorization.md` TA16, TA17 — ADR-0007, **Proposed** |
| Connector unreachable | Availability; safe only where the invocation demonstrably never left | Safe or indeterminate | ADR-0007 — **Proposed** |
| Unsupported revision or profile | Rejected at session establishment with a precise error | Fix and resubmit | VERSIONING section 7 |

A refusal MUST NOT be worked around by another route to the same Tool (`tool-authorization.md`
TA17).
[`../60-operations/`](../60-operations/) plans `reliability.md` as the internal failure taxonomy;
that document and this contract MUST agree, the first classifying a condition and the second
determining what a caller observes.

## 8. What the schemas must carry

Section 5 names the planned file for each resource, and **seven** have **none planned** — an Agent
definition, a Tool registration, a capability grant, a Model Binding, a Session Token mint, a usage
report, and the Workspace, Principal and Tenant administrative contracts. Section 7's error
envelope, once an eighth, is specified by [`http-conventions.md`](http-conventions.md). So the prose
above describes contracts nothing is scheduled to define. The mint is the one to name twice:
section 3's G30 fixes what a replay returns — the mint's identifier and its expiry, never the
bearer value — so the schema nothing is scheduled to write already has one member it may not carry
into a stored response. Every wire-facing object leaves
`additionalProperties` unset or `true`
([`../VERSIONING.md`](../VERSIONING.md) section 6), since `false` breaks R3; the `$id` embeds the
major version, on a base URI provisional pending domain registration.

## 9. Open questions

**ADR** means the choice is costly to reverse or spans components and must be recorded before
implementation; **No** means a later document suffices. Rows marked *repeated* carry the owning
document's classification unchanged. Two assignments are absent because this document answers them:
**which normative document carries the cancellation authorization rule** — this one, section 5.1
— and **whether the administrative API is the resource-oriented Gateway API** — it is, section 6. A
third question is answered rather than registered: **which credentials may establish a Run event
stream** — any this contract accepts, G25. The row on capability grants has left too:
[ADR-0042](../adr/adr-0042-declared-tools-and-capability-grants.md) decides what a grant names, that
a version's declared Tools are part of the version, and that an Agent version pins a Tool's schema
major (sections 5.2 and 5.4). How a grant is addressed in a path stays with the endpoint-shape row.
Two more have left the register: **the endpoint shape of this contract**, which
[ADR-0033](../adr/adr-0033-gateway-urls-follow-json-api-and-commands-are-created.md) decides and G26
to G29 state, and **whether a Session Token mint response may be stored under an
`Idempotency-Key`** — it may, carrying the mint's identifier and expiry and never the token, G30.

| Question | What would decide it | ADR required? |
| --- | --- | --- |
| The `Idempotency-Key` retention window, and the outcome of a key reused with a different payload | A later revision of this document; [`../VERSIONING.md`](../VERSIONING.md) section 4 fixes the obligation and names no window | No |
| What a Session Token's scope may contain, which leaves the End User cancellation row with an undefined term | The delegation decision [`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md) section 6 owns | **ADR** — *repeated* |
| Session Token, Service Account and enrolment credential lifetimes, the class being settled | A customer contract or design partner; [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) sections 3 and 9 fix only what they are not, and [ADR-0047](../adr/adr-0047-service-accounts-authenticate-with-client-credentials.md) fixes the Service Account's class as interim without fixing a lifetime | No — *repeated*, condition included: that document's section 12 classifies it *No, unless a lifetime enters a public contract, when [`../VERSIONING.md`](../VERSIONING.md) applies* — and this is that contract, so a lifetime landing here lands as a versioned obligation |
| The audit-retention period, and whether the rule is platform-wide, per Tenant or per record class | [`../40-governance/audit-model.md`](../40-governance/audit-model.md) section 11, on a customer contract | **ADR** — *repeated* |
| Audit export: format, transport, completeness proof, and self-serve versus operator-assisted | [`../40-governance/audit-model.md`](../40-governance/audit-model.md) section 12 | No — *repeated* |
| Whether an out-of-band replay endpoint exists alongside in-stream resumption — resumption itself is fixed by [`../VERSIONING.md`](../VERSIONING.md) section 5 and is not open, section 2 | [`event-protocol.md`](event-protocol.md) section 11 assigns it here, with its section 5; [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) leaves it open and is **Proposed** | No — *repeated* |
| What a Quota Envelope delay carries, and whether an envelope is declared, discovered or both — the carrier is settled, [`event-protocol.md`](event-protocol.md) section 10 putting the delay in the reserved `orchestra.quota.*` family rather than in the Run state machine, on [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md), **Proposed** | `quotas-and-metering.md` in [`../60-operations/`](../60-operations/), on the quota design ADR-0006 calls for | No — *repeated* |
| Schemas for an Agent definition, a Tool registration, a capability grant, a Model Binding, a Session Token mint, a usage report and the administrative contracts — the seven of section 8, none of which is planned | [`schemas/README.md`](schemas/README.md), in the schema batch | No |
| Which transport bindings this contract serves for the Run event stream, and the path under the Run that attaches it — the stream being an operation on the Run (G25) and not a JSON:API document — given that only the binary binding drops top-level extras silently and only the server-sent-events one carries a cursor | This document; [`event-protocol.md`](event-protocol.md) section 11 assigns it here, and its carriage guarantees hold on any answer | No — *repeated* |
| By which path a Platform User's client reaches a Run event stream, G25 admitting any credential this contract accepts while no edge to a stream is drawn for the Admin Console | [`../10-architecture/containers.md`](../10-architecture/containers.md) section 3, with [`ui-protocol.md`](ui-protocol.md) | No |
| Who within a Tenant may read the audit surface, and who may read an Evidence Set, which sections 5.3 and 5.6 depend on | [`../40-governance/audit-model.md`](../40-governance/audit-model.md) section 13, which owns the binding form of the derivation [`../10-architecture/identity-and-access.md`](../10-architecture/identity-and-access.md) section 6 routes to it | No — *repeated* |
| Whether declarative UI representations reach this contract at all, or only [`ui-protocol.md`](ui-protocol.md)'s | ADR-0010 validation step 2, **Proposed** and outstanding | No — *repeated* |
