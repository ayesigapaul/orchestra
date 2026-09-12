---
title: Documentation Changelog
doc_id: DOC-003
version: 0.20.0
status: Draft
last_updated: 2026-09-12
owners: [platform-architecture]
---

# Changelog

All notable changes to the Orchestra documentation set.
Format: [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html), per [VERSIONING.md](VERSIONING.md).

## [Unreleased]

### Planned

- `60-operations/runbooks/` — operational procedures, once there is something to operate

---

## [0.20.0] — 2026-09-12

The run supervisor's substrate decided, which was half of the question gating an MVP.

### Added

- [ADR-0019](adr/adr-0019-postgres-run-supervisor.md) — the run supervisor is built on PostgreSQL,
  with Temporal as the named fallback and its triggers recorded in advance. The reason is
  correctness before cost: with the queue in the same database as the state, the record of what
  happened and the work that follows from it commit in one transaction, where any separate
  orchestrator would make that a two-system write. Temporal is better at patching executions in
  flight, at visibility queries across many Runs, and at throughput under concurrency — none of
  which this platform has measured, and buying it now would put a vendor on the execution path of
  every Run, on top of the two stateful services adopted the same week.
- What keeps the fallback affordable is stated as a requirement rather than an aspiration: nothing
  above the supervisor may depend on the queue being a table.

### Changed

- `10-architecture/tech-stack.md` section 4 and `70-delivery/milestones.md` M2 — the substrate is no
  longer an open question. **M2 still stands**: ADR-0019 fixes what it is built on, not how large it
  is, and that estimate is still the gate before an MVP is committed to.

---

## [0.19.2] — 2026-09-12

The published site fixed for real, after two attempts that passed locally and failed in production.

### Fixed

- Section indexes are generated as `section-index.md`, with explicit redirects from the directory URL
  and both README URLs. The two earlier attempts both worked under `mint dev` and 404ed on the
  deployed site: a symlink, which the local server follows and the cloud build does not, and a file
  named `index.md`, which the cloud build would not serve in a directory that also holds a README.
  The name now collides with nothing, and the redirects no longer depend on Mintlify's own directory
  behaviour, which was fighting ours and producing a redirect loop on the home page.

---

## [0.19.1] — 2026-09-12

A correction to the fix in 0.19.0, which worked locally and not in production.

### Fixed

- The section index aliases were **symlinks** to each `README.md`. Mintlify's local dev server
  follows them and its cloud build does not, so the deployed site still returned 404 on the home page
  and every section index while the local preview was green. They are now **generated copies**,
  written and verified byte-for-byte by `scripts/build-docs-nav.mjs`, which is the same
  build-artifact pattern the diagram pages already use. The README stays the file people edit.
- The lesson is recorded in `CLAUDE.md`: verify docs-site behaviour against the deployed site rather
  than the dev server, because the two do not agree.

---

## [0.19.0] — 2026-09-12

Two technology decisions recorded, and the published site fixed.

### Added

- [ADR-0017](adr/adr-0017-keycloak-for-identity.md) — Keycloak, self-hosted, is the identity
  provider, with a Keycloak Organization per Tenant. It takes the opposite path to what
  `tech-stack.md` recommended, and says why: per-connection pricing scales with the thing the
  business wants more of, and some contracts forbid a third party in the authentication path. The
  cost is stated plainly — Orchestra now operates a security-critical stateful service, SCIM is
  preview in 26.7.0, and multi-cluster HA is experimental. Keycloak is identity only: it is not the
  authorization model, and it does not hold BYOK model credentials.
- [ADR-0018](adr/adr-0018-apisix-at-the-edge.md) — Apache APISIX is the edge in front of the
  Gateway, verifying tokens against Keycloak. **Gateway** keeps its glossary meaning and the
  component stays Orchestra's; the record fixes the split between them, and three prohibitions: the
  edge is not the authorization boundary, it does not set the Tenant, and buffering is disabled on
  the event-stream route.

### Fixed

- **The published site returned 404 on its home page and on every section index.** Mintlify will not
  serve a page named README — it redirects a directory to the README and then cannot serve it. Each
  directory now carries an `index.md` symlink to its `README.md`, generated and verified by
  `scripts/build-docs-nav.mjs`, and the README URLs redirect to the section root. The README stays
  canonical and nothing is duplicated. Verified against a running server: the home page, all 14
  section indexes and the `.md` links now resolve.

---

## [0.18.0] — 2026-09-12

A technology stack to build on, and the documentation set published rather than only readable in the
repository.

### Added

