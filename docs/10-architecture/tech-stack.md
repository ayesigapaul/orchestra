---
title: Technology Stack
doc_id: DOC-016
version: 0.21.0
status: Draft
last_updated: 2026-09-12
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0002, ADR-0006, ADR-0011, ADR-0014, ADR-0016]
---

# Technology Stack

What to build on, why, and what would change it. **A recommendation here is not a decision.** Where
a choice is costly to reverse or spans components, the row says an ADR is required and the choice
does not bind until one exists ([`../adr/README.md`](../adr/README.md)).

Each entry states the alternative that was seriously considered, because a recommendation with no
rejected alternative has not been thought about.

## 1. What is already decided

These are not open. They constrain everything below.

| Constraint | Record |
| --- | --- |
| Runtime is Python; the control plane and protocol tooling are TypeScript | [ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md), carried from ADR-0005 |
| Definitions compile onto the **MIT LangGraph library**; its Elastic-2.0 server tier is out of bounds | [ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md) |
| Orchestra builds the run supervisor — lifecycle, leasing, concurrency, scheduling, job retry, drain | [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) |
| The datastore must enforce row-level security itself; isolation is never application-code-only | [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) |
| The model layer is a credential and endpoint broker under BYOK, never a router | [ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md), [ADR-0002](../adr/adr-0002-enterprise-segment-and-byok.md) |
| Front-end surfaces duplicate the Next.js template rather than sharing code | [`../../ui-template/README.md`](../../ui-template/README.md) |
| Identity is Keycloak, self-hosted, with a Keycloak Organization per Tenant | [ADR-0017](../adr/adr-0017-keycloak-for-identity.md) |
| Apache APISIX is the edge in front of the Gateway, and is never the authorization boundary | [ADR-0018](../adr/adr-0018-apisix-at-the-edge.md) |
| The run supervisor is built on PostgreSQL, with Temporal as the named fallback | [ADR-0019](../adr/adr-0019-postgres-run-supervisor.md) |

### 1.1 Versions — latest stable, pinned exactly

**Every technology runs its latest stable release, pinned to an exact version.** Not a floor like
"3.12+", and not a floating range: a floor lets two environments disagree silently, and a range lets
a dependency update change behaviour nobody reviewed. Upgrades are deliberate commits.

Where a project publishes a long-term-support line, **latest stable means latest LTS** — the
projects themselves mark non-LTS "current" lines as not for production. Node.js is the one affected
today. Pre-releases, betas and release candidates are never used.

Versions below were read from the registries — endoflife.date, PyPI, npm and GitHub releases — on
2026-09-12, not from memory. Re-check them the same way before relying on this table; it is a
snapshot, and it goes stale on the next release.

| Technology | Pinned | Channel note |
| --- | --- | --- |
| Python | 3.14.7 | 3.15 is at release candidate; not used until it is final |
| PostgreSQL | 18.6 | 19 is in beta; not used until it is final |
| Node.js | 24.21.0 | Active LTS. 26.8.2 is newer but not LTS until 2026-10-28, when it becomes the pin |
| TypeScript | 7.0.2 | The first stable release on the native compiler |
| pnpm | 12.4.1 | |
| Next.js | 16.3.5 | `ui-template/` is on 16.3.4 and must be bumped |
| React | 19.3.0 | `ui-template/` is on 19.2.4 and must be bumped |
| Tailwind CSS | 4.3.3 | |
| FastAPI | 0.141.1 | |
| uvicorn | 0.52.4 | |
| Pydantic | 2.13.5 | |
| uv | 0.12.13 | |
| ruff | 0.16.7 | |
| pytest | 9.1.1 | |
| LangGraph | `langgraph` 1.2.11, `langgraph-checkpoint` 4.2.0, `langgraph-checkpoint-postgres` 3.1.2 | MIT packages only ([ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md)) |
| psycopg | 3.3.5 | |
| Keycloak | 26.7.3 | [ADR-0017](../adr/adr-0017-keycloak-for-identity.md) recorded 26.7.0, current on its date |
| Apache APISIX | 3.18.0 | |
| PgBouncer | 1.25.2 | |
| OpenTelemetry | Python SDK 1.44.0, Node SDK 0.222.0, Collector 0.160.0 | |
| Terraform | 1.16.2 | |
| Testcontainers (Python) | 4.15.0 | |
| Anthropic SDK | Python 1.5.0, TypeScript 0.125.0 | At the broker's edge only |

## 2. Data plane — Python

