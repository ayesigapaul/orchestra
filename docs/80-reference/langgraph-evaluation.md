---
title: LangGraph Evaluation
doc_id: DOC-094
version: 0.16.0
status: Draft
last_updated: 2026-09-11
owners: [platform-architecture]
depends_on: [ADR-0005, ADR-0008, ADR-0001, ADR-0011]
---

# LangGraph Evaluation

The evidence behind [ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md) and behind the
central reduction in [ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md), recorded so
the reasoning survives independently of the decision records. Both ADRs are **Accepted**, and
nothing here changes either of them. This is a record of evidence, not a decision record: where the
evidence turns out narrower than the ADR text, section 9 says what the evidence is, names the ADR,
and says what a superseding ADR would have to argue — and then stops. Accepted ADRs are immutable
per [`README.md`](../README.md) §5, and 80-reference is informative per §3 of the same document.

Investigation date: **2026-09-10**, against primary sources — package registries and the LICENSE
files inside the published distributions, the repository and its source files, the project's own
documentation, threat model and published security advisories, and the vendor's release policy. The
repository was pushed on the day of writing and shipped 133 commits in the preceding ninety days.
Treat every figure as a timestamped observation, not a standing fact, and where a source could not
be found the finding is recorded as not established rather than inferred. An adversarial
verification pass was run over this research; every claim it narrowed or overturned is published in
section 11, on the same principle the two 2026-09-09 evaluations adopted — a reader of a research
record needs to know which findings were fragile.

LangGraph's own vocabulary appears throughout because this document is about LangGraph. Per
[`GLOSSARY.md`](../GLOSSARY.md) and ADR-0005 it MUST NOT appear in an Orchestra public contract —
a requirement those documents already carry, restated here with its citation, not created here.

## 1. What is actually being tested

ADR-0005 records as a positive consequence that *"Durability, checkpointing, interrupts and
resumption come free."* ADR-0008 turns that into scope: **"Orchestra does not build: durability,
checkpointing, interrupts, or resumption."** That is the largest single reduction in the platform's
scope — what ADR-0008 calls reducing *"build a workflow engine"* to *"build a schema and a
compiler"*.

Seven questions were put to the evidence, one per section below: release maturity and churn (§2),
licence (§3), governance, adoption and security history (§4), what durability is guaranteed and by
which component (§5), whether a Run can suspend for days and resume (§6), what the compilation
boundary excludes and costs (§7), and whether substitution is what ADR-0005 says (§8). Section 9
states the answer against each ADR sentence it bears on, and lists the ADR work the evidence argues
for without doing any of it here.

## 2. Version, cadence, stability and churn

LangGraph has reached a stable release. That is the clearest contrast with the projects assessed in
[`ag-ui-evaluation.md`](ag-ui-evaluation.md) and [`a2ui-evaluation.md`](a2ui-evaluation.md), but the
contrast has to be drawn narrowly: **neither has a stability guarantee in force**, AG-UI has no
frozen version to pin at all, and A2UI does designate v0.9.1 as its current production release —
its problem is that any pin is two-dimensional, package version plus `protocolVersion`, and is
unenforceable in CI.

The versions below come from the registries. **The licence column is registry metadata, and
section 3 re-checks it against the LICENSE file actually shipped** — which is where the one surprise
in this document lives.