- `10-architecture/tech-stack.md` — what to build on and why, layer by layer, each entry naming the
  alternative that was seriously considered. It separates what six ADRs already fix from what is
  still a recommendation, and every recommendation that is costly to reverse says an ADR is required
  and does not bind until one exists. The datastore engine and the run supervisor's substrate are
  the two that gate implementation.
- `docs.json` and `scripts/build-docs-nav.mjs` — the Mintlify site configuration, generated from the
  documentation tree so that adding a document updates the published navigation. CI fails when the
  two disagree.
- `.mcp.json` — the Mintlify admin MCP server, so the docs site can be edited through the same
  tooling as the code. It needs an interactive OAuth login before first use.

### Notes

Two things were verified against a running Mintlify server rather than assumed.

- **Our internal links would have broken the site.** Mintlify serves pages without the `.md`
  extension, and its own checker found 550 broken links across 53 files. Rewriting the 2081 links in
  the source was the wrong fix, because `../section/page.md` is exactly what GitHub renders and what
  `validate-docs.mjs` verifies. One generated redirect per page resolves it: a `.md` URL now answers
  307 and lands on the page.
- **Mermaid renders from plain `.md`.** Mintlify converts the fences into its own diagram component,
  so the 52 diagrams publish as diagrams and the documents stay portable.

---

## [0.17.0] — 2026-09-12

The last planned section was written, which meets milestone M1: every planned document is written,
or held with its reason stated in the section README.

### Added

- `50-workflows/examples/` — three processes walked through as governed Runs, each with its
  definition, a diagram, a trace of every enforcement point and the records it writes, and the
  questions it runs into.
- `invoice-payment.md` — the product thesis's prompt-injection case. A gate raised by Policy rather
  than placed by the author, and an injection defeated by the Evidence Set rather than the prompt.
  The candidate answer to what a demonstrable governed action looks like to a buyer.
- `purchase-approval.md` — `purchase-approval@3` from `workflow-dsl.md`, executed. A gate the author
  places and Policy cannot remove, and compensation as a second governed action.
- `shipment-exception.md` — concurrency that removes no enforcement point, a `wait` with no acting
  Principal, and a customer notification that cannot be unsent.
- `assets/diagrams/` — every inline diagram rendered to a browsable HTML page, one per document plus
  an index, so the diagrams can be read without a Mermaid-aware editor. The pages are generated by
  `scripts/build-diagrams.mjs` from the Mermaid in the Markdown, which stays the only source, and CI
  fails when a page no longer matches it. They render with Mermaid 11.4.1 from a pinned CDN build —
  the version CI parses with — and show the diagram source when offline.

### Changed

- `README.md` section 3 — the diagram convention now covers the generated HTML pages. A hand-made
  SVG remains the exception, for what Mermaid cannot express.

### Notes

Walking real processes through the rules surfaced questions nothing had registered. Two matter
before implementation starts:

- **An approved payment can re-raise its own gate.** A `tool` Step is evaluated at its boundary and
  again before the invocation. If those stay two evaluations, the second sees the same action, the
  Policy that raised the gate still matches, and it returns `require_approval` again — unless the
  approval resolution is one of its inputs. Whether the two collapse was registered; this
  consequence of leaving it open was not.
- **An `approval` Step's request names the gate itself as its proposed action** — class `read`, no
  Tool, no arguments — so the human approves a Step that does nothing, while the purchase order they
  have in mind is the next Step. What it should name, and whether approving it covers that Step, is
  unspecified.

---

## [0.16.1] — 2026-09-11

The boundary sweep ADR-0014 asked for and never fully received. Six documents still described the
runtime as supplying resumption outright, or Orchestra's build as "a schema and a compiler". Both
claims were corrected at the ADR level — ADR-0014 on 2026-09-11 and ADR-0016 in the release below —
and this release brings the prose into line with them.

### Fixed

- `50-workflows/README.md` and `workflow-dsl.md` L4 — "a schema and a compiler" was ADR-0008's
  reduction, and ADR-0014 superseded it on exactly this point. Both now name the run supervisor.
- `20-domain/lifecycle-state-machines.md` — the conventions cited ADR-0005 and ADR-0008 for
  durability and resumption. They now separate the resume mechanism from its supervision, and
  record the reconciliation ADR-0014 required: the supervisor's run states map onto this lifecycle,
  which stays authoritative on what a customer can observe.
- `10-architecture/data-plane.md` section 7 said two things are called resumption. There are three:
  the library's mechanism, the supervisor's re-invocation, and event-stream replay.
- `10-architecture/containers.md` section 10 — a checkpoint store is still not a container, but for
  a different reason: checkpointing is a library mechanism persisting to Orchestra's own datastore.
  The runtime library, not ADR-0008, is why there is no workflow engine.
- `00-overview/vision.md` — names the library as the source and the server as out of bounds.