**Language and tooling: Python 3.14, with [uv](https://docs.astral.sh/uv/) for packaging, ruff for
lint and format, and pytest.** uv consolidates pip, pip-tools, virtualenv and version management into
one Rust binary with a cross-platform `uv.lock`, and is stable and widely used in production. The
alternative is Poetry, whose lockfile is platform-agnostic where uv's is resolved across markers; for
a service deployed to one target that difference does not pay for the slower toolchain.

**HTTP and streaming: [FastAPI](https://fastapi.tiangolo.com/).** The Gateway is the Data Plane's only
ingress and terminates the Run event stream over SSE
([`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md),
[`../30-protocol/event-protocol.md`](../30-protocol/event-protocol.md)).
[Litestar](https://litestar.dev/) benchmarks faster on serialization, and that is the wrong axis here:
the latency this platform owns is dominated by two durable writes per Step — the fail-closed Policy
Decision ([ADR-0013](../adr/adr-0013-fail-closed-policy-decision-writes.md)) and the checkpoint — not
by framework overhead. Ecosystem breadth and the number of engineers who already know it win.

**Compilation target: the MIT LangGraph packages only** — `langgraph`, `langgraph-checkpoint` and
`langgraph-checkpoint-postgres`. Nothing may depend on `langgraph-api` or `langgraph-runtime-inmem`
(Elastic-2.0). ADR-0014 requires a licence assertion over the dependency tree in CI, not review.

## 3. Datastore — PostgreSQL

**PostgreSQL, with `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` on every tenant-scoped
table.** ADR-0011 fixes the model and selects no engine; Postgres is the recommendation because RLS
is a first-class server feature there and the same instance can carry the LangGraph checkpointer,
the supervisor's queue and the audit store. **This needs an ADR** — the engine is load-bearing for
isolation, the supervisor and the checkpointer at once.

**The pooling rule is not optional.** Under a transaction-mode pooler such as PgBouncer, a server
connection returns to the pool at COMMIT carrying whatever session state was left on it, so a tenant
set with `SET` leaks into the next request that borrows that connection. Tenant context MUST be set
with `SET LOCAL` inside an explicit transaction, which expires exactly when the connection is
returned. [`../70-delivery/testing-strategy.md`](../70-delivery/testing-strategy.md) already names
this as a guarantee that fails silently, and it is why the isolation test runs through the pooler
rather than a direct connection.

**Testing it: real Postgres, two tenants, in CI.** Testcontainers for an ephemeral instance, and
[pgTAP](https://pgtap.org/) or an equivalent for policy-level assertions. A single-tenant test passes
under broken isolation, so the test is two tenants or it is not a test.

## 4. The run supervisor

**Start on PostgreSQL: `SELECT ... FOR UPDATE SKIP LOCKED` for the queue, a lease column with an
expiry for worker liveness, and a scheduled wake-up table.** Workers pull without a broker, and the
enqueue commits in the same transaction as the state change it follows, which is what makes
exactly-once handoff possible at all.

**The alternative is [Temporal](https://temporal.io/).** It is materially better at three things:
patching in-flight executions, visibility queries across many runs, and throughput under high
concurrency, where Postgres lock contention and autovacuum pressure on a hot history table become
real. It costs several services plus a persistence store and a visibility store to operate.

**Decided:** [ADR-0019](../adr/adr-0019-postgres-run-supervisor.md) builds on PostgreSQL and keeps
Temporal as the named fallback, with the triggers written down in advance — contention that bounds
throughput, visibility queries the history tables cannot serve, a need to patch executions in
flight, or scheduling that outgrows a wake-up table. The transactional enqueue is the reason, not
just the lower cost: the record of what happened and the work that follows commit together.

**M2 still has to size it.** ADR-0019 fixes the substrate, not the effort, and
[`../70-delivery/milestones.md`](../70-delivery/milestones.md) M2 remains the gate before an MVP is
committed to. The fallback stays affordable only if the supervisor's interface stays narrow, which
ADR-0019 makes a requirement rather than an aspiration.

## 5. Control plane — TypeScript

**Next.js 16 with React 19, Tailwind 4 and shadcn, duplicated per surface**, which the template
already fixes. Its route handlers are the control plane's own API: the administrative surface is
co-located with the UI that uses it, and whether the administrative API is the same contract as the
Gateway is registered open in
[`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) section 6.

**Not NestJS, and not a separate Hono service, yet.** NestJS's structure is a tax below a certain team
size, and a second service earns its keep only when the admin API outgrows the UI it serves. If it
does, Hono is the light option that runs on the same runtimes.

## 6. Identity and credentials

**[Keycloak](https://www.keycloak.org/), self-hosted, on the current release line** — 26.7.0 at the
time of writing (26.7.3 is the pinned version), which adds a native SCIM API in preview. Each Tenant
maps to a Keycloak **Organization** within one realm, rather than a realm per customer, which keeps
administration proportionate to the product instead of to the customer list.
[ADR-0017](../adr/adr-0017-keycloak-for-identity.md) records the decision, what it costs — Orchestra
now operates a security-critical stateful service, and SCIM is still preview — and the alternative
it rejected, a managed broker priced per connection.

**Keycloak is identity, and only identity.** It is not the authorization model: Policy is evaluated
at the enforcement points [`../40-governance/policy-model.md`](../40-governance/policy-model.md) E1
fixes, and a Keycloak role is at most an input to one. It does not hold BYOK model credentials
either — that is key management, below.

**BYOK credential custody: envelope encryption with a per-Tenant data key wrapped by a KMS key, and
the Tenant bound into the encryption context.** The encryption context costs nothing, becomes an IAM
condition and an audit dimension, and omitting it is the common avoidable mistake. Cache unwrapped
data keys with a bounded lifetime — per-tenant encryption otherwise generates KMS call volume
proportional to traffic. ADR-0002 rates credential compromise **existential** and requires provably
no plaintext in logs, traces or backups.

## 7. Observability — and what it is not

**OpenTelemetry**, which [graduated in the CNCF in May 2026](https://opentelemetry.io/) and whose
traces and metrics APIs are stable across the SDKs; logs are less uniform and should be treated as the
least settled leg. Export OTLP and keep the backend replaceable.

**Telemetry is not the audit trail, and the distinction is normative.**
[`../40-governance/audit-model.md`](../40-governance/audit-model.md) A6 forbids reconstructing an
Audit Record from logs, traces or metrics, and forbids presenting them as the trail. Sampling, the
technique that makes telemetry affordable, is precisely what a control cannot tolerate.

## 8. Model access

Customers bring their own keys, so the broker holds credentials and endpoints for whichever providers
a Tenant uses; it does not choose between them ([ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md)).
Use each provider's official SDK at the edge, behind the broker, so no provider type reaches a public
contract (CLAUDE.md working rule 2). For Anthropic that is the `anthropic` Python SDK; current models
are `claude-opus-5`, `claude-sonnet-5` and `claude-haiku-4-5`.

## 9. Deployment

**Containers on ECS Fargate, with Terraform.** For a small team below roughly fifteen services, ECS
is operable by generalists, has no per-cluster control-plane charge, and reaches production faster
than EKS. **Kubernetes is the deliberate alternative** and the right one once a platform team exists
or the service count grows; the migration is measured in weeks per environment, which is a real but
bounded cost — worth paying later rather than paying for a platform team now.

This is the least settled section here. [`deployment-topologies.md`](deployment-topologies.md)
registers data residency as ADR-required, and a residency answer can force the cloud and the region
layout before any of this is chosen.

## 10. The edge

**[Apache APISIX](https://apisix.apache.org/), self-hosted in front of the Gateway** — 3.18.0 at the
time of writing. It terminates TLS, routes, rate-limits per Tenant, and verifies tokens against
Keycloak with its `openid-connect` plugin, so perimeter authentication is configuration rather than
application code. [ADR-0018](../adr/adr-0018-apisix-at-the-edge.md) records it.

**Two things it must never do**, both following from records that already bind. It is not the
authorization boundary — an edge plugin that allowed or denied a business action would be an
unaudited Policy Decision ([ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md)). And it
does not set the Tenant, which G7 forbids any caller-settable input from doing.

**Buffering is the footgun.** Proxies buffer by default, and a buffered Server-Sent Events stream
arrives in bursts or not at all, which makes the ordering and gap-detection guarantees of
[`../30-protocol/event-protocol.md`](../30-protocol/event-protocol.md) unobservable. Buffering is
disabled explicitly on the event-stream route, and that belongs in a test rather than a runbook,
because it fails silently and looks like latency.

## 11. Open questions

| Question | Decided by | ADR required? |
| --- | --- | --- |
| The datastore engine, which section 3 recommends and no record selects | An architecture decision constrained by [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) to an engine that enforces row-level security | **Yes** |
| How large the PostgreSQL supervisor is to build, now that the substrate is fixed | The M2 sizing in [`../70-delivery/milestones.md`](../70-delivery/milestones.md), which [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md) requires before an MVP | No — the substrate is decided by [ADR-0019](../adr/adr-0019-postgres-run-supervisor.md) |
| The lease duration, renewal interval and wake-up poll interval | [ADR-0019](../adr/adr-0019-postgres-run-supervisor.md)'s follow-on; no interval is decided anywhere | No |
| Which side of the Python-to-TypeScript boundary the compiler sits on, and what artifact crosses | [`data-plane.md`](data-plane.md), assigned by [`containers.md`](containers.md) section 12 | **Yes** — repeated |
| How a Keycloak identity resolves to a Principal, and what an Organization maps to when a Tenant has several Workspaces | [ADR-0017](../adr/adr-0017-keycloak-for-identity.md)'s follow-on, with [`identity-and-access.md`](identity-and-access.md) | No |
| How APISIX configuration is declared and versioned, so routes are reviewable | [ADR-0018](../adr/adr-0018-apisix-at-the-edge.md)'s follow-on | No |
| The cloud and the deployment target, which data residency may decide first | [`deployment-topologies.md`](deployment-topologies.md) | **Yes** — repeated |
| Whether the administrative API is the Gateway contract or its own | [`../30-protocol/gateway-api.md`](../30-protocol/gateway-api.md) section 6 | No — repeated |