| Package | Version on 2026-09-10 | Released | Licence in registry metadata |
| --- | --- | --- | --- |
| [`langgraph`](https://pypi.org/pypi/langgraph/json) (Python) | **1.2.11** | 2026-08-11 | `MIT`, `Development Status :: 5 - Production/Stable` |
| [`langgraph-checkpoint`](https://pypi.org/pypi/langgraph-checkpoint/json) | 4.2.0 | 2026-08-07 | MIT |
| [`langgraph-checkpoint-postgres`](https://pypi.org/pypi/langgraph-checkpoint-postgres/json) | 3.1.2 | 2026-08-07 | MIT |
| [`langgraph-checkpoint-conformance`](https://pypi.org/pypi/langgraph-checkpoint-conformance/json) | 0.0.2 | 2026-04-08 | MIT |
| [`@langchain/langgraph`](https://registry.npmjs.org/@langchain/langgraph) (JS) | 1.4.14 | 2026-09-04 | MIT |
| [`langgraph-api`](https://pypi.org/pypi/langgraph-api/json) (server) | 0.14.0 | 2026-09-08 | **Elastic-2.0** |
| [`langgraph-runtime-inmem`](https://pypi.org/pypi/langgraph-runtime-inmem/json) | 0.34.0 | 2026-09-08 | **Elastic-2.0** |

From the PyPI record: seven minor lines in the twenty-one months from `0.0.8` (2024-01-08) to
`1.0.0` (2025-10-17), then two further minor lines and **thirty-one patch releases** — thirty-four
stable releases in all — in the eleven months since, ending `1.2.11` on 2026-08-11. That is 255
stable releases in total, and roughly three a month after 1.0 against roughly ten a month before it.
The cadence slowed sharply, by a factor of about three; an earlier draft of this document said
*"eleven patches"*, which is the patch index of the current minor line and understated post-1.0
cadence roughly threefold.

A published policy backs the slowdown: the
[release policy](https://docs.langchain.com/oss/python/release-policy) states that *"Breaking
changes to the public API will only occur in major version releases"*, that minor bumps *"add new
features without breaking changes"*, and that after 2.0 ships *"1.0 will enter MAINTENANCE mode for
at least 1 year"*; the [versioning page](https://docs.langchain.com/oss/python/versioning) makes 1.0
an LTS release. That is a stronger compatibility position than anything else Orchestra depends on,
and it is what makes ADR-0005's pinning mitigation cheap rather than theoretical. Two caveats: the
Python and JavaScript lines are not in lockstep — 1.2.11 against 1.4.14 — so a pin is per-language;
and documentation URLs move, the durable-execution page now redirecting into persistence and the
`langgraph-platform/*` paths now serving a product renamed *Agent Server* under LangSmith.

Churn was therefore real before 1.0 and modest after it, and the
[v1 release notes](https://docs.langchain.com/oss/python/releases/langgraph-v1) call it *"a
stability-focused release"* in which *"Graph primitives (state, nodes, edges) and the
execution/runtime model are unchanged."* The one exception matters to Orchestra specifically: the
sole **deprecation** those notes name is that *"The LangGraph `create_react_agent` prebuilt has been
deprecated in favor of LangChain's `create_agent`"* — so the successor to the prebuilt an `agent`
emitter would bind to now lives in a different package. Nothing was removed. The word *removal* does
not appear in the notes, and `langgraph` 1.2.11 still hard-depends on `langgraph-prebuilt` at
`>=1.1.0,<1.2.0`, so `create_react_agent` still ships. But a major release advertised as changing
nothing did re-home the one prebuilt that ADR-0008's `agent` Step type is the obvious consumer of,
so ADR-0005's mitigation — *"Pin versions; isolate all LangGraph contact in the compiler and runtime
adapter"* — was load-bearing on its first test.

## 3. Licence — the finding that constrains the architecture

**The library is MIT, checked against the LICENSE file rather than against a registry field.** The
[repository LICENSE](https://github.com/langchain-ai/langgraph/blob/main/LICENSE) is the plain MIT
text — no transition clause, no dual licence, no licence-key mechanism — and GitHub's own detection
for the [repository](https://github.com/langchain-ai/langgraph) reports `MIT` rather than
`NOASSERTION`. Every library package Orchestra would compile onto sits in that repository.

**The server does not.** `langgraph-api` 0.14.0 ships a LICENSE file inside its wheel, at
`langgraph_api-0.14.0.dist-info/licenses/LICENSE`, and that file is the full
[Elastic License 2.0](https://www.elastic.co/licensing/elastic-license) text, whose Limitations
section reads: *"You may not provide the software to third parties as a hosted or managed service,
where the service provides users with access to any substantial set of the features or functionality
of the software."* `langgraph-runtime-inmem` 0.34.0 declares `License: Elastic-2.0` in its wheel
metadata but ships **no LICENSE file at all**, so for that package the licence rests on the
publisher's metadata rather than on a distributed licence text. That is a weaker basis and is
recorded as one.

Neither server package has a public repository. The Python
[`libs/` tree](https://github.com/langchain-ai/langgraph/tree/main/libs) holds only the checkpoint
packages, the CLI, `langgraph`, `prebuilt` and the two SDKs — no server — and
`langchain-ai/langgraph-api` returns 404. LangGraph's own
[threat model](https://github.com/langchain-ai/langgraph/blob/main/.github/THREAT_MODEL.md) puts it
out of scope in those words: *"LangGraph Server / `langgraph-api` — Closed-source server runtime;
not in this repo"*.

[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md) fixes Orchestra as multi-tenant SaaS.
Stated as narrowly as the evidence allows: **under the ELv2 grant as published, Orchestra could not
offer the Agent Server as part of a hosted multi-tenant service.** Two hedges belong on that
sentence and an earlier draft of this document omitted both. First, ELv2 constrains the default
grant; it does not extinguish the possibility of a separate commercial arrangement with LangChain,
Inc., and one licensed route is visible in the vendor's own documentation — self-hosted and BYOC
deployment are *"available on the Enterprise plan"* (section 5). No such arrangement has been
sought. Second, whether a particular architecture *"provides users with access to any substantial
set of the features or functionality of the software"* is a legal judgement about a product that
does not yet exist; **this reading has not been reviewed by counsel.**

The architectural consequence follows from the bounded statement rather than from an absolute
prohibition: on the default grant, and absent a commercial arrangement nobody has pursued, every
capability that lives only in the server is Orchestra's to build. ADR-0005 does not draw the
library/server distinction at all — it names *LangGraph* without saying which artefact.

One asymmetry, easy to misread the other way: the JavaScript
[`libs/langgraph-api`](https://github.com/langchain-ai/langgraphjs/tree/main/libs) *is* public, its
`package.json` declares MIT and GitHub detects MIT for that repository — but ADR-0005 fixes the
runtime as Python.

**A naming divergence worth settling.** The vendor renamed the `langgraph-platform/*` documentation
paths under LangSmith, and the server component is now documented as **Agent Server**; this document
uses that name for the `langgraph-api` runtime.
[`prior-art-survey.md`](prior-art-survey.md) §6 assesses the same vendor's commercial layer as
*LangSmith Deployment*, and its section 1 field table records the licensing as platform proprietary
with MIT client SDKs. *Proprietary* and *ELv2 source-available* are materially different, and that
table is the one place a reader compares licences across the field. Reconciling it against this
section is an outstanding correction in that document, not in this one.

## 4. Governance, adoption and security history

Single vendor, the same exposure as AG-UI and A2UI. LangChain, Inc. announced a
[$125M Series B at a $1.25B valuation](https://www.langchain.com/blog/series-b) on 2025-10-20, led
by IVP alongside Sequoia, Benchmark, Amplify, CapitalG and Sapphire Ventures, and describes a dual
model: open-source frameworks free, LangSmith the commercial platform. No foundation transfer was
found and no statement of intent either way.

On process, an earlier draft of this document overstated the absence. What the repository genuinely
lacks is a **`GOVERNANCE.md`**, a **`CODEOWNERS`** and any RFC mechanism by which Orchestra could
land a change it needs. It is not otherwise bare: `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` resolve
to the organisation-wide defaults in
[`langchain-ai/.github`](https://github.com/langchain-ai/.github/blob/main/CONTRIBUTING.md), and
that contributing guide sets a hard gate — *"All pull requests must link to an issue or discussion
where a solution has been approved by a maintainer. PRs without prior approval will be closed."*
There is therefore a documented path for landing a change, and it runs through a named maintainer's
prior approval. What is absent is any published account of who the maintainers are, how they are
chosen, or how a disputed decision is resolved.

The project does publish a threat model, which neither AG-UI nor A2UI provides: five trust
boundaries (TB1 through TB5) and an explicit out-of-scope list. Two of its statements bear directly
on Orchestra. The first: *"Checkpoint savers index by `thread_id`. Without application-level auth,
any caller with a valid thread_id can access that thread's state."* The second, quoted in full
because the fuller version cuts slightly against the conclusion drawn from it: *"The framework
provides `BaseCheckpointSaver` as an abstract interface and the `Auth` handler system for
authorization … It does not enforce authentication by default because it operates as a library, not
a server. The `langgraph-api` server layer (out of scope) is responsible for enforcing auth on API
endpoints. Users embedding LangGraph directly must implement their own access controls."*

So LangGraph ships an `Auth` handler *interface* but enforces nothing by default, and the
enforcement layer is the out-of-scope server of section 3. Tenant scoping in the checkpoint store is
therefore Orchestra's, as CLAUDE.md rule 7 and
[ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) require — which means the
row-level-security design must cover a table set Orchestra does not author, a point stated in no
Orchestra document.

### 4.1 Security advisory history

Nine advisories are published on the repository's
[security advisories](https://github.com/langchain-ai/langgraph/security/advisories) page: four
high, five medium, spanning 2025-10-29 to 2026-08-28. An earlier draft of this document reported
none of them while citing the threat model as a governance positive — a material understatement for
a document underwriting a multi-tenant platform, and one the threat model itself pointed at, since
its own changelog records GHSA-g48c-2wqr-h844.

| Advisory | Severity | Published | Affected package | Fixed in |
| --- | --- | --- | --- | --- |
| [GHSA-fvww-7h3r-vfhp](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-fvww-7h3r-vfhp) — SDK custom auth silently ignores `actions=` on resource decorators | High | 2026-08-28 | `langgraph-sdk` ≤ 0.4.3 | 0.4.4 |
| [GHSA-47pj-3jcm-6whg](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-47pj-3jcm-6whg) — namespace prefix matching crosses segment boundaries in the Postgres and SQLite stores | Medium | 2026-07-30 | `langgraph-checkpoint-postgres`, `langgraph-checkpoint-sqlite` < 3.1.1 | 3.1.1 |
| [GHSA-w39p-vh2g-g8g5](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-w39p-vh2g-g8g5) — unsafe URL path construction in the SDK | Medium | 2026-05-22 | `langgraph-sdk` ≤ 0.3.14 | 0.3.15 |
| [GHSA-fjqc-hq36-qh5p](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-fjqc-hq36-qh5p) — unsafe JSON deserialization in checkpoint loading | Medium | 2026-05-22 | `langgraph-checkpoint` ≤ 4.1.0 | 4.1.1 |
| [GHSA-g48c-2wqr-h844](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-g48c-2wqr-h844) — unsafe msgpack deserialization in checkpoint loading | Medium | 2026-03-05 | `langgraph` ≤ 1.0.9 | 1.0.10 |
| [GHSA-mhr3-j7m5-c7c9](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-mhr3-j7m5-c7c9) — `BaseCache` deserialization of untrusted data, remote code execution | Medium | 2026-02-23 | `langgraph-checkpoint` < 4.0.0 | 4.0.0 |
| [GHSA-9rwj-6rc7-p77c](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-9rwj-6rc7-p77c) — SQL injection via metadata filter key in the SQLite checkpointer `list` method | High | 2025-12-09 | `langgraph-checkpoint-sqlite` < 3.0.1 | 3.0.1 |
| [GHSA-wwqv-p2pp-99h5](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-wwqv-p2pp-99h5) — remote code execution in `json` mode of `JsonPlusSerializer` | High | 2025-11-05 | `langgraph-checkpoint` < 3.0 | 3.0 |
| [GHSA-7p73-8jqx-23r8](https://github.com/langchain-ai/langgraph/security/advisories/GHSA-7p73-8jqx-23r8) — SQLite filter-key SQL injection in `SqliteStore` | High | 2025-10-29 | `langgraph-checkpoint-sqlite` ≤ 2.0.10 | 2.0.11 |

Three readings, all of which land on components this document recommends Orchestra depend on.

- **The store family carries an isolation defect class.** GHSA-47pj-3jcm-6whg is cross-boundary
  namespace matching in exactly the Postgres and SQLite stores that ADR-0011's row-level-security
  design would sit on top of, and GHSA-9rwj-6rc7-p77c and GHSA-7p73-8jqx-23r8 are SQL injection
  through a filter key in the same family's `list` path — the query surface section 7 discusses.
- **The checkpoint serializer has been patched three times** for deserialization of untrusted data,
  twice at remote-code-execution severity. A tenant-scoped Orchestra checkpointer inherits that
  component and that history.
- **The pinned versions in section 2 are on the patched side of all nine.**
  `langgraph-checkpoint-postgres` 3.1.2 exceeds 3.1.1, `langgraph-checkpoint` 4.2.0 exceeds 4.1.1
  and `langgraph` 1.2.11 exceeds 1.0.10.

Consequence for ADR-0005's pinning mitigation, stated as a finding rather than as a requirement: a
pin is a compatibility device, and this history makes it simultaneously a security-uptake liability,
because a pin that is never moved is a pin that never takes a patch. **Recommended, not decided:**
the pinning mitigation needs a patch-uptake obligation beside it, and ADR-0011's design should be
reviewed against the store-isolation and filter-key defect classes above. No ADR records either.
Publishing a threat model and indexing nine advisories is a maturity signal; it is not a clean bill
of health, and the earlier draft read it as one.

### 4.2 Adoption signals

| Signal | Reading on 2026-09-10 |
| --- | --- |
| [Stars / forks / watchers](https://github.com/langchain-ai/langgraph) | 41,405 / 6,991 / 181; repository created 2023-08-09 |
| Commits, trailing 30 / 90 days | 35 / 133; last push 2026-09-10 |
| Open issues / open pull requests | 530 / 246 — GitHub's headline `open_issues_count` of 776 includes pull requests |
| [`langgraph` downloads](https://pypistats.org/packages/langgraph), month to 2026-09-09 | 56,784,151 |
| [`@langchain/langgraph` downloads](https://api.npmjs.org/downloads/point/last-month/@langchain/langgraph) | 12,020,073 |
| `langgraph-checkpoint-postgres` downloads, same month | 8,312,188 |
| [Named enterprise users](https://www.langchain.com/built-with-langgraph), vendor-published | LinkedIn, Uber, Klarna, Elastic, AppFolio |

Two readings deserve care. A 35-commit month is not the 790 AG-UI posted; on a project this widely
installed that reads as maturity, and the same-day push rules out dormancy — but a change Orchestra
needs will not land quickly, and section 4's contributing gate says it will not land at all without
a maintainer's prior approval. And the Postgres checkpointer runs at roughly 15% of core installs,
so the durable configuration ADR-0008 depends on is a minority of real usage — though MongoDB and
Cosmos DB savers and the server's own store absorb part of that gap, so the ratio bounds nothing.

## 5. Durability and checkpointing, by which component

**What is guaranteed is real, and the wording is honest.** The
[checkpointers documentation](https://docs.langchain.com/oss/python/langgraph/checkpointers) defines
three durability modes:

| Mode | Documented behaviour |
| --- | --- |
| `"exit"` | *"persists changes only when graph execution exits"* — *"you cannot recover from system failures (like process crashes) mid-execution"* |
| `"async"` | *"persists changes asynchronously while the next step executes"* — *"a small risk that LangGraph does not write checkpoints if the process crashes"* |
| `"sync"` | *"persists changes synchronously before the next step starts"* — *"high durability at the cost of some performance overhead"* |

Only `"sync"` is a durability guarantee; the other two are performance settings with named loss
windows. A governance layer that must say what happened has one usable mode. **Recommended, not
decided:** a compiler that leaves the durability mode to a customer definition cannot guarantee what
the audit trail claims, so the choice belongs to the compiler rather than to the definition
language. No ADR records that, and ADR-0008's Step schema does not name the field. Partial failure
is specified too — pending checkpoint writes from nodes that completed in a failed super-step are
stored, so on resume *"you don't re-run the successful nodes"* — which is what ADR-0008's Step
Execution idempotency needs.

**All of it is MIT.** `langgraph-checkpoint` 4.2.0 defines the interface and an in-memory saver, and
`langgraph-checkpoint-postgres` 3.1.2 is the production implementation, *"Ideal for using in
production"* per the same page. A published
[conformance suite](https://github.com/langchain-ai/langgraph/tree/main/libs/checkpoint-conformance)
for third-party savers is what makes a tenant-scoped Orchestra checkpointer credible — though it is
itself at **0.0.2**, last released 2026-04-08, so it is a thin plank.

**What is supplied by nothing Orchestra can use.** Nothing in the library notices that a Run has
crashed or is waiting, and nothing re-invokes it; the model is a call. The component supplying a
queue, workers, background runs, cron and horizontal scale is the
[Agent Server](https://docs.langchain.com/langsmith/agent-server), where *"the API server enqueues
it and a queue worker picks it up for execution"*, where *"Dedicated queue workers handle run
execution on separate hosts from the API server"* and *"Each tier scales independently — API servers
scale on request volume, queue workers scale on pending run count"*, and where the persisted core
resources are *"assistants, threads, runs, and cron jobs"*. It is the server, not the library, that
supplies the supervision sentence: *"if a worker is interrupted, the run can resume from the last
checkpoint rather than from the beginning."* That is the ELv2 product of section 3, additionally
gated behind an Enterprise plan for
[self-hosted and BYOC deployment](https://docs.langchain.com/langsmith/platform-setup), whose page
states that *"Self-hosted and BYOC are available on the Enterprise plan."* Who re-invokes a crashed
Run in an open-source deployment, with what backoff and under what timeout, is **not established**
from the open-source documentation: the persistence and checkpointer pages describe the mechanism
and omit the supervision, because it is the server's job.

**Consequence for ADR-0008.** Of the four things ADR-0008 says Orchestra does not build, three hold
outright — durability, checkpointing, interrupts. **Resumption is half true:** the mechanism is
supplied and the supervision is not. An earlier draft of this document then softened that with a
sentence — *"does not overturn the reduction, since schema and compiler remain the bulk of it"* —
for which no evidence was gathered and which sections 3 and 5 contradict. It is deleted. Stated
plainly instead:

- The reduction **holds** for durability, checkpointing and interrupts. All three are mechanisms of
  the MIT library, and Orchestra inherits them.
- The reduction **does not hold** for run supervision. Run status, leasing a waiting or crashed Run
  to a worker, backoff, timeouts, the queue, the workers, scheduling and horizontal scale all live
  in the ELv2 tier of section 3. That tier is not a gap upstream may close: on the default grant it
  is unavailable to ADR-0001's product shape for as long as that grant stands, so Orchestra would
  have to build it.
- **How large that tier is relative to *"a schema and a compiler"* is not established here.** No
  estimate was made, and none should be read into this document in either direction.

A superseding ADR to ADR-0008 would have to argue three things: that the negative list narrows to
durability, checkpointing and interrupts; that a Run supervisor — run status, leasing, backoff,
timeouts, queue, workers, scheduling, horizontal scale — is named as Orchestra-built, with ADR-0001
plus the ELv2 grant as the reason it can never be inherited; and that the reduction ADR-0008 rests
on still holds with that tier inside it. **This document argues none of the three.** ADR-0005 needs
the matching correction in the same or a companion ADR: *"come free"* is true of the MIT library, so
such an ADR would have to name the library and record the server as out of bounds. Both ADRs are
Accepted and immutable; this is a decision for the repository owner, not for an evaluation.

## 6. Interrupts and resumption

ADR-0008 needs a Run to suspend at an Approval Request, possibly for days, and resume. It can. The
[interrupts documentation](https://docs.langchain.com/oss/python/langgraph/interrupts) requires a
checkpointer, a thread id and the `interrupt()` call, and states that on an interrupt LangGraph
*"saves the graph state using its persistence layer and waits indefinitely until you resume
execution"*, with no documented timeout. Resumption is a fresh invocation with the same thread id,
so it survives a process restart by construction. Three limits are hard and documented, and all
three land on the compiler rather than on the customer.

1. **Resume re-executes the whole Step.** *"the runtime restarts the entire node from the
   beginning — it does not resume from the exact line where `interrupt` was called"*, and therefore
   *"Side effects called before `interrupt` must be idempotent."* **Recommended, not decided:** an
   `approval` Step compiled as a node containing the interrupt and nothing else is the only shape
   that satisfies this. A Step that both acts and waits double-executes its action on every resume,
   which is CLAUDE.md working rule 6 violated by construction rather than by accident. No ADR
   carries that compiler rule.
2. **Interrupt matching is positional.** *"Matching is strictly index-based, so the order of
   interrupt calls within the node is important"*, and the
   [functional API guide](https://docs.langchain.com/oss/python/langgraph/functional-api) warns that
   a lost execution order means *"one interrupt call may be matched with the wrong resume value."*
   Deterministic compilation satisfies this trivially — one more reason ADR-0005's escape hatch,
   *"a reviewed custom step type, never raw customer code"*, must stay what the ADR already says it
   is.
3. **Retries are Step-scoped and retry-by-default.** `RetryPolicy` defaults to `max_attempts=3`,
   `initial_interval=0.5`, `backoff_factor=2.0` and jitter on, and its
   [default predicate](https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/_internal/_retry.py)
   returns `False` only for a fixed list of programming errors — `ValueError`, `TypeError`,
   `ArithmeticError`, `ImportError`, `LookupError`, `NameError`, `SyntaxError`, `RuntimeError`,
   `ReferenceError`, `StopIteration`, `StopAsyncIteration`, `OSError` — and `True` for everything
   else it does not recognise. A retry re-runs the entire node. **Recommended, not decided:** retry
   policy emitted per Side-Effect Class and never set globally. ADR-0008 already carries the
   underlying obligation — *"failure after a side-effecting step triggers compensation, never blind
   retry"* — but it does not carry the compiler rule that would implement it.

**Resumption across a version change is where the runtime is weakest — but the source's scope has
to be read before generalising.** The vendor's
[guidance on schema and topology changes](https://support.langchain.com/articles/1785884356-managing-state-schema-changes-across-langsmith-deployment-versions)
is a support article scoped to **LangSmith Deployment, the hosted product** — the very component
section 3 concludes Orchestra cannot host. It states that *"Completed threads can survive topology
changes (node renames, additions, removals). Interrupted threads cannot"*; that renaming a state
field is unsafe because *"Old field data is lost; new field gets default"*; and that for breaking
changes you should *"drain existing threads before deploying or accept that in-progress threads will
need to be restarted."* Separate what that establishes from what it infers:

- **Established for the library.** Interrupt matching is index-based and order-sensitive, from the
  interrupts and functional-API pages cited above, which are open-source library documentation.
- **Inferred, not established.** That a suspended Run cannot be migrated across a node rename in a
  self-hosted open-source deployment. The mechanism makes it plausible — an interrupted thread is
  waiting to re-enter a node identified by name — but the only source that says so is scoped to the
  hosted product, and no library-level statement of it was found. Section 10 records this.

On the inferred reading there is no in-flight migration facility, which is exactly
[`VERSIONING.md`](../VERSIONING.md) §8 rule W3 and ADR-0008's first follow-on item — *"A run started
on v3 finishes on v3, forever"* — with the runtime making the policy free to hold. **ADR-0008 is
confirmed, and made cheap rather than proved inevitable.** An earlier draft called it *"the only
implementable policy"*; section 8 of this same document contradicts that, because Temporal supplies
a patching primitive precisely for changing workflow code with executions in flight. In-flight
migration is implementable — just not on this runtime. W3 states the rule as a deliberate refusal,
*"the correct answer is simply to refuse"*, and it should stay readable as a choice, or a future ADR
has no ground on which to revisit it.

## 7. The compilation boundary and what it costs

ADR-0005 accepts that *"Some LangGraph capabilities will be unreachable from the definition
language. Deliberate."* Concretely, from the
[graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) and from the `add_node`
signature in
[`state.py`](https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/graph/state.py):

| Runtime capability | Reachable from a declarative Step? |
| --- | --- |
| Arbitrary node body (any callable) | **No.** That is the point of ADR-0008, not a gap |
| Custom per-channel reducers | **No** without a fixed reducer vocabulary in the schema |
| `Command(goto=…, update=…)` decided inside a node | **No.** `condition` covers declared branching only |
| Arbitrary conditional-edge functions | **Partly** — as declared predicates, not as code |
| `Send` fan-out with runtime-computed payloads | **Partly.** `parallel` covers declared fan-out; map-reduce over a runtime-sized collection has no schema construct today |
| Functional API (`@entrypoint`, `@task`) | **No**, and none needed — a second authoring model, not a capability |
| `error_handler`, `defer`, `timeout`, `cache_policy`, `retry_policy` | **Yes**, as declared Step fields; none is named in ADR-0008's Step schema today |
| `DeltaChannel` (beta; *"requires langgraph>=1.2"*) | A compiler optimisation, never customer-visible |

The pattern is sharp: **anything whose semantics is a function is unreachable; anything whose
semantics is a value is reachable.** The gap felt first will be dynamic fan-out — a Workflow running
one Step per invoice line has no expression today, and ADR-0008's deny-by-default rule means adding
one needs an ADR.

**Traceability is cheap, and the indirection ADR-0005 anticipates is largely removed by
`add_node(metadata=…)`.** ADR-0005 states no cost — its negative consequence is a requirement,
*"Every compiled graph MUST retain a traceable link back to its source definition, version and step
identifiers"* — and `add_node` satisfies it directly, taking a first-class
`metadata: dict[str, Any] | None` parameter, so a compiled node can carry the definition id, version
and Step id without a side table, and node names are the compiler's to choose. An earlier draft said
ADR-0005 *"overstates its cost"*, which graded the ADR against a claim it never made.

The durable side is thinner.
[`CheckpointMetadata`](https://github.com/langchain-ai/langgraph/blob/main/libs/checkpoint/langgraph/checkpoint/base/__init__.py)
is a `TypedDict` declared `total=False` carrying five documented fields — `source`, `step`,
`parents`, `run_id`, and the beta `counters_since_delta_snapshot` that backs `DeltaChannel`. It is
not a closed contract, and an earlier draft calling it *"a closed shape"* with four fields was wrong
twice over: the line above the class reads *"Marked as total=False to allow for future expansion"*,
and the checkpointers documentation instructs custom-saver authors to *"Store metadata in full — do
not strip unknown keys"*, so unknown keys are expected to survive. What is closed is the **writer**.
The Pregel loop's `_put_checkpoint` is called once per super-step with a fresh dict —
`{"source": "loop"}` and its siblings — and sets `step` and `parents` on it rather than merging
caller metadata, so nothing today records whether a thread is waiting for a human. The saver
interface does not close the door either: `BaseCheckpointSaver.list()` takes
`filter: dict[str, Any] | None`, not a `CheckpointMetadata`-restricted filter, so a saver is not
structurally barred from filtering on a persisted custom key — but nothing writes such a key and no
portability guarantee across savers exists. The finding therefore narrows to this: **no
saver-portable query for "Runs awaiting approval" is established**, and that is a property of the
current writer rather than a guaranteed closed contract. The recommendation is unchanged.
**Recommended, not decided:** the Approval Request inbox should be Orchestra's own tenant-scoped
table, with the checkpoint as the execution state behind it rather than as the index — consistent
with ADR-0008's audit scope, and stated in no ADR.

The genuine cost is a **naming invariant**, not the indirection ADR-0005 anticipated. On the
inferred reading of section 6 — an interrupted thread cannot survive a node rename — compiled node
names are part of the durable contract. **Recommended, not decided:** the compiler should produce
byte-identical node names for a given definition version across every recompile, indefinitely, or
suspended Runs break. ADR-0005's golden-test mitigation covers definition-to-graph mapping and does
not name node-name stability; no ADR carries the invariant.

## 8. Substitution

ADR-0005 argues that compilation makes *"runtime substitution … a compiler change, not a platform
rewrite."* Half of that is confirmed and half is optimistic.

A credible alternative substrate market exists today, verified from registries rather than asserted:
[`temporalio`](https://pypi.org/pypi/temporalio/json) 1.32.0,
[`dbos`](https://pypi.org/pypi/dbos/json) 2.31.1 and
[`agent-framework`](https://pypi.org/pypi/agent-framework/json) 1.18.0 are all MIT. On maturity the
registry is less uniform than an earlier draft of this document claimed: `dbos` and
`agent-framework` declare `Development Status :: 5 - Production/Stable`, while `temporalio`
publishes no development-status classifier at all — its classifier list is an MIT licence classifier
and five Python-version classifiers, nothing else.

Alongside them, Pydantic AI documents
[five officially supported durable-execution backends](https://pydantic.dev/docs/ai/capabilities/durable_execution/overview/)
— Temporal, DBOS, Prefect, Restate and AWS Lambda durable functions, *"co-maintained by the Pydantic
and vendor teams"* — plus two further *"Additional external SDK integrations"*, Kitaru and Apache
Airflow. It separately exposes a *"stable durable execution backend builder"* so that *"Third-party
runtime authors can … integrate another engine without importing Pydantic AI internals."* That
builder is the integration seam offered to third parties, not the mechanism the five documented
backends sit behind; an earlier draft of this document repurposed the quotation. The corrected
reading strengthens rather than weakens the point: this is the closest published analogue to
Orchestra's boundary, and the best evidence that ADR-0005's structural bet is the ordinary one.

What substitution would involve: rewrite the compiler's emitter and the runtime adapter; re-express
the Step types against a different durability model; and — the part ADR-0005 does not name — deal
with persisted state, because checkpoints are in LangGraph's format and no alternative substrate
reads them. Substitution is affordable for **new** Runs and effectively impossible for
**in-flight** ones; a migration is a drain, not a cutover, and ADR-0008's version pinning is what
makes a drain tractable.

Two capability differences matter to whoever revisits this. First, Temporal supplies
[patching](https://docs.temporal.io/patching), which *"applies a code change to new Workflow
Executions while avoiding disruptive changes to in-progress Workflow Executions"* — a compatibility
primitive for code change with executions in flight, where LangGraph's documented answer is to
drain. It is a branch, not a state migration, but it is more than LangGraph offers, and it is why
section 6 records ADR-0008's no-migration rule as a policy choice made cheap rather than as a
physical law. Second, LangGraph has a first-class agent model the durable-execution engines lack, so
substituting one moves the `agent` Step's implementation into Orchestra. The Temporal and Camunda
comparisons are carried in full in [`prior-art-survey.md`](prior-art-survey.md) §§2–3 and are not
repeated here.

## 9. The direct answer

**Does the runtime supply what ADR-0005 and ADR-0008 assume it supplies?** Substantially yes, with
one correction, one addition and one narrowing.

| ADR text | Finding |
| --- | --- |
| ADR-0005: durability, checkpointing, interrupts and resumption *"come free"* | True for state, under MIT, with no commercial dependency — provided Orchestra runs its own checkpointer and its own Run supervisor |
| ADR-0008: *"Orchestra does not build: durability, checkpointing, interrupts, or resumption"* | Three of four hold. Resumption is half: mechanism supplied, supervision not. The Run supervisor is unbudgeted, and its size relative to *"a schema and a compiler"* is not established |
| ADR-0005: LangGraph is the dependency | Incomplete. The library is MIT; the server is ELv2 and, on the default grant, unavailable to ADR-0001's product shape. The dependency is *the library only* |
| ADR-0005: substitution is a compiler change | True of the compile path. Persisted state does not migrate; substitution is a drain |
| ADR-0005: churn mitigated by pinning | Confirmed as a compatibility device, and exercised by the `create_react_agent` deprecation at 1.0. Section 4.1 adds a security-uptake obligation the mitigation does not name |
| ADR-0008: in-flight version pinning, runs never migrated | Confirmed, and made cheap rather than proved inevitable — the constraint is substrate-specific (section 8) |

**ADR-0005's revisit criterion, quoted in full.** It reopens *"if LangGraph's durability guarantees
prove insufficient at target scale, or if a materially better execution substrate emerges."* An
earlier draft of this document quoted only the first limb and declared the criterion untriggered.
Both limbs are tested here, and neither resolves:

- **Insufficient at target scale — not established, in either direction.** No scale ceiling was
  found. Nothing here measures throughput, checkpoint size at depth or contention under concurrency,
  and no such measurement is possible pre-implementation. No evidence was found that the primitives
  are insufficient either.
- **A materially better substrate — not established.** Section 8 found a credible alternative market
  and one axis on which Temporal is materially better: patching for in-flight code change. Against
  that, LangGraph has a first-class agent model the durable-execution engines lack, which is the
  axis ADR-0008's `agent` Step type depends on, and no comparison of ADR-0008's eight Step types
  against any alternative was performed. On this evidence the limb is **not established** rather
  than untriggered. A claim that it is met, or that it is not, needs work nobody has done.

**Five findings argue for ADR work, and this document does none of it.**

1. **The licence boundary.** ADR-0005 does not distinguish the MIT library it depends on from the
   ELv2 server it cannot host under ADR-0001's product shape (sections 3 and 5). **Recorded since:
   [ADR-0016](../adr/adr-0016-compile-to-the-langgraph-library.md), 2026-09-11**, which
   supersedes ADR-0005 on this evaluation's evidence and carries its compilation decision
   forward unchanged.
2. **The Run supervisor.** ADR-0008's negative list is broader than the evidence supports, and the
   supervisor was named and scoped nowhere (section 5). **Recorded since:
   [ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md), 2026-09-11**, which supersedes
   ADR-0008, cites this evaluation as its evidence, and scopes the supervisor in a responsibility
   table. Findings 3 to 5 remain unrecorded.
3. **Compiler rules the evidence implies, none of them recorded.** Durability mode fixed by the
   compiler (§5); the `approval` Step compiled as an interrupt-only node (§6.1); retry policy per
   Side-Effect Class (§6.3); byte-identical node names across recompiles as a golden-test invariant
   (§7).
4. **The Approval Request inbox** as an Orchestra-owned tenant-scoped table (§7).
5. **Security patch uptake** beside ADR-0005's pinning mitigation, and a review of ADR-0011's
   row-level-security design against the store-isolation and filter-key defect classes (§4.1).

ADR-0001 and ADR-0011 are **Accepted** and therefore immutable per [`README.md`](../README.md) §5,
so recording any of the remaining findings means a superseding or a new ADR, and that is a decision
for the repository owner. ADR-0005 and ADR-0008 were Accepted at the investigation date; ADR-0016
superseded the first and ADR-0014 the second, both on 2026-09-11, after this evaluation was carried
out. An evaluation records evidence; it does not decide, and it
does not issue requirements on components no ADR specifies.

## 10. What this does not establish

- **Any scale figure whatsoever.** Checkpoint growth, write amplification under `"sync"`, contention
  at concurrency, the cost of resuming a deep thread, and checkpoint TTL and pruning are all
  unmeasured. This is one of the two axes ADR-0005 reopens on, and it is untested.
- **Whether a materially better execution substrate exists**, the other axis. Section 8 establishes
  that alternatives exist and are broadly production-grade; it does not weigh any of them against
  ADR-0008's Step types, and no such comparison was attempted.
- **Who re-invokes a crashed Run in an open-source deployment.** Not documented; structurally the
  server's job, so Orchestra's supervisor design has no upstream pattern to copy.
- **Whether an interrupted Run survives a node rename in a self-hosted open-source deployment.** The
  only source found is the vendor support article for LangSmith Deployment, the hosted product
  (section 6). The library-level behaviour is inferred from the mechanism, not established.
- **How large the Run supervisor is** relative to ADR-0008's *"schema and a compiler"*. No estimate
  was made; the reduction's overall arithmetic is untested in both directions.
- **Whether a tenant-scoped checkpointer passes the conformance suite** under ADR-0011's row-level
  security. Plausible, untested, and the suite is at 0.0.2.
- **Whether the advisory history of section 4.1 changes the risk assessment.** Patch latency, the
  vendor's median time to fix and whether the store-isolation defect class recurs are all
  unmeasured; the advisories are counted here, not analysed.
- **Whether ADR-0008's eight Step types compile cleanly.** No compiler exists; the mapping in
  section 7 is a reading of an API, not a proof.
- **Whether dynamic fan-out is genuinely needed.** The clearest expressiveness gap, but whether a
  customer requires it is a design-partner question and there are no design partners.
- **Everything downstream of a buyer.** Per CLAUDE.md working rule 8 this is pre-customer and
  pre-implementation. No enterprise reviewer has seen the ELv2 finding, no counsel has read it, and
  no code exercises it.

## 11. Corrections applied

Recorded so the provenance of this document is auditable, in the format
[`a2ui-evaluation.md`](a2ui-evaluation.md) established. An adversarial verification pass over the
research sustained the document's structure and disputed the claims below; every one is corrected in
the text above rather than repeated there. Two changed a conclusion — the deleted sentence about the
scope reduction, and the half-quoted revisit criterion — and the rest narrowed a supporting claim.

| Original claim | Correction |
| --- | --- |
| *"Six questions were put to the evidence, one per section"* | Seven, mapping onto sections 2 through 8 |
| Post-1.0: *"two minor lines and eleven patches"* | Thirty-one patch releases across three lines, thirty-four stable releases; roughly three a month against ten before 1.0. "Eleven" was the patch index of the 1.2 line |
| AG-UI and A2UI have *"no version to pin or a stability guarantee in force"* | True of AG-UI. A2UI designates v0.9.1 as its current production release; what both lack is a stability guarantee, and A2UI's pin is two-dimensional |
| The v1 notes name a *"removal"* of `create_react_agent` | A deprecation. The word *removal* does not appear, and `create_react_agent` still ships — `langgraph` 1.2.11 pins `langgraph-prebuilt` at `>=1.1.0,<1.2.0` |
| Licences read from registry metadata | Re-checked against the LICENSE file shipped in each distribution. `langgraph-api` ships the full ELv2 text; `langgraph-runtime-inmem` ships no LICENSE file, so its licence rests on metadata alone |
| *"Orchestra cannot build on the Agent Server"*, stated absolutely | Bounded to the ELv2 grant as published, with the Enterprise-plan commercial route named, no such arrangement sought, and no legal review claimed |
| Threat-model out-of-scope entry quoted as *"LangGraph Server (closed-source)"* | Reconstructed, not verbatim. Quoted exactly, and the `Auth` handler sentence added because it cuts against the conclusion drawn from it |
| Repository carries *"no `GOVERNANCE.md`, `CONTRIBUTING.md`, `CODEOWNERS` or `CODE_OF_CONDUCT.md`"* | No `GOVERNANCE.md` and no `CODEOWNERS`; `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` are organisation-wide defaults, and that guide requires maintainer approval before any pull request |
| No mention of security history, with the threat model cited as a governance positive | Nine published advisories added as section 4.1, with the consequences for ADR-0011 and for ADR-0005's pinning mitigation, and the threat-model praise qualified |
| *"Open issues / open pull requests: 776 / 246"* | 530 / 246. GitHub's `open_issues_count` of 776 includes pull requests, so the backlog was overstated by 46% |
| The resumption gap *"does not overturn the reduction, since schema and compiler remain the bulk of it"* | Deleted as unsupported and contradicted by sections 3 and 5. The reduction holds for durability, checkpointing and interrupts and does not hold for run supervision; the relative size is not established |
| Five capitalised RFC-2119 requirements binding a compiler no ADR specifies | Downgraded to findings and recommendations and routed to section 9's ADR list. 80-reference is informative per README.md §3 |
| LangSmith support article presented as *"LangChain's own guidance"* about the library | Labelled as scoped to LangSmith Deployment, the hosted product. The library-level half separated from the inferred half, and the inferred half recorded in section 10 |
| ADR-0008's no-migration rule *"confirmed and strengthened … the only implementable policy"* | Narrowed to confirmed and made cheap. Temporal's patching primitive shows the constraint is substrate-specific, not physical |
| *"Traceability is cheap, and ADR-0005 overstates its cost"* | ADR-0005 states a requirement, not a cost estimate. Rewritten against what the ADR actually says |
| `CheckpointMetadata` is *"a closed shape carrying `source`, `step`, `parents` and `run_id` only"* | Five fields, declared `total=False` with an explicit future-expansion comment, and savers are told to preserve unknown keys. What is closed is the writer. The finding narrows to "no saver-portable query is established" |
| `temporalio`, `dbos` and `agent-framework` are *"all marked Production/Stable"* | `temporalio` 1.32.0 publishes no development-status classifier. The MIT half of the claim stands for all three |
| Pydantic AI documents *"five durable execution backends … behind the stable durable execution backend builder"* | Five officially supported plus two external SDK integrations; the builder is the third-party integration seam, not the mechanism behind the five |
| ADR-0005's revisit criterion quoted as one limb and declared untriggered | Quoted in full. The second limb — *"or if a materially better execution substrate emerges"* — is tested against section 8 and recorded as not established |
| Sibling evaluations *"are planned but not yet written"* | All four siblings exist at the same document version and investigation date. Direct cross-references replace the claim |
| *"every such link returned HTTP 200"* | Accurate, but three cited links resolved only through a redirect from a renamed path; all three are updated to their current targets |

## 12. Sources

Every claim above links to its source in place, and every such link returned HTTP 200 on 2026-09-10.
Three were originally cited at paths that reached 200 only through a redirect after a rename — the
Agent Server page, the platform-setup page and the Pydantic AI durable-execution overview — and each
now cites its current target directly, so no link in this document depends on a redirect. A fourth
renamed path, the durable-execution page that now redirects into persistence, is described in
section 2 and not cited.

Three sources are used but not cited in prose: the
[release history](https://github.com/langchain-ai/langgraph/releases) behind the cadence figures,
[`types.py`](https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/types.py)
for the `RetryPolicy` and `CachePolicy` defaults, and the
[persistence overview](https://docs.langchain.com/oss/python/langgraph/persistence).

The sibling evaluations are all written: [`ag-ui-evaluation.md`](ag-ui-evaluation.md),
[`a2ui-evaluation.md`](a2ui-evaluation.md), [`mcp-evaluation.md`](mcp-evaluation.md) and
[`prior-art-survey.md`](prior-art-survey.md), which carries the Camunda, Temporal, CopilotKit and
LangSmith treatments in full. See the [section README](README.md).