---

## [0.16.0] — 2026-09-11

ADR-0005 was superseded on the evidence ADR-0014 already cited. That closes the last correction the
LangGraph evaluation registered against an Accepted record's reasoning; the compiler rules it names
remain open.

### Added

- [ADR-0016](adr/adr-0016-compile-to-the-langgraph-library.md) — the compilation target is
  the LangGraph library, never its server. Supersedes ADR-0005 and carries its decision forward
  unchanged. What it corrects
  is what that decision was said to buy: *"durability, checkpointing, interrupts and resumption come
  free"* held for the MIT library and not for the Elastic-2.0 server, and ADR-0005 never said which
  artefact it meant. Durability is a guarantee only in `sync` mode. Resumption is half inherited —
  the mechanism is the library's and the supervision is ADR-0014's. Substitution is a drain rather
  than a recompile, because persisted state does not migrate.

### Changed

- `10-architecture/data-plane.md` — the Runtime row no longer says the runtime supplies resumption
  outright.
- `00-overview/vision.md` — the ADR-0005 bullet among the open items becomes the four compiler rules
  ADR-0016 names and does not decide.
- `80-reference/langgraph-evaluation.md` section 9 records finding 1 as addressed.
- `70-delivery/testing-strategy.md` claimed no implementation language was selected. ADR-0005,
  carried forward by ADR-0016, records Python for the runtime and TypeScript for the control plane;
  what is unselected is the datastore engine and which side of that boundary the compiler sits on.
- `70-delivery/milestones.md` — M1's exit text said the schemas remained. They are written, and
  `50-workflows/examples/` is the one planned item left.

### Notes

- Considered and rejected: reopening the substrate choice. The evaluation tested both limbs of
  ADR-0005's revisit criterion and established neither. One alternative is better at patching
  in-flight code, but no comparison against the eight Step types has been made, and superseding a
  decision on an argument nobody has done is the error being corrected, made in the other direction.
- Two suspected defects in ADR-0005 turned out not to be defects and are carried forward: its
  escape hatch is consistent with the closed step-type set, which gates it as a ninth type, and its
  Python runtime is what three architecture documents build on.

---

## [0.15.1] — 2026-09-11

A correction to the reasoning recorded for the schema `$id` base, and the decision to keep it. The
0.15.0 entry below stands as written; this one corrects it, on the same principle `audit-model.md`
A2 sets for the records the platform keeps — a correction appends and names what it corrects, the
original stays readable.

### Fixed

- `VERSIONING.md` section 6 described `schemas.orchestra.dev` as merely unregistered, and the
  0.15.0 entry below repeats that. **It is registered, by a third party, and parked** — DNS resolves
  to a lander, HTTPS presents no certificate for the host, and the apex publishes a null MX. So the
  old `$id` was not an address that nothing resolved; it resolved to someone else. The conclusion
  was right and its stated reason was weaker than the facts.

### Changed

- The GitHub-hosted `$id` base is now recorded as **decided rather than provisional**, and
  `schemas/README.md` no longer carries the move as a pending question. Moving the base changes
  every `$id` at once; that is free today, with no consumer and no published SDK, and stops being
  free at the first one. **The first external consumer is the deadline, not a date.**
- `CLAUDE.md` — the provisional-names note now says plainly that `orchestra.dev` is not ours, and
  to check `dig MX` before publishing a contact address. The repository published three addresses
  in sequence, none of which had a mailbox behind it, before that check was run.

---

## [0.15.0] — 2026-09-11

The seven wire schemas were written, and CI became the control over the rule that governs them. This
completes the planned documentation set: every section named in `README.md` is now written.

### Added

- `30-protocol/schemas/` — `run.v1`, `agent-event.v1`, `workflow-definition.v1`, `policy-rule.v1`,
  `approval-request.v1`, `audit-record.v1` and `connector-envelope.v1`. Each member carries its
  reasoning in `$comment`, against the numbered rule it derives from, so that a schema read on its
  own says why a field is shaped as it is and which document owns what it leaves open.
- `scripts/validate-schemas.mjs`, wired into the `Structure and conventions` job. It checks the
  dialect, that each `$id` agrees with its filename, that this list and the section README agree
  with the files on disk, and — the one that matters — that `additionalProperties: false` appears
  nowhere at any depth. That prohibition is what rule R3 rests on, and a schema that closes an
  object in passing looks like a working document until a consumer breaks on a field it was
  promised it could ignore.

### Changed

- `VERSIONING.md` section 6 — schema `$id`s move from the unregistered `schemas.orchestra.dev` to a
  GitHub-hosted base URI that resolves today. An `$id` nothing can fetch is worse than an ugly one a
  validator can. Moving to a registered domain later changes every `$id` at once, which the section
  now records as a migration to plan rather than an edit to make quietly.
