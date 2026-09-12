---
title: "ADR-0020: One repository, independent services — boundaries enforced as if the services were separate repositories"
adr_id: ADR-0020
status: Accepted
date: 2026-09-12
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, repository, operations]
depends_on: [ADR-0011, ADR-0016, ADR-0019]
---

# ADR-0020: One repository, independent services — boundaries enforced as if the services were separate repositories

## Status

Accepted.

## Context

Implementation starts in one repository, and the platform is expected to run as separately deployed
services later. Both are decided. What needs recording is how to keep the first from making the
second expensive.

A monorepo does not couple services by itself. Four specific conveniences do, and each is the
default in modern tooling:

- **A workspace** — a uv or pnpm workspace resolves every member against one lockfile, so one
  service's upgrade forces every other service's dependency graph to move with it.
- **Path dependencies** — a service that installs another directory by path deploys that directory's
  code inside itself, and can no longer be built or released alone.
- **Importing across services** — the fastest way to reuse a function, and the one that turns a
  network boundary into a function call nobody can later put back.
- **Reading another service's tables** — a join across ownership is a contract no document records,
  which breaks silently the day either side changes its schema.

[`../10-architecture/containers.md`](../10-architecture/containers.md) already defines the
containers, and [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) fixes one logical
datastore. The service boundaries should follow the first without contradicting the second.

## Decision drivers

- Extracting a service later should be a move, not a refactor.
- A boundary that exists only by convention erodes at the first deadline, so every rule that can be
  checked by a machine is checked by one.
- Pre-customer, the cost of the discipline must stay proportionate: no polyrepo overhead before
  there is anything to deploy separately.

## Considered options

1. **A monorepo with workspaces and a shared library.** Fastest now. Every coupling above is the
   default, and extraction later is a refactor of everything the shared library touched.
2. **Separate repositories from the start.** The strongest isolation, and a tax on every
   cross-cutting change — versioned releases between repositories before any service is deployed
   anywhere.
3. **One repository, with each service structured as if it were its own repository, and CI enforcing
   it.** The isolation of option 2 for the price of a check.

## Decision

**Option 3.** Services share a repository, never code.

| Rule | Requirement |
| --- | --- |
| **B1 — Self-contained** | Each service lives in its own directory under `services/`, and each front end under `apps/`. It has its own manifest, lockfile, Dockerfile and tests, and builds with its own directory as the build context. |
| **B2 — No dependency leaves the directory** | No workspace spans services. No path, `file:`, `link:` or `workspace:` dependency points outside the service. No service imports another service's code. |
| **B3 — Contracts, not code** | Services talk over the network, through the versioned contracts in [`../30-protocol/`](../30-protocol/). A service that needs a contract's types generates them inside itself from the JSON Schemas; it never imports them from another service. |
| **B4 — Data ownership** | One logical datastore, per ADR-0011. Each service owns its tables in its own PostgreSQL schema, reached through its own database role granted that schema alone. No service reads or writes another service's tables; it calls the owner. |
| **B5 — No shared runtime library, yet** | Small cross-cutting code — token verification, tenant context, telemetry setup — is duplicated per service. A shared package is extracted only when duplication has demonstrably caused a defect, and is then consumed by pinned version from a registry, never by path. |
| **B6 — The local topology is the production topology** | Locally, each service runs in its own container on a network, so a call that would cross the network in production crosses it on a laptop too. |

**Enforcement.** `scripts/check-service-boundaries.mjs` runs in CI and fails on B1 and B2 — a missing
lockfile, a workspace, a path dependency, a cross-service import or a build context that reaches
outside the service. It also fails on the Elastic-2.0 LangGraph server packages that
[ADR-0016](adr-0016-compile-to-the-langgraph-library.md) excludes, which is the licence assertion
[ADR-0014](adr-0014-run-supervisor-is-orchestras.md) asked for. B4 is enforced when the datastore
arrives, by per-service roles and a migration check. B3 and B5 rest on B2 — without a path
dependency or an import there is no route to shared code.

**What is not scaffolded.** A service is created when its phase begins and its placement is decided.
The Definition Compiler's language and where Policy evaluation runs are both unmade
([`../10-architecture/containers.md`](../10-architecture/containers.md) section 12), so neither exists
as a directory yet.

## Rationale

Option 1 buys speed with exactly the couplings the future deployment cannot afford. Option 2 pays,
before any service is deployed, the release overhead that only matters once several are. Option 3
makes the services independent in every way that matters for extraction and costs one CI check plus
the discipline of B5.

B4 is the rule most likely to be resisted and the one that matters most. A shared schema is the
coupling that survives every other rule: two services that never import each other's code but join
each other's tables are one service with two deploy pipelines. Owning a schema per service inside
one database keeps ADR-0011's single datastore and its row-level security, and turns extraction into
moving a schema.

## Consequences

### Positive

- Extracting a service is a matter of moving a directory, a schema and a deployment, not untangling
  imports.
- Each service can be versioned, released and scaled independently from the first commit.
- The rules are checked by a machine, so they survive a deadline.

### Negative

- **Duplication.** Token verification, tenant context and telemetry setup exist once per service
  until B5's threshold is met, and a fix must be applied in each copy.
- **No cross-service joins.** Reporting that spans services goes through APIs or events, which is
  more work than a query.
- **Transactions stop at a service's edge.** ADR-0019's transactional enqueue holds inside the
  supervisor's own schema. A guarantee that spans services — [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md)'s
  Policy Decision durable before the gated action, if the two sit in different services — is met by
  a synchronous call that returns only after the owner's durable write, or by an outbox, and never by
  a shared transaction.
- CI installs and tests each service separately, which is slower than one shared install.

### Neutral / follow-on work

- Write the per-service role and migration check when the datastore arrives in Phase 1.
- Generate contract types from the JSON Schemas inside each service when the first contract is
  implemented.
- The language-boundary contract [`../10-architecture/containers.md`](../10-architecture/containers.md)
  section 9 says is undocumented becomes a network contract under B3, which is the answer to its
  "what crosses the boundary" half.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A deadline produces a cross-service import "just for now" | High | High | CI fails on it; there is no exemption mechanism by design |
| Duplicated cross-cutting code drifts into a security defect | Medium | High | B5's extraction trigger; a verification path gets the same tests in every service |
| A boundary is drawn in the wrong place and two services always change together | Medium | Medium | Merge them — a merge is cheaper than coupling two services that should be one |
| Cross-service reporting pressure produces a shared-table read | Medium | High | B4 is enforced by database grants, not by review, once the datastore arrives |

## Revisit criteria

Reopen if two services consistently change together, which means the boundary is wrong; if
duplicated cross-cutting code causes the same defect twice, which is B5's extraction trigger; or if
separate deployment stops being the direction, in which case this discipline costs more than it
buys.

## References

- [`../10-architecture/containers.md`](../10-architecture/containers.md) — the containers these
  services follow
- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) — the one logical datastore B4 keeps
- [ADR-0016](adr-0016-compile-to-the-langgraph-library.md) — the licence exclusion the boundary check
  also asserts
