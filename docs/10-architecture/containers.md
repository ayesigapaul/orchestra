---
title: Containers
doc_id: DOC-022
version: 0.23.1
status: Draft
last_updated: 2026-09-13
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0011, ADR-0012, ADR-0013]
---

# Containers

The [C4](https://c4model.com) Level 2 view: the deployable pieces inside Orchestra, what each is
responsible for, what it holds, what it calls, and what it must never do.
[`system-context.md`](system-context.md) is the Level 1 view this decomposes.

**This document is informative.** Only [`../30-protocol/`](../30-protocol/) and
[`../40-governance/`](../40-governance/) are normative ([`../README.md`](../README.md) section 3),
so where a rule binds this links rather than restating it. Two copies of a normative rule drift, and
the copy in the informative document is the one that silently wins in someone's memory.

**Orchestra is pre-implementation.** No platform code exists. A container below is a unit of
responsibility with a name and a boundary, not a running service; which of them share a process,
host or release is a deployment question `deployment-topologies.md`, planned in
[`./README.md`](README.md), owns.

## 1. The two planes

[`../GLOSSARY.md`](../GLOSSARY.md) fixes the split and names the principal members of each side. The
**Control Plane** is the administrative surface — agents, workflows, policies, approvals, audit,
connectors, credentials, usage. The **Data Plane** is the execution path — Gateway, Runtime, Policy
Enforcement Points, Model Broker, Connector fabric. This document adds what each member does and
enumerates the containers completely, so one name below is not on the glossary's list: Tool
Invocation, the path by which a Tool is reached whatever its transport. That is an enumeration
difference, not a second boundary — a container that appears to belong on both sides is still a
naming error.

Both planes are operated by Orchestra
([ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md)). The hybrid shape — hosted control
plane, customer-deployed data plane — appears in ADR-0001's revisit criteria and as option 3 in
[ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md), and is not the
architecture today; no container below is designed for it.

The planes couple in two directions and no more. Definitions and Policies flow into the Data Plane
as compiled, versioned artifacts; facts — Policy Decisions, Audit Records, meter records, Run
state — flow back. Neither is a synchronous dependency of the other, with two exceptions. The
durable Policy Decision write of section 5 may make one, depending on a mechanism ADR-0013 leaves
open. Authentication does make one: the Gateway resolves every credential through Tenant User
Management, a Control Plane container, and rejects the request when it cannot
([ADR-0024](../adr/adr-0024-global-person-with-tenant-memberships.md)).

## 2. Container diagram

```mermaid
flowchart TB
  PU["Platform User"] --> CONSOLE
  EU["End User, via the customer's backend"] --> GW
  subgraph CP["Control Plane"]
    CONSOLE["Admin Console"] --> CPAPI["Control Plane API"]
    CPAPI --> COMP["Definition Compiler"]
    CPAPI --> CRED["Credential Custody"]
    CPAPI --> MET["Metering"]
    CPAPI --> TUM["Tenant User Management"]
  end
  subgraph DP["Data Plane"]
    GW["Gateway"] --> RT["Runtime"]
    GW --> PEV["Policy evaluation — location undecided, section 5"]
    RT --> PEV
    RT --> MB["Model Broker"]
    RT --> TOOL["Tool Invocation"]
    TOOL -.-> CONN["Connector fabric — planned, ADR-0007"]
  end
  COMP -->|"compiled graph, pinned version"| RT
  GW -->|"resolves every credential; fails closed"| TUM
  CPAPI --> DS[("Tenant-scoped datastore")]
  TUM --> DS
  PEV -->|"Policy Decisions; durable-write mechanism open"| DS
  MET --> DS
  DP -->|"metered occurrences"| MET
  CRED --> KMS["Key management service"]
  MB --> SURF["Model deployment surfaces"]
  TOOL --> ORIGIN["MCP Servers and native adapters"]
  CONN -.-> CUSTOMER["Customer-deployed Connector"]
```

Dotted edges rest on **Proposed** ADR-0007 and are not binding.

## 3. The containers

| Container | Plane | Responsibility | Holds | Calls | Must never |
| --- | --- | --- | --- | --- | --- |
| Admin Console | Control | The Platform User's surface: authoring, approvals, audit and usage views | Nothing durable | Control Plane API only | Reach the datastore, the Runtime or a model surface directly |
| Control Plane API | Control | Definition and Policy authoring and publish, Tool Catalog registration and capability grants, Connector enrolment (planned, ADR-0007), Model Binding configuration, approval resolution, audit and usage reads, and tenancy administration by calling Tenant User Management | Every tenant-scoped administrative record except those Tenant User Management owns | Datastore, Definition Compiler, Credential Custody, Tenant User Management | Execute a Run, hold a plaintext credential, or keep a copy of a Person's attributes |
| Tenant User Management | Control | Owns Tenants, Workspaces, Persons and Principals, and resolves a presented credential to exactly one Principal and one Tenant for the Gateway ([ADR-0024](../adr/adr-0024-global-person-with-tenant-memberships.md)) | The tenant directory, exempt from row-level security and holding routing facts only; tenant profiles, Workspaces, Memberships and Principals under forced row-level security, and global Persons each visible to a Tenant only through its own Membership, all in its own schema | Datastore, Keycloak | Resolve a credential to more than one Principal or Tenant, admit a caller it could not resolve, or hold a credential's secret |
| Definition Compiler | Control | Validates a declarative Agent or Workflow definition, emits an execution graph carrying a Policy Enforcement Point at every Step boundary, and produces the diagnostics an author reads | Compiled graphs, each traceable to its source definition, version and Step identifiers | Nothing outbound; invoked by the Control Plane API | Accept customer code, or emit a graph in which an enforcement point can be suppressed — the compiler's side of [`policy-model.md`](../40-governance/policy-model.md) E2 |
| Credential Custody | Control | Envelope encryption of BYOK model credentials and Tool origin credentials, per-tenant data keys, rotation | Ciphertext and key references | An external key management service | Return plaintext into a log, trace or backup ([ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md)) |
| Metering | Control | Records the metered dimensions [ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) fixes, as records carrying the properties it requires; most occurrences arise in the Data Plane, so this container is fed rather than self-observing | Meter records | Datastore | Serve as the audit trail, or bill model tokens — model usage is reported, never billed |
| Gateway | Data | The public HTTP and event-stream boundary; authenticates the calling Principal, admits Runs, streams Agent Events | No durable state of its own | Policy evaluation at admission, Runtime | Expose a runtime, model-provider or tool-protocol type, or admit a Run before its admission decision is durable ([`policy-model.md`](../40-governance/policy-model.md) D3) |
| Runtime | Data | Executes compiled graphs on an orchestration substrate that supplies durability, checkpointing, interrupts and resume — Orchestra builds none of those. Run supervision is a separate concern and is Orchestra's ([ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md), superseding [ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md)). The container is the adapter around that substrate, not the substrate | Run state and Checkpoints, which are the runtime's rather than Orchestra's | Policy evaluation, Model Broker, Tool Invocation | Appear in any public contract, or expose a Checkpoint as an addressable object |
| Run Supervisor | Data | Run lifecycle, leasing work to workers and reclaiming a lease when one disappears, per-Tenant concurrency, scheduling and wake-up, job-level retry and drain ([ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md)), built on PostgreSQL ([ADR-0019](../adr/adr-0019-postgres-run-supervisor.md)) | Run intent, leases and scheduled wake-ups, in its own schema ([ADR-0020](../adr/adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4) | The Runtime, to invoke a compiled graph | Retry a Step Execution — that retry is not the supervisor's to own |
| Policy evaluation | Data | **Location undecided.** Produces exactly one verdict per enforcement point and writes the Policy Decision | Policy Decisions, which are Audit Records | The datastore, and whatever carries a Policy Decision across a crash ahead of the gated action — [ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md) leaves that mechanism open | Be optional at any enforcement point, or be read as a settled deployment boundary — see section 5 |
| Model Broker | Data | Resolves a Model Binding to a Deployment Surface, endpoint and credential reference; schedules within the Quota Envelope; normalises invocation and streaming; attempts declared fallbacks in order | No credential material of its own | Credential Custody, tenant-configured model deployment surfaces | Choose a model the definition did not name, or fall back outside the declared order |
| Tool Invocation | Data | Invokes a registered Tool over its origin's transport and returns the result as untrusted content | Nothing durable | MCP Servers, native adapters, and the Connector fabric if ADR-0007 binds | Invoke a Tool no enforcement point cleared, or let the transport change the Tool's identity |
| Connector fabric | Data | **Planned.** Terminates the outbound session a customer-deployed Connector establishes, and multiplexes Tool traffic over it | Connector enrolment and health state | The customer's Connector, over its own tunnel | Be assumed to exist — ADR-0007 is **Proposed** |

*Holds* means logical ownership of records, not a private database per container: every
tenant-scoped record lives in one logical datastore under
[ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md), per section 8.

## 4. The compiler is Orchestra's; the runtime is a compilation target

Customers author declarative definitions and Orchestra compiles them
([ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md)). The compiler is Orchestra's own
component with its own correctness burden — validation, diagnostics, and golden tests from
definition to expected graph. What it emits is a build output: never a customer-facing artifact, and
the orchestration runtime it targets is never named in an API, schema, SDK or customer-facing
document ([ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md)).

Two container-level consequences follow. The Runtime consumes the compiled graph rather than the
definition, so the graph must carry the pinned definition version and Step identifiers back to
source — ADR-0005 records the debugging cost of compiling, and this pays it. And substitution stays
a compiler change only while every point of contact with the substrate sits inside the Definition
Compiler and one adapter within the Runtime container. That adapter is the seam ADR-0005's own
mitigation rests on: it is the Runtime's only contact with the substrate, and a second container
that knows what the substrate is has silently repriced the substitution.

## 5. Policy enforcement is a place, not a container

A Policy Enforcement Point is a place in the execution path
([`../20-domain/domain-model.md`](../20-domain/domain-model.md) section 6), and the compiler emits
one at every Step boundary rather than a convention placing them there
([`../40-governance/policy-model.md`](../40-governance/policy-model.md) E1–E2). *Enforcement* is
therefore inside the Gateway at admission and inside the Runtime at every Step boundary and before
every Tool invocation, by construction. There is no container to draw for it, and no container that
can decide not to consult it.

What is undecided is where *evaluation* runs: as a library call inside those processes, or as a
separate container they call. `policy-model.md` registers the question and names this section of the
documentation set as its home. Three things already constrain any answer, and none settles it.

- A Run pins its Policy versions at admission for the life of the Run
  ([ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md)), so an evaluator reads the
  versions the Run pinned, never the current ones.
- A Policy Decision must be durable before the gated action is attempted, and durable does not mean
  remote ([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md)). That write sits on the
  enforcement path in either shape, so the choice is about evaluation, not durability. What performs
  it — a shared transaction with the datastore, a durable outbox, a node-local append — ADR-0013
  leaves open, and [`data-plane.md`](data-plane.md) carries what follows from each.
- Whether evaluation can be a pure function of its supplied inputs depends on whether a Policy may
  depend on aggregate state, which `policy-model.md` marks **ADR** and leaves open.

The third is why this document does not settle it: the location question is downstream of the
policy-language decision, and fixing a container shape first would constrain that language by
accident. Section 12 registers it.

This is also the one place where a governed action waits on a durable write: under the fail-closed
rule, the availability of whatever makes a Policy Decision durable bounds that of every governed
action. Whether that couples the planes *across the plane boundary* depends on the same open
mechanism — a shared transaction with the tenant-scoped datastore makes it one, a plane-local
mechanism does not. ADR-0013 states the cost and accepts it.

## 6. The Model Broker brokers; it does not route

ADR-0006 removed capability-based selection, preference routing and cost optimisation from scope.
What remains is a broker: an Agent version or a Step names a Model Binding, the broker resolves it
to a Deployment Surface, an endpoint and a credential reference, and invokes it. Fallback is a
declared ordered list, not a judgement the broker makes for the tenant.

Two properties make it a container rather than a library. Quota-aware scheduling is admission
control against each Binding's Quota Envelope: under BYOK the tenant's limit is a steady-state
capacity ceiling rather than an exceptional failure, and the delay is surfaced rather than hidden
([ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md)). Normalising invocation and
streaming keeps provider-native formats out of every contract above it.

The retry rule is the sharp edge. A failed model call is safe to retry; a call that may already
have produced a side effect is not. The broker is on the safe side by construction, which is why the
line is drawn at Tool Invocation and not here.

## 7. Tool Invocation, and the Connector fabric as planned work

Tool Invocation is required whatever becomes of ADR-0007: a Tool reaches Orchestra through an MCP
Server or a native adapter, exactly one origin per Tool
([`../20-domain/domain-model.md`](../20-domain/domain-model.md) section 5). Registration in the Tool
Catalog grants nothing, and this container invokes only what an enforcement point cleared
([`../40-governance/tool-authorization.md`](../40-governance/tool-authorization.md)).

The **Connector fabric is planned, not settled.** ADR-0007 is **Proposed** and binds only after
design-partner validation. Its architectural claim is that reachability is a transport concern:
direct HTTPS or multiplexed tunnel, the Tool is the same Tool and everything above is unchanged. If
ADR-0007 is rejected the fabric disappears, Tool Invocation talks only to publicly reachable
origins, and nothing else in section 2 moves — which is the argument for drawing the seam now.

The customer-deployed Connector is not Orchestra's container. It runs inside the customer's network,
cannot be force-upgraded, and is `connector.md`'s subject, planned in [`./README.md`](README.md).

## 8. Stores

There is one logical tenant-scoped datastore. Isolation is by shared schema with row-level security
enforced by the engine rather than by application code, and CI failing a tenant-scoped table that
lacks a forced policy is the load-bearing control
([ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md));
[`multi-tenancy.md`](multi-tenancy.md) specifies the mechanism.

**The datastore engine is PostgreSQL**
([ADR-0021](../adr/adr-0021-postgresql-is-the-datastore.md)), chosen against the capabilities
[`multi-tenancy.md`](multi-tenancy.md) sets out. The two places the engine matters most — what
satisfies ADR-0013's durable decision write, and the query shape audit reconstruction needs under
ADR-0012 — are still open, but now against a known engine rather than a candidate.

Any store outside that datastore must be tenant-scoped explicitly;
[`../40-governance/threat-model.md`](../40-governance/threat-model.md) T4 enumerates the classes,
states the requirement and records that no inventory of them exists. The enumeration stays there
rather than here, so that two copies of it cannot drift apart.
[`multi-tenancy.md`](multi-tenancy.md) assigns that inventory to whichever document introduces each
store, so **two of them are this view's contribution and the list stays open.** Credential Custody
holds key material in an external key management service, which holds no tenant records. The
Runtime's checkpoint storage does hold tenant-scoped Run state while Orchestra models nothing of it
(domain model I6) — the exact case T4 covers and row-level security does not reach.

Two further candidates are conditional, and neither is counted above. Whether the durable Policy
Decision write introduces a store at all depends on the mechanism ADR-0013 leaves open, which
[`data-plane.md`](data-plane.md) holds. Whether the Run event stream is backed by one depends on the
replay design section 12 registers, which rests on **Proposed** ADR-0004.

**The tenant directory is an ordering problem.** Whichever container authenticates a caller resolves
it to a Tenant before any tenant context exists, so a directory record identifies a Tenant rather
than belonging to one and cannot be filtered by the requester's context. That much follows from
ADR-0011. It lives in Tenant User Management's own schema, and the Gateway and the Control Plane API
call that service rather than reading the table
([ADR-0024](../adr/adr-0024-global-person-with-tenant-memberships.md)).

## 9. The language boundary

ADR-0005 records that the Runtime is Python while the control plane and protocol tooling are
TypeScript, and that the boundary between them is a **versioned internal contract that must be
documented as one.** It has not been. Read ADR-0005's *control plane* there as the TypeScript
implementation stack rather than the glossary's Control Plane: this is a language boundary, and it
does not have to follow the plane split — the Definition Compiler is a Control Plane container
whichever language it is written in.

That is a gap rather than a formality. [`../VERSIONING.md`](../VERSIONING.md) enumerates nine
versioned artifacts and this contract is not among them, so it has no compatibility rule, no
deprecation path and no owner. Two questions answer together and section 12 registers both: which
side the Definition Compiler sits on — TypeScript, emitting a runtime-neutral artifact, or Python,
next to the Runtime — and what crosses the boundary.

## 10. What is deliberately not a container

- **A checkpoint store.** Checkpointing is a library mechanism inside the Runtime container,
  persisting to Orchestra's own datastore
  ([ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md)), not a store of its own. A
  Checkpoint is not addressable, not versioned by Orchestra, and not in any public contract (domain
  model I6).
- **A model router.** Removed from scope by ADR-0006.
- **A workflow engine.** The runtime library is the execution substrate
  ([ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md)). What Orchestra adds over it is
  a compiler and a run supervisor ([ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md)), not
  an engine of its own.
- **A per-tenant deployment.** ADR-0011 chose shared schema. The promotion path for a single Tenant
  is designed for and not built, and it is a topology question rather than a container.
- **A bespoke Admin Console.** Front-end surfaces duplicate the template in
  [`../../ui-template/README.md`](../../ui-template/README.md), a starting point, not a product.

## 11. Where this shape is weak

- **The audit path is a hard dependency of execution.** ADR-0013's fail-closed rule is deliberate
  and correct, and it means an outage of whatever makes a Policy Decision durable stops governed
  work across the whole Data Plane. How wide that reaches depends on the mechanism ADR-0013 leaves
  open: a shared transaction with the datastore puts a shared store on every enforcement path.
- **The Definition Compiler is a single point of correctness.** A compiler defect produces subtly
  wrong execution that policy then faithfully permits, because the emitted graph is what policy is
  enforced over. ADR-0005 mitigates with golden tests and retained snapshots — a practice, not a
  structure.
- **Tenant isolation rests on one control at one layer.** Row-level security covers the datastore
  and nothing else, so every container keeping state outside it reopens what ADR-0011 closed.
- **A container-shaped hole sits in the Data Plane.** The Connector fabric rests on a Proposed ADR;
  if it binds, its failure modes — offline, tunnel drop mid-call, version skew — enter a reliability
  model that does not yet exist.
- **None of this has been built.** Every boundary is a claim about a system that does not run.

## 12. Open questions

**ADR** means the choice is costly to reverse or spans components and must be recorded as an ADR
before implementation. **Document** means a later document suffices.

| Question | Needs | Decided by |
| --- | --- | --- |
| The shape and scope of the egress allow-list | **ADR** | One ADR spanning the Model Broker, Tool Invocation and the Connector, per [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T6. The posture is not open: T6 derives default-deny egress from its own analysis and binds it normatively, so this document treats it as settled and registers only the allow-list's shape — per tenant or platform-wide, by hostname or by address range, in the application or at an egress identity. Those three containers are the only outbound edges reaching a tenant-supplied destination, which is what this document contributes; `connector.md` cannot settle the shape alone while ADR-0007 is **Proposed** |
| Where policy evaluation executes — in-process at each enforcement point, or a separate container | **ADR** if evaluation needs its own datastore access, otherwise Document | Blocked on the policy-language ADR and on whether a Policy may depend on aggregate state, both marked **ADR** in [`../40-governance/policy-model.md`](../40-governance/policy-model.md). Section 5 fixes that enforcement is in-process by construction and derives the constraints any answer must satisfy; the location is not settled here |
| Which side of the language boundary the Definition Compiler sits on, and what artifact crosses it | **ADR** | [`data-plane.md`](data-plane.md) section 11, which carries the analysis of both candidates, with ADR-0005 behind it. This view names the container; it does not decide the side. It fixes where every point of contact with the substrate lives, which is the substitution argument the boundary exists to protect |
| How the control-plane-to-runtime internal contract is versioned and deprecated | Document | [`../VERSIONING.md`](../VERSIONING.md), which enumerates nine artifacts and does not include this one, though ADR-0005 requires it be documented as a versioned contract |
| Whether the Connector fabric is a container at all | **ADR** | ADR-0007's validation steps. Until it binds, section 7 is planned work and the dotted edges in section 2 are provisional |
| Which container writes the Audit Records that are not Policy Decisions, and where the write path ADR-0013 permits to degrade lives | Document | [`../40-governance/audit-model.md`](../40-governance/audit-model.md) fixes the record classes and requires that a degraded period be visible; `reliability.md` in [`../60-operations/`](../60-operations/) owns how it is signalled. Section 3 names a container for the fail-closed path only and section 2 draws no edge for the rest, so the container is this view's to name once both land |
| Which containers are separately deployable, and which share a process or a release | Document | `deployment-topologies.md`, planned in [`./README.md`](README.md). Nothing here is a service count |
| The complete inventory of stores outside the row-level-secured datastore | Document | Accumulates as each document introduces a store; section 8 contributes the two this view introduces, and [`multi-tenancy.md`](multi-tenancy.md) owns the scoping rule the inventory is checked against. Whether ADR-0013's durable decision write adds one at all depends on a mechanism [`data-plane.md`](data-plane.md) holds open |
| Whether the Gateway or the Control Plane API mints and validates Session Tokens, and what identity a Service Account presents | Document | [`identity-and-access.md`](identity-and-access.md) |
| What the Gateway emits on the Run event stream, and how replay reaches a disconnected client | Document | [`../30-protocol/`](../30-protocol/); rests on ADR-0004, **Proposed**, whose validation step 2 is outstanding |
| Whether the Model Broker's Quota Envelopes are declared, discovered from the surface, or both | Document | The quota design ADR-0006 calls for, with [`../60-operations/`](../60-operations/) |

Two of these gate other work. The allow-list's shape gates two container boundaries and the
connector, and evaluation location sits underneath the governance section's implementability. The
engine decision that used to lead this list, and gated every T4 control, is now
[ADR-0021](../adr/adr-0021-postgresql-is-the-datastore.md).