- `30-protocol/README.md` and `50-workflows/README.md` — status blocks corrected, and narrowed
  rather than simply cleared. The prose is no longer unvalidated; two gaps named in their place.

### Notes

Three things these schemas deliberately do not do, each recorded in the files themselves.

- **They do not close.** `additionalProperties` is unset or `true` everywhere, without exception.
- **`workflow-definition.v1` does not validate a definition.** `workflow-dsl.md` L9 puts that
  authority in the compiler: R3's must-ignore rule binds *consumers* of a contract, and a compiler
  is not one but the authority deciding what a definition means. The schema fixes the shape; a
  compiler pass rejects the construct, closed by allow-list lookup as `ui-protocol.md` CC3 already
  closes the component catalog.
- **They do not catch everything the prose forbids.** Keeping every object open is what R3 needs,
  and it makes a rule of the form *this field MUST NOT also appear here* inexpressible.
  `event-protocol.md` EG1 requires the four per-event guarantees under `metadata.orchestra` and
  forbids duplicating them at the top level; `agent-event.v1` enforces the first half and cannot
  enforce the second. It says so in place rather than appearing to check it.
- **They do not invent what is unmade.** The policy match language, rule precedence, the expression
  syntax in a definition, what satisfies an Approval Chain, and the Connector tunnel's frame
  vocabulary are all left unconstrained, each pointing at the document that owns it. A schema is the
  worst place to guess, because a guess published here is a contract.

Two gaps stay open and are stated rather than papered over. `agent-event.v1` **carries no pin**:
`event-protocol.md` section 3.1 requires one full upstream commit identifier in the schema file, and
none exists to pin against, so two streamed families are matched by prefix where an exhaustive
constant list is owed. And **eight contracts the protocol prose describes have no schema** — the
seven `gateway-api.md` section 8 names plus its error envelope. `schemas/README.md` answers the
question assigned to it there: two of the eight are ADR-required and the other six wait on a
resource model given in prose rather than in fields. One of them, the Session Token mint, carries a
standing security question rather than a scheduling one.

---

## [0.14.0] — 2026-09-11

The delivery section was written, which forced the specification set to say what it would actually
build first. Three of the four documents decline to give a number that a reader would expect, and
each says why.

### Added

- `70-delivery/mvp-definition.md` — the first vertical slice is one Workflow whose every
  consequential step is provably governed, following directly from ADR-0015. A connectivity
  demonstration is explicitly *not* the slice, which it would have been under superseded ADR-0003.
  The document carries eight exit criteria, the accounting of scope growth, and a statement that it
  **is not yet a plan**: ADR-0014 leaves the run supervisor's size open, and the answer changes both
  the sequence and, in one direction, the positioning.
- `70-delivery/milestones.md` — five milestones defined by entry and exit criteria rather than by
  dates, of which none are given. One piece of work is genuinely calendar-bound and is sequenced
  accordingly: SOC 2 readiness runs in parallel from M1.
- `70-delivery/testing-strategy.md` — organised by which guarantees fail silently rather than by test
  level, because those are the ones where a test is the control rather than a check on one. Eight
  such guarantees are named with the record that requires each.
- `70-delivery/compliance-roadmap.md` — what a security review asks, and which of it is already
  decided as a governance rule rather than pending as compliance work.

### Changed

- `docs/README.md` — the change table now marks ADR-0003 and ADR-0008 as superseded where it cites
  them, rather than listing them as though they still stood.

### Notes

- No date, coverage target, audit window, accessibility conformance level, assessor or certification
  commitment appears in this release. Each was considered and each is undecided; where a figure is
  load-bearing the document says what bounds it and registers the question.

---

## [0.13.0] — 2026-09-11

The reference section was written, and the evidence it gathered superseded two Accepted ADRs. This
is the release where the documentation set checked its own decisions against the world and found two
of them wrong.

### Added

- `80-reference/mcp-evaluation.md`, `langgraph-evaluation.md` and `prior-art-survey.md` — completing
  the section at five evaluations. Every claim carries a source, and each records what an adversarial
  verification pass overturned.
- [ADR-0014](adr/adr-0014-run-supervisor-is-orchestras.md) — the run supervisor is Orchestra's; the
  runtime is an execution substrate. Supersedes ADR-0008, whose declarative-and-compiled decision is
  carried forward unchanged. What was wrong was the reduction to "a schema and a compiler": it
  conflated workflow execution semantics, which the runtime supplies under a permissive licence,
  with run supervision, which ships under terms a hosted multi-tenant product cannot build on.
  Durability at the graph level does not give durable service-level run orchestration — a checkpoint
  says a graph reached a state, not which worker owns the run or who wakes it tomorrow.
- [ADR-0015](adr/adr-0015-governed-action-positioning.md) — differentiate on governed, accountable
  actions, not on connectivity. Supersedes ADR-0003. Five of nine differentiation claims were rated
  contestable on evidence: two model vendors ship SaaS-to-private-network tunnels with no inbound
  listener, and platform vendors now ship centralised agent governance, approval, ownership and
  audit as product capabilities. The claim becomes a model rather than a capability list — a
  consequential agent action is a governed state transition with an accountable Principal, an
  applicable Policy, an explicit approval state where required, and durable evidence of the
  decision, enforced at points a definition author cannot write around. The ADR explicitly does not
  claim governance is uniquely Orchestra's, because the evidence makes that untenable.

### Changed

- `00-overview/` — all five documents rewritten or brought onto ADR-0014 and ADR-0015.
  `product-thesis.md` was ADR-0003 expanded and is now ADR-0015 expanded; `roadmap.md` gains the run
  supervisor and records MVP scope having grown three times — multi-tenancy pulled forward by
  ADR-0001, a connector added by ADR-0007, a supervisor added by ADR-0014.
- `10-architecture/data-plane.md` and `containers.md` — the run supervisor added to what Orchestra
  builds, with durability, checkpointing, interrupts and resume still the runtime's.
- `adr/README.md`, `CLAUDE.md`, `80-reference/README.md` — indexes and the decision table follow.

---

## [0.12.0] — 2026-09-10

Completes the architecture section at eight documents. The last two were held back while everything
else was written, because both depend on design-partner conversations that have not happened. They
are written against an assumed partner profile, at the repository owner's direction, for
demonstration purposes — which unblocks the writing and validates nothing. ADR-0007 remains
**Proposed**.

### Added

- `10-architecture/connector.md` — the transport seam, the connector as a product rather than a
  library, and permanent version skew. From section 3 onward the document is conditional on ADR-0007
  binding, and if that ADR is rejected those sections leave the specification.
- `10-architecture/deployment-topologies.md` — hosted, which ADR-0001 decides and which is not in
  question, and the hybrid variant, which exists only if BYOK turns out to mean data non-egress.

### Changed

- `40-governance/tool-authorization.md` — `threat-model.md` T7 is normative and requires the
  Connector to enforce a local Tool allow-list, while this document still said ADR-0007 "does not
  decide that such a list exists" and hedged the double-enforcement argument. Two normative
  documents said both MUST and undecided about the customer's last control against a compromised
  Control Plane. Existence is settled while ADR-0007 stands; only divergence and read access remain
  open.
- Both new documents originally disagreed about what a data-non-egress reading implies. Proxying
  model traffic through the Connector addresses *credential* egress, which is the benefit ADR-0007
  names; the prompt, tool arguments and results still transit Orchestra infrastructure. So
  non-egress does not promote that proxy to a requirement — the hybrid topology makes it redundant.
- `10-architecture/deployment-topologies.md` had recorded an unreachable policy evaluator as a
  refusal. `reliability.md` F10 decides otherwise: it is a contained fault, never a recorded `deny`,
  because counting outages as governance refusals inflates a figure ADR-0009 meters.
- The claim that hybrid keeps model traffic inside the customer's estate was false. ADR-0002 names
  Azure OpenAI, AWS Bedrock and the Anthropic API as MVP deployment surfaces, all public endpoints
  whichever plane invokes them. Hybrid means the traffic never transits *Orchestra's* infrastructure.

---

## [0.11.0] — 2026-09-10

### Added

- `60-operations/observability.md`, `reliability.md` and `quotas-and-metering.md` — what is
  observable, how the platform fails, and what is counted. No service-level objective, error budget,
  latency target, alert threshold, retention period, price, tier or seat cost appears in any of
  them, because none is decided; where a figure is load-bearing the documents say what bounds it and
  register the question.

### Changed

- `60-operations/reliability.md` F11 had placed a failed Policy Decision write inside the degradable
  record class. ADR-0013 makes the classification a property of the record class rather than a
  runtime choice and rates that reclassification an existential risk. Both evaluation failure and
  decision-write failure are halts; an audit-store outage opens a degraded period concurrently, for
  the second class buffering behind it, and that period is bracketed while the decision write is
  not.
- The degraded-period signal is specified once, by `reliability.md`, which ADR-0013 and
  `audit-model.md` A6 name as its owner. `observability.md` had claimed the specification as well
  and defined it differently; it now specifies only how the signal is surfaced and read.
- `60-operations/quotas-and-metering.md` recorded a Tool invocation refused at the Connector as not
  metered, on the grounds that the origin was never called. `tool-authorization.md` TA18 is
  normative and puts a connector refusal or a mid-call tunnel drop in an unknown state, which is
  precisely why neither may be retried blindly — so the claim cannot be made. A refusal resolved
  before dispatch is not metered; the connector case waits on TA18 separating the two.

---

## [0.10.0] — 2026-09-10

### Added

- `50-workflows/workflow-dsl.md`, `step-types.md` and `execution-semantics.md` — the definition
  language, the eight step types and the execution semantics. The language is a permanent public
  contract even though the section is not normative, because W1 freezes a published version and R3
  makes the contract additive-only.
- `40-governance/policy-model.md` gains **V4**: at the boundary of
  an `approval` Step the verdict set narrows to `require_approval` and `deny`, and `allow` MUST NOT
  be returned. The Step declares that a gate belongs there; Policy decides the chain, not whether
  the gate exists. The rule had first been written in the workflows section, where it bound
  nothing — a constraint on verdicts belongs to the document that owns them.

### Changed

- `50-workflows/workflow-dsl.md` — a cyclic graph is rejected at compile time until an ADR admits
  one. Leaving it unchecked would not have been neutral: it decides the question permissively, W1
  then freezes every definition written under it, and admitting cycles later is MINOR while
  withdrawing them is MAJOR. The language admits no iteration in the interim.
- `20-domain/domain-model.md` — a Tool call in an Agent Run is not a Step Execution. A Step is a
  node in a Workflow, so an Agent Run has none; the Tool enforcement point governs the invocation
  and the invocation is itself the idempotency and compensation anchor. What remains open is only
  what that anchor is called and what its records key on.
- `20-domain/lifecycle-state-machines.md`, `10-architecture/control-plane.md` — a force-drain is
  cancellation of every Run pinned to a version and nothing else, settled by `execution-semantics.md`.
  Both had registered it as undecided.

---

## [0.9.0] — 2026-09-10

### Added

- `30-protocol/event-protocol.md`, `gateway-api.md` and `ui-protocol.md` — the normative wire
  contracts. The event document is written as the Orchestra Agent Event Profile: Orchestra's
  artefact, Orchestra's version, Orchestra's compatibility promise, pinning an upstream commit and
  re-exporting none of it. Ordering and replay are specified as built rather than inherited, because
  the upstream format supplies neither.

### Changed

- `GLOSSARY.md` and `VERSIONING.md` — both still said Orchestra adopts the upstream format as its
  client-facing protocol, stating a **Proposed** decision as settled and making an upstream artefact
  the definition of Orchestra's own wire term. ADR-0004's revision had reached the ADR set and the
  overview but not these two, which everything else cites. The Agent Event is now defined by the
  profile.
- `VERSIONING.md` section 5 — stream resumption was inclusive of the `seq` a client names, which
  redelivers one event on every resumption. `Last-Event-ID` names what the client already has, so
  replay begins after it. Three documents had stated this two different ways and a conformance suite
  can only test one.
- `40-governance/audit-model.md` — the audit ordering key is independent of the event stream's
  sequence, which `event-protocol.md` settles: Audit Records exist for actions belonging to no Run,
  and a decision record precedes the action while its event follows. A7 also sourced a normative
  requirement to a Proposed ADR, which cannot carry one.
- `10-architecture/data-plane.md` — the Gateway authenticates any credential its contract accepts,
  not only a Session Token. A Platform User holds none, and the approval surface is shown to a
  Platform User, so the Session-Token-only reading left the first slice's surface undeliverable.

---

## [0.8.0] — 2026-09-09

### Added

- `10-architecture/system-context.md`, `containers.md`, `control-plane.md`, `data-plane.md`,
  `multi-tenancy.md` and `identity-and-access.md` — the six unblocked architecture views. The
  Control Plane gets its own document for the first time; v0.1 omitted it entirely, and ADR-0003
  calls it a first-class product surface. `multi-tenancy.md` turns ADR-0011 into an implementable
  design: forced row-level security, tenant context safe under connection pooling, a CI control on
  the tenant-scoped table set, and the promotion path that lets one Tenant move to a dedicated
  database without a schema change.

### Changed

- `40-governance/threat-model.md` — the egress default-deny posture was stated as a normative MUST
  and then, fourteen lines later, registered as undecided. Three architecture documents took the
  second reading. The posture is derived here from the threat analysis and binds; only the shape of
  the allow-list is open, and the register now says so rather than reopening the rule.
- `40-governance/threat-model.md`, `policy-model.md` and `audit-model.md` — whether
  platform-operator work crosses a Policy Enforcement Point was claimed settled in one document,
  unmade in another, and routed in a circle between them. It is unmade, it is the same decision as
  attribution rather than a second one, and `audit-model.md` owns both halves.
- `20-domain/`, `40-governance/` — cross-references corrected where a document described a
  sibling's state as it was during drafting rather than as it is.

---

## [0.7.0] — 2026-09-09

Writes the governance section, and settles three questions it could not have been written honestly
without.

### Added

- [ADR-0012](adr/adr-0012-policy-decisions-are-audit-records.md) — a Policy Decision is a class of
  Audit Record, not a separate entity, and Policies are immutably versioned so a decision record
  references a Policy version rather than embedding the rule text. A Run pins the Policy versions
  in force at admission, so editing a Policy cannot change a verdict a Run in flight already
  received — without which ADR-0008's in-flight pinning guarantee is hollow.
- [ADR-0013](adr/adr-0013-fail-closed-policy-decision-writes.md) — a Policy Decision MUST be durable
  before the gated action is attempted; other Audit Records MAY degrade, provided a degraded period
  is recoverable from the trail rather than silent. Durable means surviving a crash, not reaching
  the audit store: a local append replicated afterwards satisfies the rule and keeps the network
  round-trip off the enforcement path. What is forbidden is proceeding first and writing later,
  where a crash loses the record and nothing shows it is missing. Replication lag becomes a
  governed property, since it bounds how current an audit query can be.
- `scripts/open-questions.mjs` — reads every open-questions register and reports them in one view,
  ADR-required first. The registers stay the single source; nothing is copied. `--check` fails when
  a register defers to a document that neither exists nor appears in a section README's planned
  list, and runs in CI: five questions were once deferred into documents that never received them.
- `40-governance/policy-model.md`, `approval-workflows.md`, `tool-authorization.md`,
  `audit-model.md` and `threat-model.md` — the normative governance specification. Every Step is
  evaluated at a Policy Enforcement Point whatever its Side-Effect Class; the class is an input to
  the Policy, not a precondition for evaluation. Tool Catalog registration and the capability grant
  are inputs to the enforcement point rather than gates in front of it, and a failed precondition
  yields a recorded `deny` that names no Policy.

### Changed

- `GLOSSARY.md` — the Policy Decision entry described the record model ADR-0012 rejected, and the
  Audit Record entry now reads "under which Policy version". The glossary is the set's tie-breaker,
  so leaving it stale would have made every document that followed ADR-0012 the defect.
- `20-domain/domain-model.md` — `POLICY_DECISION` is drawn as a subtype of `AUDIT_RECORD` rather
  than as an unconnected entity.
- `20-domain/lifecycle-state-machines.md` — Evidence Set immutability is settled by
  `approval-workflows.md` and leaves the register.
- `CLAUDE.md` — the decision table carried only ADR-0001 to ADR-0010; ADR-0011, ADR-0012 and
  ADR-0013 are Accepted and now appear in the file loaded into every session.

---

## [0.6.0] — 2026-09-09

### Added

- `20-domain/domain-model.md` — the entities, their relationships and cardinality, stated as
  numbered invariants. Records the Tenant, Workspace, Principal, Platform User, End User and
  Service Account entities that ADR-0009 said the domain model must gain and that no document had
  yet received. Fixes the two points easiest to invert: Step Execution rather than the Run is the
  unit of idempotency, retry and compensation, and a Run pins its definition version for life.
- `20-domain/lifecycle-state-machines.md` — states and transitions for Run, Approval Request,
  Workflow version and Connector, with an open-questions register naming what decides each
  undecided transition rather than inventing one.
- `80-reference/ag-ui-evaluation.md` and `80-reference/a2ui-evaluation.md` — the evidence behind
  ADR-0004 and ADR-0010, with a source for every claim and an explicit record of the claims an
  adversarial verification pass overturned. Written so the reasoning survives independently of the
  decision records, and so a revisit can tell what has changed since.

### Changed

- `20-domain/README.md` and `80-reference/README.md` — indexes rather than scaffold notices.

---

## [0.5.0] — 2026-09-09

Carries out the desk-checkable validation steps on the two protocol ADRs. Both remain Proposed;
one changes its decision as a result.

### Changed

- [ADR-0004](adr/adr-0004-adopt-ag-ui-event-protocol.md) — the decision moves from adopting AG-UI
  as the public client-facing contract to adopting it as the internal wire format behind an
  Orchestra-versioned profile. Investigation established that no version of the specification has
  ever been frozen, that the only published artefact disclaims compatibility and asks not to be
  cited as a stable reference, and that governance is a single vendor with no foundation and no
  proposal process. The ADR's own mitigation was to pin a version, and there is none to pin.
  Three factual claims are corrected: the event count, the citation of a blog post as the event
  reference, and — the material one — the claim that ordering and reconnection arrive with the
  protocol. They do not; only state synchronisation does. Replay and resumption are Orchestra's to
  build. The CopilotKit React bindings are no longer adopted: their public API exports a
  LangGraph-specific hook and requires the tool-protocol SDK as a peer dependency, which is the
  rail leak CLAUDE.md rule 2 and ADR-0005 exist to prevent, and they carry no accessibility
  position. Orchestra consumes the AG-UI client library behind its own adapter instead.
- [ADR-0010](adr/adr-0010-a2ui-genui-interchange.md) — validation steps 1 and 3 are answered and
  the ADR's judgement is confirmed rather than assumed. A2UI is pre-1.0 with stability guarantees
  scheduled into an unshipped 1.0 milestone. A first-party React renderer exists; there is no
  React Native renderer and none planned. The allow-listed component registry the decision depends
  on is genuinely supported, but is enforced in renderer code rather than by the specification, so
  server-side catalog validation is now required. The risk table gains a single-vendor governance
  row, and the revisit criterion is sharpened to the published stability guarantee rather than the
  1.0 tag.
- `README.md` and `CLAUDE.md` — the one-line summary of ADR-0004 follows the changed decision.

---

## [0.4.0] — 2026-09-09

### Added

- [ADR-0011](adr/adr-0011-tenant-isolation-shared-schema-rls.md) — tenant isolation by shared
  schema with row-level security, closing the question ADR-0001 deferred. Isolation is enforced by
  the datastore rather than by application code, a missing policy fails CI rather than relying on
  review, and the schema is designed so a single Tenant can later be promoted to a dedicated
  database without a schema change or a change to any public contract.

### Changed

- `00-overview/vision.md`, `roadmap.md` and `scope-and-non-goals.md` — tenant isolation moves out
  of the open questions. The datastore engine takes its place there: ADR-0011 constrains it to one
  that enforces row-level security, but does not choose it.

---

## [0.3.0] — 2026-09-09

Writes the overview section against the decisions recorded in 0.2.0. No decision changes.

### Added

- `00-overview/vision.md` — the problem, the thesis, what Orchestra is and is not, who it is for
- `00-overview/product-thesis.md` — the governance-layer argument, the defensibility sort, and
  prompt injection as a policy problem rather than a prompt problem
- `00-overview/personas.md` — the five personas, their mapping onto Principal types, and the
  distinction between Platform User and End User that ADR-0009 settled
- `00-overview/scope-and-non-goals.md` — in scope, refused, and deferred, kept as three separate
  classes with the reopening condition named for each
- `00-overview/roadmap.md` — phases with entry and exit criteria rather than dates, and the
  dependencies that gate each

### Changed

- `00-overview/README.md` — now an index of written documents rather than a scaffold notice
- `.markdownlint-cli2.jsonc` — the table pipe convention was pinned to `MD060`, which is
  `table-column-style` and accepts only `aligned | any | compact | tight`. A `MD055` value placed
  there matched nothing, so the rule never ran. Corrected to `MD055`; the whole set still passes
  with it enforcing.

---

## [0.2.0] — 2026-09-08

Restructures the single-file vision brief into a governed documentation set and records ten
decisions that were previously implicit or unmade.

### Added

- `README.md` — documentation index, conventions and reading paths
- `VERSIONING.md` — compatibility policy across nine versioned artifacts
- `GLOSSARY.md` — canonical vocabulary
- `CHANGELOG.md` — this file
- `adr/` — ADR practice, MADR template, index, and ADR-0001 … ADR-0010
- Directory structure `00-overview/` … `80-reference/`, `rfc/`, `archive/`, `assets/`

### Changed

- Product shape fixed as multi-tenant SaaS; multi-tenancy moved from Phase 3 to MVP (ADR-0001)
- Platform repositioned as a governance and connectivity layer (ADR-0003)
- Model abstraction reduced from a capability router to a credential/endpoint broker (ADR-0006)
- Workflow engine moved from an explicit non-goal to a core capability, bounded to a declarative
  definition layer compiled onto the runtime (ADR-0008)

### Removed

- Capability-based and preference-based model routing, unimplementable under BYOK (ADR-0006)
- The proposal to author a bespoke agent event protocol (ADR-0004)

### Superseded

- `agent-integration-platform-vision.md` v0.1 → [`archive/vision-v0.1-2026-09-08.md`](archive/vision-v0.1-2026-09-08.md)

---

## [0.1.0] — 2026-09-08

### Added

- Initial single-file vision and architecture brief
