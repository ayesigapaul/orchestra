---
title: Prior Art Survey
doc_id: DOC-095
version: 0.13.0
status: Draft
last_updated: 2026-09-10
owners: [platform-architecture]
depends_on: [ADR-0001, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0011, ADR-0012]
---

# Prior Art Survey

Where Orchestra sits relative to products that already exist. This is not a feature comparison. The
question it exists to answer is the one
[ADR-0003](../adr/adr-0003-governance-layer-positioning.md) rates highest — *a rail provider adds
governance and absorbs the category* — and a survey concluding that Orchestra is comfortably
differentiated would not be doing its job.

Investigation date: **2026-09-10**, against vendor documentation, release pages, registry metadata
and repository files. Every product below shipped a governance-shaped capability inside the
trailing twelve months, several inside the trailing six. These projects move quickly; a finding
true today may not be true when the decision is revisited, so re-take every reading before relying
on it. Orchestra is pre-implementation and pre-customer, so none of this has been tested against a
running system or against a buyer. [ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) and
[ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md) are **Proposed**, and
anything resting on them is marked where it is used. Vocabulary is
[`GLOSSARY.md`](../GLOSSARY.md)'s; a vendor's own vocabulary appears only where that vendor is the
subject. An adversarial verification pass was run over this document's research; section 10 records
what it overturned.

**The answer, up front.** Every row points into the section that carries the evidence.

| Question | Finding on 2026-09-10 | Where |
| --- | --- | --- |
| Is ADR-0003's absorption risk still a forecast? | No. The vendor of the runtime [ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md) compiles onto now sells spend caps, data policy, PII redaction, an agent registry, access control and human-in-the-loop approvals | Section 6 |
| Do the durable differentiators survive? | Audit with exactly one Principal and a Policy basis, and Approval as administered tenant data, are not held by any product surveyed | Sections 8.1, 9 |
| What has become commodity? | BYOK credential custody at the single-tenant layer, per-scope budgets and metering; tool gating at a proxy; outbound reachability, per [`mcp-evaluation.md`](mcp-evaluation.md) section 3 | Sections 7.2, 7.4 |
| Is any decision taken here? | No. This document reports evidence and names the ADRs it bears on. Section 8.2 and section 4 state what a superseding ADR would have to argue; neither argues it | Sections 4, 8.2 |

## 1. The field on 2026-09-10

| Product | Behind it | Licensing | State on 2026-09-10 |
| --- | --- | --- | --- |
| Camunda 8 | Camunda, Berlin | Camunda License 1.0 — source-available, non-production only — for Zeebe, Operate, Tasklist, Identity, Optimize and the out-of-the-box connectors; Apache-2.0 for the Connector SDK and runtimes; Web Modeler and Console proprietary; Desktop Modeler MIT per its [LICENSE](https://github.com/camunda/camunda-modeler/blob/main/LICENSE) | 8.9 minor released 2026-04-14; latest 8.9 patch 8.9.19 on 2026-09-04; the 8.7 and 8.8 lines are still patching (8.7.39, 2026-09-07) and 8.10 has been in alpha since 2026-08-31; 4,275 stars |
| Temporal | Temporal Technologies | Server MIT, per the [repository LICENSE](https://github.com/temporalio/temporal/blob/main/LICENSE) and GitHub's detection; Temporal Cloud proprietary | v1.31.2 on 2026-07-08; 22,966 stars; USD 300M Series D at a USD 5B valuation, 2026-02-17 |
| CopilotKit and AG-UI | Tawkit Inc., trading as CopilotKit | AG-UI packages declare MIT; CopilotKit's own licensing is contradictory across its LICENSE files, registry entries and documentation, and an Ed25519 licence verifier is a hard dependency, per [`ag-ui-evaluation.md`](ag-ui-evaluation.md); paid self-hosting | See [`ag-ui-evaluation.md`](ag-ui-evaluation.md); USD 27M Series A announced 2026-05-05 |
| LangSmith | LangChain, Inc. | Platform proprietary; the server packages `langgraph-api` 0.14.0 and `langgraph-runtime-inmem` 0.34.0 declare **Elastic-2.0**, which forbids providing the software as a hosted service — see [`langgraph-evaluation.md`](langgraph-evaluation.md) section 3; client SDKs MIT (`langsmith` 0.10.2 npm, 0.12.4 PyPI) | LLM Gateway in beta; self-hosted stable line at v0.16.0; USD 125M Series B at USD 1.25B, 2025-10-20 |
| Bedrock AgentCore | AWS | Managed service, proprietary; the Dogwood policy language Apache-2.0 | Policy generally available 2026-03-03; temporal policies and gateway rate limiting 2026-08-06 |
| Entra Agent ID and Agent 365 | Microsoft | Proprietary; Agent 365 licence required per user, and required again for governance — section 7.1 | "Agent ID is available for all Microsoft Entra customers"; parts of the surrounding surface are still preview; documentation last revised 2026-08-13 |
| Gemini Enterprise Agent Platform | Google | Proprietary managed service | Announced 2026-04-22 as "the evolution of Vertex AI", with all Vertex AI services and roadmap to be delivered exclusively through it |
| agentgateway | Donated by Solo.io; Linux Foundation, and since joined the Agentic AI Foundation as its fourth hosted project | Apache-2.0, per GitHub's detection on the [repository](https://github.com/agentgateway/agentgateway) | v1.5.0 on 2026-08-27; 4,797 stars |
| ServiceNow AI Control Tower | ServiceNow | Proprietary, on the Now Platform | June 2026 release |
| LiteLLM | BerriAI | Core MIT (`litellm` 1.100.1, 2026-09-10); the repository resolves to `NOASSERTION` because an enterprise directory carries different terms | 58,456 stars; the enterprise tier adds organisation scoping and multi-tenancy as well as SSO, RBAC and audit logs — section 7.4 |

The Elastic-2.0 row matters beyond licensing hygiene.
[ADR-0001](../adr/adr-0001-product-shape-multi-tenant-saas.md) fixes Orchestra as multi-tenant SaaS,
and providing a hosted service over Elastic-2.0 software is the one thing that licence forbids, so
the commercial server layer of the runtime ADR-0005 compiles onto is both the competitor measured in
section 6 and a component Orchestra cannot host. That sharpens the absorption finding rather than
softening it.

## 2. Camunda

Camunda is a BPMN and DMN process orchestration platform, based in Berlin, funded to a USD 100M
Series B led by Insight Partners in March 2021 and past USD 100M ARR by
[September 2024](https://camunda.com/blog/2024/09/camunda-crosses-100m-arr-threshold/). The
commercial fact most easily got wrong is that its engine and shipped connectors are
**source-available, not open source**. The
[licence reference](https://docs.camunda.io/docs/reference/licenses/) requires a purchased
Enterprise Edition for production use of Zeebe, Operate, Tasklist, Identity, Optimize and the
out-of-the-box connectors; the Camunda License 1.0 grants use "only and limited to …
Non-Production Environment".

**[ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md) says Camunda offers "determinism
with AI attached at the edges". That was not accurate when the ADR was accepted on 2026-09-08.** The
capability shipped at 8.8 on 2025-10-14, eleven months earlier; the claim was not overtaken by
events, it was written from memory and never checked.
The agent is inside the process model, not beside it:

| Capability | Shipped | Evidence |
| --- | --- | --- |
| Ad-hoc sub-processes: "If the LLM determines that a tool call is needed, Camunda activates the corresponding BPMN activity in the ad-hoc sub-process" | 8.8, 2025-10-14 | [AI agents](https://docs.camunda.io/docs/components/agentic-orchestration/ai-agents/); [8.8 release notes](https://docs.camunda.io/docs/next/reference/announcements-release-notes/880/880-release-notes/) |
| AI Agent connector, against "Anthropic, Amazon Bedrock, Google Gemini, and OpenAI" — shipped at 8.8 carrying no maturity qualifier | 8.8, 2025-10-14 | [AI agents](https://docs.camunda.io/docs/components/agentic-orchestration/ai-agents/) |
| MCP Client connector, so agents call tools on MCP servers rather than hardwired connectors — "released as an early access alpha feature" | Alpha at 8.8 | 8.8 release notes |
| Orchestration Cluster MCP Server, exposing Camunda itself as tools to third-party agents | 8.9, 2026-04-14 | [8.9 announcement](https://camunda.com/blog/2026/04/camunda-8-9-fastest-path-to-agentic-orchestration/) |
| Three agent-to-agent connectors for cross-domain multi-agent coordination | 8.9 | 8.9 announcement |
| Global user task listeners: "Enforcing governance rules and validations; Centralizing SLAs and notifications across all processes" | 8.9 | 8.9 announcement |
| "A centralized audit log, available on demand, that captures all critical user and client operations across process, identity, and user task domains", motivated by the need for "a clear, tamper-proof record of who did what, when, and why" | 8.9 | 8.9 announcement |

The scope qualifier on that last row is load-bearing and works in Orchestra's favour: it records
operations performed by users and clients, which is the same control-plane shape section 3 finds in
Temporal, not a record of a governed act bound to a Policy basis.

Camunda's own design guidance, cited in section 11, draws the same line Orchestra's product thesis
draws. The LLM "chooses which tool to call, in what order, and with which parameters"; Camunda
"executes the selected BPMN elements, stores process state, applies retries and incident handling,
and coordinates user tasks". It prescribes a "guardrail sandwich", a deterministic escalation path
to a human, and prompt versioning — that is deterministic where determinism matters and agentic
where judgment matters, expressed as design guidance rather than as an administered policy system,
but expressed.

Two things Camunda does not do, and both are narrow. Its
[multi-tenancy](https://docs.camunda.io/docs/components/concepts/multi-tenancy/) appends a tenant
identifier to each data object in a shared database — the shape
[ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md) chose — on both SaaS and
Self-Managed, but "by default, multi-tenancy checks are disabled", the opposite default from the one
CLAUDE.md working rule 7 requires. And its governance vocabulary is process-shaped: no Policy
Decision as a first-class record, no Approval Chain as tenant configuration data, no Evidence Set.
That gap is real, and it is the kind an established enterprise product closes in a release.

## 3. Temporal

Temporal is durable execution: workflows as code, with state, retries and resumption guaranteed
across process and infrastructure failure. The server is MIT, at
[v1.31.2](https://github.com/temporalio/temporal/releases) on 2026-07-08; Temporal Cloud is the
commercial product. Its USD 300M Series D at a USD 5B valuation on 2026-02-17 was positioned
explicitly on agentic AI and names OpenAI as a production customer.

Its agentic move is integration, not governance. The
[AI documentation](https://docs.temporal.io/ai) lists first-class integrations with the OpenAI
Agents SDK, generally available 2026-03-23, plus LangGraph, Google ADK, the Vercel AI SDK, Pydantic
AI, Mastra, Spring AI and Strands, and an "Approval pattern": "Human-in-the-loop Workflows that
block until external approval decisions are made. Uses Signals to capture approval data with
metadata."

**That is an approval primitive, not an Approval Request.** It is a library pattern written into
workflow code, not tenant-scoped configuration an administrator changes without a deploy. The
distinction ADR-0003 draws, "policy and approval as an administered system rather than a code-level
interrupt", survives contact with Temporal precisely.

The sharper finding is in audit.
[Temporal Cloud audit logging](https://docs.temporal.io/cloud/audit-logging) covers control-plane
operations only, and says so: "Audit Logs do NOT capture data plane events, like Workflow Start,
Workflow Terminate, Schedule Create, etc." Workflow history is a separate bulk export to customer
storage. Under the test [`observability.md`](../60-operations/observability.md) section 2 applies, a
Temporal audit log answers who changed the account, not who approved which action on what basis
under which Policy — and [temporal.io/solutions/ai](https://temporal.io/solutions/ai) claims
reliability, scale and observability, with no policy, approval-as-a-system or audit claim.

## 4. What sections 2, 3 and 6 do to ADR-0008

ADR-0008 rests on a two-sided claim: "Camunda offers determinism with AI attached at the edges;
LangGraph offers agency with no governance." Both halves are tested here. The agent-runtime half is
not delegated to [`langgraph-evaluation.md`](langgraph-evaluation.md), which tests durability,
licence, interrupts, the compilation boundary and substitution but never asks whether the runtime or
its vendor supplies governance; the evidence for it is section 6 of this document. Temporal, the
other incumbent ADR-0008 names, evidences the determinism-without-governance side alongside Camunda
rather than the agency side — section 3.

| ADR-0008 claim | Evidence on 2026-09-10 |
| --- | --- |
| Camunda has AI "attached at the edges" | **No longer accurate as a description of Camunda's documented capability set.** The agent selects tools inside an ad-hoc sub-process, calls MCP servers, and coordinates with other agents over A2A connectors; 8.9 adds a centralised audit log over user and client operations and cluster-wide user-task governance. Section 9's caveat applies: this is vendor documentation, not exercised capability |
| "LangGraph offers agency with no governance" | **Holds of the MIT library; fails of the vendor.** LangGraph itself ships no policy, approval or audit surface, but LangChain, Inc. now sells spend caps, data policies, PII redaction, an agent registry with versioning and rollbacks, custom auth and access control, and human-in-the-loop approvals on top of it — section 6 |
| A mediocre workflow engine loses on both fronts | **Unchallenged, and strengthened.** Nothing found suggests building one has become cheaper |
| "Camunda and Temporal have fifteen-year leads" | **Overstated for both incumbents on the primary evidence available.** Camunda's founder wrote on 2024-09-26 that "about ten years ago, I pitched Camunda"; `camunda-modeler`'s LICENSE reads "Copyright (c) 2015-present Camunda Services GmbH". Temporal's own [about page](https://temporal.io/about) dates the lineage to Cadence: "In 2015, they reunited at Uber to co-create Cadence." Neither company's founding year was established from a primary source in this pass. The phrase is rhetorical rather than load-bearing |
| Option 4, embedding a third-party engine, is worse than compiling onto the existing runtime | **Unchanged as an engineering argument.** A second execution engine is still a second state store and a second failure domain |

The **decision** — option 3, declarative definitions compiled onto the existing runtime — is not
contradicted here, because Camunda's move does not make building a workflow engine cheaper. The
**rationale sentence** is the exposed part, and Accepted ADRs are immutable, so any correction is a
superseding ADR's to make and not this document's. A superseding ADR to ADR-0008 would have to
argue, on this evidence: that the differentiation sentence be rewritten against both incumbents, not
only Camunda, since the LangGraph half now fails of the vendor even where it holds of the library;
that the "fifteen-year leads" figure be dropped or replaced with a sourced one; and that the
revisit criterion be re-worded. On that last point, ADR-0008 reopens "if customers consistently
require orchestration primitives — long timers, complex event correlation, high-volume non-agentic
throughput", which is a condition about customer demand. That condition is unchanged and, per
section 9, untestable pre-customer. What has changed is the cost basis on which option 4 was
rejected: a third-party engine now speaks MCP in both directions and can be reached as a Tool rather
than embedded as a runtime. The criterion is not nearer to firing; its wording no longer matches the
cost it was chosen to track.

## 5. CopilotKit

[`ag-ui-evaluation.md`](ag-ui-evaluation.md) settled the bindings question on 2026-09-09 and it is
not reopened here; what matters for positioning is the ownership structure underneath it. CopilotKit
governs the event protocol from which
[ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) — **Proposed** — derives an
Orchestra-versioned profile, and sells a commercial product on the same protocol. Its
[pricing](https://www.copilotkit.ai/pricing) now describes a platform rather than a component
library: hosted threads with retention tiers, Slack and Teams channels, credits, self-hosting from
the Team tier, and an Enterprise tier with VPC or on-premises deployment. The
[Series A](https://www.copilotkit.ai/blog/series-a) of 2026-05-05 raised USD 27M and, per the
TechCrunch coverage in section 11, launched an enterprise product for agentic applications.

**The strategic exposure has two edges.** The vendor is expanding upward into the layer an Orchestra
front end would occupy, so this is not simply a protocol consumer's relationship to a protocol
author. And the protocol's governance did not move when it had an obvious opportunity to: the Linux
Foundation formed the **Agentic AI Foundation** on 2025-12-09, with MCP, goose and AGENTS.md as its
three founding projects. MCP went to a neutral foundation; AG-UI did not, and no statement of intent
either way was found. The AAIF release also names Amazon Web Services, Anthropic, Block, Bloomberg,
Cloudflare, Google, Microsoft and OpenAI as platinum members — evidence about who funds the
foundation, not about who controls any specification inside it, and used here only for the former.

This **confirms** rather than changes ADR-0004's reasoning. The profile is the containment, and it
is load-bearing: a governance layer promising enterprises a stable contract cannot inherit that
stability from a `0.0.x` specification owned by a company selling a competing product surface. It
also supplies a clean acceptance signal for the ADR's revisit — an AG-UI donation to the AAIF, on
the MCP precedent, would materially change the governance assessment.

## 6. LangSmith

LangSmith is LangChain, Inc.'s proprietary observability and evaluation platform for agent systems:
tracing, evaluations, prompt and dataset management, with MIT client SDKs and an Enterprise tier
that, per the [pricing page](https://www.langchain.com/pricing-langsmith), is the only one offering
"self-hosted and hybrid deployment options" and "custom SSO, ABAC, and RBAC". LangChain raised
[USD 125M at a USD 1.25B valuation](https://www.langchain.com/blog/series-b) on 2025-10-20.

**Overlap with [`observability.md`](../60-operations/observability.md).** LangSmith occupies the
telemetry half of that document's section 2 boundary and occupies it well: traces across an agent
run, latency and token accounting, evaluation scores. Orchestra would not out-build it there and
does not try to, since observability.md puts instrumentation libraries, storage engines and
dashboard products out of scope. The divergence is structural, not competitive: that document
forbids reconstructing audit from traces, forbids sampling an audited act, and calls any fact
without a Principal and a Policy basis telemetry. LangSmith now holds an administrative audit log
over control-plane actions — the LLM Gateway ships "Audit logging for every administrative action" —
alongside policy events routed into the trace store. What it has no class for is a record binding a
governed act to exactly one Principal and a versioned Policy basis. The differentiation survives;
the categorical claim that everything LangSmith holds is a trace does not.

**And it is moving.** At Interrupt on 2026-05-14, LangChain shipped, among other things:

| Announcement | What it does |
| --- | --- |
| LangSmith LLM Gateway | "A new runtime governance layer that sits between your agents and the LLM providers they call": "hard spend caps and real-time cost rollups at the organization, workspace, user, and API key level, returning a 402 when hit", "PII and secrets detection that redacts sensitive data from requests and responses before it reaches the model or trace", and "Audit logging for every administrative action, with no separate pipeline to stand up". The [gateway documentation](https://docs.langchain.com/langsmith/llm-gateway) adds rate limits and data policies to the same surface |
| Context Hub | "A central place to manage the files that shape agent behavior, including `AGENTS.md` files, skills, policies, examples, and other context bundles agents read and follow", with three listed features: versioning, environment tags, and comments for collaboration |

**LangSmith Deployment is the older and stronger signal, and it was not announced at Interrupt.**
The [product page](https://www.langchain.com/langsmith/deployment) states that "LangGraph Platform
has been renamed to LangSmith Deployment as of October 2025", and describes it as managing "agents
through a centralized registry with versioning, instant rollbacks, and native A2A, MCP, and Agent
Protocol support", running "human-in-the-loop approvals, background tasks, and multi-agent
coordination on a durable runtime", with custom auth and access control among its core capabilities.
That is a registry, versioning, access control and an approval surface sold as the commercial
control plane over the exact runtime
[ADR-0005](../adr/adr-0005-langgraph-as-compilation-target.md) compiles onto — and, per section 1,
the layer Elastic-2.0 forbids Orchestra from hosting.

The [LLM Gateway documentation](https://docs.langchain.com/langsmith/llm-gateway) confirms the
credential shape that matters to [ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md):
"an administrator stores the provider key in workspace Provider Secrets", alongside a
LangChain-owned-credential alternative. That is BYOK custody plus per-scope spend enforcement, two
items ADR-0003's context section lists under *differentiated*, sold by the vendor whose runtime
ADR-0005 compiles onto. It is beta, and "LLM Gateway is not included in the LangSmith v0.16.0
self-hosted stable release."

**This is ADR-0003's absorption risk in its exact predicted shape**, and it is the finding in this
survey that most deserves a decision. One qualification keeps it from being fatal on its own.
LangChain is unifying policy enforcement with tracing — the gateway's selling point is audit logging
"with no separate pipeline to stand up" — which is the audit-and-telemetry blur observability.md
section 2 forbids and
[ADR-0012](../adr/adr-0012-policy-decisions-are-audit-records.md) rules out for Orchestra: a policy
event in a sampled, expiring store cannot evidence the control it describes. That is a genuine and
defensible difference, and it is one only an auditor will notice, which makes it a poor thing to
lead a sale with.

## 7. The field beyond the four named products

Sections 2 to 6 cover Camunda, Temporal, CopilotKit and LangSmith. They are not the whole field, and
the rest of it is the more serious part.

### 7.1 The hyperscalers have all shipped the control surface

| Vendor | What shipped | Why it bites |
| --- | --- | --- |
| AWS | AgentCore Policy generally available 2026-03-03: natural language compiled to Cedar, attached to an AgentCore Gateway that "intercepts agent-tool traffic and evaluates each request". On 2026-08-06, temporal policies via **Dogwood**, an Apache-2.0 policy language for agents built on Cedar, adding rate limits, time windows, prerequisite steps and escalation triggers, plus gateway rate limiting per user across tools, models and agents | A Policy Enforcement Point at the tool boundary, with Identity and a managed consent portal beside it. The blog states CLAUDE.md rule 5's design principle in almost its words: "the agent does not see the policy logic and cannot reason around it" |
| Microsoft | Entra Agent ID: agent identities and blueprints, Conditional Access, Identity Protection, identity governance with access packages and sponsor lifecycle, sign-in and audit logs. The platform itself is broadly available — "Agent ID is available for all Microsoft Entra customers" — but "Extending Microsoft Entra security features to agents requires Microsoft Agent 365", and governance requires "Microsoft 365 E7 … [or a] Microsoft Agent 365 license paired with at least Microsoft Entra P1 or Microsoft 365 E3". Adjacent capability is still preview, including "Automatically create Entra agent identities for Copilot Studio agents (preview)" | Explicitly cross-platform. It "works with agents built on Microsoft and non-Microsoft platforms", integrating "third-party agents from platforms such as AWS Bedrock and n8n … giving every agent a governed identity regardless of where it was built" |
| Google | Gemini Enterprise Agent Platform, announced 2026-04-22, with Agent Identity ("a unique cryptographic ID … a clear, auditable trail for every action an agent takes, mapped back to defined authorization policies"), an Agent Registry that "indexes every internal agent, tool, and skill … ensuring only governed, approved assets are available to your users", and an Agent Gateway "enforcing consistent security policies and Model Armor protections" | Registry, identity, policy enforcement point, audit trail and observability, assembled and sold as one control plane |

The mitigation ADR-0003 names for this exact risk is "compete on cross-runtime, cross-provider
neutrality and enterprise depth". Microsoft's agent identity governance is cross-provider by design,
which does not make the mitigation wrong but makes it thinner than it reads. What it is *not* is
free to the incumbent's existing customer: the security and governance features are gated behind a
paid Microsoft Agent 365 licence, bundled only in Microsoft 365 E7 and otherwise an add-on. The
incumbent advantage is a procurement discount and an existing vendor relationship, not a licence the
buyer already holds. ADR-0003 was accepted on 2026-09-08, rates this risk **Medium** likelihood, and
cites no evidence either way. The evidence above was available then.

### 7.2 agentgateway, the vendor tunnels, and the Agentic AI Foundation

[agentgateway](https://github.com/agentgateway/agentgateway) is an Apache-2.0 Rust proxy for
agent-to-LLM, agent-to-tool and agent-to-agent traffic, donated by Solo.io to the Linux Foundation
on 2025-08-25 and since joined to the Agentic AI Foundation — per the
[project's own announcement](https://agentgateway.dev/blog/2026-06-04-agentgateway-joins-aaif/),
"the fourth hosted initiative under the Linux Foundation", where "AAIF provides neutral governance
for agentic AI standards, protocols, and open source initiatives". v1.5.0 on 2026-08-27, 4,797
stars, named contributions from AWS, Cisco, Huawei, IBM, Microsoft, Red Hat, Shell and Zayo, and
MCP-server role-based access control, authorization, rate limits, traffic policy and OpenTelemetry.

This is uncomfortable, because it is neutral, free and foundation-governed. It commoditises part of
what [ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md), which is
**Proposed**, and [`tool-authorization.md`](../40-governance/tool-authorization.md) claim. What it
does not answer is the SaaS-to-private-network direction: it runs in the customer's own network,
between components the customer already operates.

**But something else does answer it, and this survey's first pass had the wrong contestant.**
[`mcp-evaluation.md`](mcp-evaluation.md) section 3 establishes that a multi-tenant control plane
reaching Tools behind a customer firewall without inbound ports is already solved and shipped by two
model vendors. OpenAI Secure MCP Tunnel runs a `tunnel-client` inside the customer network which
opens outbound HTTPS, long-polls for queued work and posts responses back — "The private MCP server
does not need a public listener." Anthropic MCP tunnels run `cloudflared` outbound from the customer
network into a proxy that terminates an inner TLS session under a customer-held certificate;
Anthropic's is a **research preview**, "as-is". Applying ADR-0003's own test — commodity is anything
"improving without us" — the transport is now commodity. What is not is the governance carried on
it: the enforcement point, the capability grant, the connector's own allow-list, and the
governance-visible refusal fixed by `tool-authorization.md` TA15–TA18. ADR-0007 is **Proposed**, so
its validation step is the place this belongs: it should say which half of the connector the ADR
claims as differentiated, and why an outbound Connector is not a vendor tunnel with another logo.

### 7.3 ServiceNow AI Control Tower

The closest thing found to Orchestra's stated positioning, from a vendor already inside the
enterprise. The evidence here is a ServiceNow-hosted community article, cited in section 11, because
the product documentation portal renders client-side and could not be read. It describes "the
ServiceNow control plane for discovering, governing, securing, observing, and measuring AI across
the enterprise", covering third-party AI as well as its own. Its June 2026 release tracks MCP
servers as a governed asset type alongside models, agents, datasets and prompts, and requires AI
Steward approval before one can be used: "Unapproved servers are not visible to agent builders — the
control is enforced in the tooling, not just documented in policy." It also governs BYOK model
providers, embeds risk assessment in asset intake, screens outputs for PII, and ships compliance
content packs for the EU, California and Colorado AI Acts.

Catalog, approval, tenant-scoped administration, BYOK governance, audit and compliance mapping, sold
to the same buyer, on a platform that already holds the enterprise's change processes. The distance
from Orchestra is that this governs agents built elsewhere rather than being where agents run.

### 7.4 The AI gateway is a commodity at the single-tenant layer, and a paid product above it

[LiteLLM](https://docs.litellm.ai/docs/enterprise) is MIT at its core (`litellm` 1.100.1 on PyPI,
2026-09-10) and has 58,456 stars. Its own enterprise page draws the line: "LiteLLM OSS already
covers the fundamentals: an OpenAI-compatible gateway, virtual keys, spend tracking, budgets,
fallbacks, and request/response logging." Everything above that is licensed. The
OSS-versus-Enterprise table puts "Organizations, org/team admins, delegated admin roles" and
"SSO + SCIM, OIDC/JWT" in the Enterprise column, and the Core Enterprise Features list carries
"Multi-tenant Architecture" (Organizations → Teams → Projects → Keys), "Tag-based Budgets",
"Model-specific Budgets per Virtual Key", "Key Rotations", "Audit Logs with retention policies",
role-based access control, and the secret-manager integrations — AWS KMS, AWS Secrets Manager,
Azure Key Vault, Google KMS, Google Secret Manager, HashiCorp Vault and CyberArk. The repository
resolves to `NOASSERTION` on GitHub because that enterprise directory carries different terms.

The bearing on [ADR-0006](../adr/adr-0006-model-layer-as-credential-broker.md) and
[ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) is direct but narrower than a first reading
suggests. Per-key and per-team budgets, spend tracking and request logging against a customer's own
provider keys are free and self-hostable today. Organisation scoping, multi-tenancy, tag- and
model-scoped budgets, key rotation and secret-manager custody — the shape a multi-tenant Control
Plane actually needs — are themselves a paid product inside the commodity gateway. ADR-0006's
decision, that under BYOK the model layer can only be a credential and endpoint broker, is
*confirmed*; weakened is any claim that the broker itself differentiates anything. A Quota Envelope
differentiates only where it is joined to Policy, Approval and the audit trail, and ADR-0003's
context section, which lists BYOK custody and quota-aware scheduling as differentiated, is due a
re-read on that basis by whoever owns it.

## 8. Honest assessment

### 8.1 What looks durable, and what looks contestable

| Claim in Orchestra's differentiation | Standing on today's evidence |
| --- | --- |
| Audit as a product surface, with exactly one Principal and a Policy basis on every governed act | **Durable.** No surveyed product has this class. Temporal's audit is control-plane only; LangSmith's is an administrative log plus traces; Camunda's new log covers user and client operations across process, identity and user-task domains; ServiceNow's is closest and is asset- and workflow-shaped. Thin ice to build a category on, but real ice |
| Approval as administered, tenant-scoped configuration — chains, delegation, escalation, Evidence Set | **Durable.** Temporal offers a code pattern, Camunda a model element with cluster-wide listeners, LangSmith Deployment a runtime feature, ServiceNow a steward review over assets. None is Approval as tenant data over a Run |
| Compilation of a declarative Workflow into enforcement points that cannot be written around | **Durable.** Camunda's guardrails are guidance a modeller may skip; ADR-0008's compiler emits a Policy Enforcement Point at every step boundary structurally |
| Cross-runtime, cross-provider neutrality | **Durable only for buyers whose estate genuinely spans clouds and runtimes.** Microsoft contests even that from the identity layer, cross-platform by design — though at the price of an Agent 365 licence, section 7.1 |
| BYOK credential custody, per-tenant budgets and metering | **Contestable at the single-tenant layer.** The multi-tenant, per-organisation shape Orchestra needs is itself a paid product inside the commodity gateway: sections 6 and 7.4 |
| Tool authorization and the Tool Catalog | **Contestable.** AgentCore Policy, agentgateway and ServiceNow all gate tool access at a proxy, the last requiring approval before a server is usable at all |
| Enterprise tool reachability | **Contestable, and against a stronger contestant than an in-cluster proxy.** OpenAI and Anthropic both ship outbound-only SaaS-to-private-network MCP tunnels — [`mcp-evaluation.md`](mcp-evaluation.md) section 3. The transport is commodity by ADR-0003's own test; only the governance carried on it is not. Rests on **Proposed** ADR-0007 |
| Policy the model cannot argue past, as the answer to prompt injection | **Contestable.** ADR-0003's strongest rhetorical asset is now AWS copy in almost the same words |
| Deterministic where determinism matters, agentic where judgment matters, governed at every step | **Contestable.** Camunda 8.9 sells this shape — section 2 |

### 8.2 What would have to be true for ADR-0003's positioning to fail

1. **Buyers standardise on one cloud's agent platform.** If the estate lives in one hyperscaler and
   identity is already Entra, neutrality is worth nothing and the incumbent's governance arrives at
   an add-on price from a vendor the buyer already transacts with.
2. **Governance primitives keep landing in the rails as open source.** Dogwood is Apache-2.0,
   agentgateway is Apache-2.0 under a foundation, LiteLLM's core is MIT. Each release moves a line
   item from ADR-0003's *differentiated* column to its *commodity* column: the failure mode is that
   migration, observable release by release rather than at one moment.
3. **A GRC incumbent reaches down into runtime enforcement faster than a startup reaches up into
   GRC.** ServiceNow already enforces MCP server approval in the tooling.
4. **The audit distinction turns out not to be a purchase driver.** ADR-0003's revisit criterion is
   design partners reporting that governance is satisfied by existing controls, and they now have
   credible controls to point at — less true when the ADR was accepted two days before this survey.

**None of that is a decision, and this document takes none.** ADR-0003 is Accepted and immutable;
correcting it is a superseding ADR's work and the repository owner's call. ADR-0008 was Accepted at
the investigation date and has since been superseded by
[ADR-0014](../adr/adr-0014-run-supervisor-is-orchestras.md), which corrects its build boundary but
not the rationale this survey challenges. What this
survey reports is that the evidence bears on both. For ADR-0003, a superseding ADR would have to
argue a re-sorted context — which of "reaching tools behind an enterprise firewall", "custodying
BYOK credentials across tenants" and "quota-aware scheduling" still belong in the *differentiated*
column given sections 6, 7.1, 7.2 and 7.4 — a re-rating of the "a rail provider adds governance and
absorbs the category" risk row now that the predicted shape has shipped, a mitigation that survives
Entra Agent ID being cross-platform by design, and an explicit statement of whether Orchestra claims
the tunnel itself or only the governance carried on it. For ADR-0008, section 4 states what it would
have to argue. Neither argument is made here.

## 9. What this does not establish

- **Depth behind any vendor claim.** Every capability above is read from documentation, release
  notes or a vendor blog. None was exercised; a generally-available label is not a working feature.
  This caveat governs section 2's verdict as much as any other.
- **The founding year of either incumbent**, from a primary source. Two datable signals bound
  Camunda — a founder's "about ten years ago" written in September 2024, and a 2015 modeller
  copyright — and Temporal's own about page dates the Cadence lineage to 2015, but neither company's
  incorporation year was read from a primary source in this pass.
- **Whether any of these products can express an Approval Chain with delegation and escalation as
  tenant data.** Suspected not, for all of them; tested for none.
- **The dedicated AI-governance vendor category** — Credo AI, Holistic AI, Trustible and similar.
  Search returned overwhelmingly secondary and promotional material, no primary claim was verified,
  and nothing is asserted here. It is the segment most likely to hold a direct competitor, and the
  largest gap in this survey.
- **Anything downstream of a buyer.** Per CLAUDE.md working rule 8 this is pre-customer. No design
  partner has been asked whether they would buy a neutral governance layer over a free one bundled
  with the cloud they already use, and that is the question this whole document circles. It is also
  why ADR-0008's demand-triggered revisit criterion cannot be tested today.

## 10. Corrections applied

Recorded so the provenance of this document is auditable, on the model of
[`a2ui-evaluation.md`](a2ui-evaluation.md). An adversarial verification pass over the research
disputed the claims below; all are corrected in the text above rather than repeated.

| Original claim | Correction |
| --- | --- |
| Camunda's "latest tag 8.9.19 on 2026-09-04" | 8.9.19 is the latest patch on the 8.9 line. The repository's newest release on this reading is 8.7.39 (2026-09-07); 8.8.37 shipped 2026-08-31 and 8.10 has been in prerelease since 2026-08-31 |
| "AI Agent connector, generally available" | Neither cited source uses the phrase. The connector shipped at 8.8 with no maturity qualifier; only the MCP Client connector carries one, "released as an early access alpha feature" |
| Camunda 8.9's audit log, "over process, identity and user-task operations" | Dropped the scope qualifier that matters most: "all critical user and client operations", "available on demand". Restoring it strengthens the audit verdict rather than weakening it |
| Camunda's AI positioning "Falsified" | Downgraded to "no longer accurate as a description of Camunda's documented capability set". Section 9 concedes that vendor documentation establishes nothing about depth, so "falsified" overstates what the evidence carries |
| "That is no longer true", implying the world moved after ADR-0008 was accepted | The capability shipped at 8.8 on 2025-10-14, eleven months before the ADR's 2026-09-08 acceptance. The claim was wrong when written, not overtaken — the same standard already applied to ADR-0003 |
| "Camunda and Temporal have 'a fifteen-year lead'" | ADR-0008 reads "Camunda and Temporal have fifteen-year leads". Quoted exactly |
| "No primary source in this pass gave Camunda's founding year"; Temporal asserted as "a 2019-era company on Cadence-at-Uber lineage" with no citation | Two datable primary signals for Camunda are now recorded, and Temporal's lineage is sourced to its own about page ("In 2015, they reunited at Uber to co-create Cadence"). Temporal's founding year is now listed in section 9 as not established, alongside Camunda's |
| The LangGraph half of ADR-0008's claim delegated to `langgraph-evaluation.md` | That document never assesses it. The claim is answered here from section 6, and the row added to section 4's table. Temporal was also miscategorised as evidence for the agency half; it evidences the determinism-without-governance side |
| "LangSmith has no such class — everything it holds is a trace or an evaluation" | Falsified by this document's own cited source: the LLM Gateway ships "Audit logging for every administrative action". Restated as the distinction already drawn against Temporal — no record binding a governed act to one Principal and a versioned Policy basis |
| "no separate dashboards or audit pipelines to stand up" | Misquote. The post reads "Audit logging for every administrative action, with no separate pipeline to stand up" |
| LangSmith Deployment listed among the Interrupt 2026-05-14 announcements | It is not announced there. Its product page states "LangGraph Platform has been renamed to LangSmith Deployment as of October 2025" — an older and stronger absorption signal, moved out of the table and cited to the product page |
| Context Hub described as "role-based workflow" | The post lists versioning, tags and comments. "Role-based" appears nowhere; it is a collaboration feature, not an access control |
| LangSmith licensing given as "Platform proprietary; client SDKs MIT" | Omitted the Elastic-2.0 server packages established by `langgraph-evaluation.md` section 3, and with them the ADR-0001 consequence that Orchestra cannot host that layer |
| CopilotKit and AG-UI licensing given flatly as "Packages MIT" | Narrowed to what `ag-ui-evaluation.md` establishes: AG-UI packages declare MIT, while CopilotKit's own licensing is contradictory across LICENSE files, registry entries and documentation |
| LiteLLM's enterprise tier described as adding "SSO, RBAC and audit logs" to a free core that ships per-organisation budgets and model access control | Mis-draws the paywall. Organisation scoping, multi-tenancy, tag- and model-scoped budgets, key rotation and secret-manager custody are all licensed. Section 8.1's verdict softened accordingly |
| "Entra Agent ID, generally available" | The cited page never uses the term; it says "Agent ID is available for all Microsoft Entra customers", and adjacent capability is still preview |
| "The buyer already owns the licence" / "arrives with a licence the buyer already holds" | Contradicted by the cited Learn pages. Security and governance features require a paid Microsoft Agent 365 licence, bundled only in Microsoft 365 E7 and otherwise an add-on. The advantage is procurement, not entitlement |
| "Purview eDiscovery places agent interactions under legal hold" | Supported by neither Learn page cited for the row. Clause deleted rather than re-sourced |
| Gemini Enterprise Agent Platform "as the successor to Vertex AI" | Google writes "the evolution of Vertex AI", and separately that "all Vertex AI services and roadmap evolutions will be delivered exclusively through the Agent Platform". Google's own phrasing is both accurate and stronger |
| agentgateway "now an Agentic AI Foundation project", uncited | The 2025-08-25 Linux Foundation release predates AAIF and the 2025-12-09 formation release never mentions agentgateway. The project's own announcement is now cited |
| AAIF platinum membership used as evidence about protocol governance | Platinum membership is evidence about who funds the foundation, not about who controls a specification inside it, and is used only for the former |
| "A multi-tenant Control Plane reaching Tools behind a customer firewall without inbound ports is a different problem"; reachability rated against "an in-cluster proxy" | Contradicted by `mcp-evaluation.md` section 3, which is right: OpenAI and Anthropic both ship outbound-only tunnels solving exactly that problem. Section 7.2 and section 8.1 now rate the row against the vendor tunnels |
| ADR-0008's revisit criterion "closer than the ADR assumed" | The criterion is demand-triggered ("if customers consistently require orchestration primitives"), not cost-triggered, and is untestable pre-customer. What fell is the integration cost basis on which option 4 was rejected |

## 11. Sources with paths too long for prose

All returned HTTP 200 on 2026-09-10, as did every link above.

| Evidence | Source |
| --- | --- |
| Camunda agentic design guidance, determinism split, guardrails | [Design and architecture](https://docs.camunda.io/docs/components/agentic-orchestration/ao-design/) |
| Camunda Series B, USD 100M led by Insight Partners, March 2021 | [Camunda press release](https://camunda.com/press_release/camunda-closes-100-million-series-b-funding-round/) |
| Camunda release lines and patch dates behind section 1; Desktop Modeler's MIT LICENSE and its 2015 copyright | [camunda releases](https://github.com/camunda/camunda/releases), [camunda-modeler LICENSE](https://github.com/camunda/camunda-modeler/blob/main/LICENSE) |
| Temporal Series D at USD 5B, and the OpenAI Agents SDK integration with its GA date | [Temporal news](https://temporal.io/news/temporal-raises-300M-to-make-agentic-ai-real-for-companies), [Temporal blog](https://temporal.io/blog/announcing-openai-agents-sdk-integration) |
| Temporal's Cadence-at-Uber lineage | [Temporal about](https://temporal.io/about) |
| CopilotKit Series A coverage and the enterprise product launch | [TechCrunch, 2026-05-05](https://techcrunch.com/2026/05/05/copilotkit-raises-27m-to-help-devs-deploy-app-native-ai-agents/) |
| Interrupt 2026 announcements — LLM Gateway spend caps, PII redaction and administrative audit logging, and Context Hub's three features | [LangChain blog, 2026-05-14](https://www.langchain.com/blog/interrupt-2026-overview) |
| LangSmith Deployment as the October 2025 rename of LangGraph Platform, with registry, versioning, rollbacks, approvals and custom auth | [LangSmith Deployment](https://www.langchain.com/langsmith/deployment) |
| AgentCore Policy generally available with Cedar and gateway enforcement; then Dogwood, temporal policies and gateway rate limiting | [AWS what's new, 2026-03-03](https://aws.amazon.com/about-aws/whats-new/2026/03/policy-amazon-bedrock-agentcore-generally-available/), [AWS ML blog, 2026-08-06](https://aws.amazon.com/blogs/machine-learning/control-agent-behaviors-and-cost-beyond-a-single-action-new-capabilities-in-amazon-bedrock-agentcore/) |
| Entra Agent ID scope, third-party agent support, availability wording, and the Agent 365 licence requirements for security and governance | [Microsoft Learn](https://learn.microsoft.com/en-us/entra/agent-id/what-is-microsoft-entra-agent-id), [identity governance for agents](https://learn.microsoft.com/en-us/entra/id-governance/agent-id-governance-overview) |
| Agent Identity, Agent Registry, Agent Gateway, and the Vertex AI relationship | [Google Cloud blog, 2026-04-22](https://cloud.google.com/blog/products/ai-machine-learning/introducing-gemini-enterprise-agent-platform) |
| agentgateway donation and named supporters; Agentic AI Foundation formation, founding projects and platinum members; agentgateway's move to AAIF | [Linux Foundation, 2025-08-25](https://www.linuxfoundation.org/press/linux-foundation-welcomes-agentgateway-project-to-accelerate-ai-agent-adoption-while-maintaining-security-observability-and-governance), [Linux Foundation, 2025-12-09](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation), [agentgateway blog](https://agentgateway.dev/blog/2026-06-04-agentgateway-joins-aaif/) |
| AI Control Tower positioning and June 2026 release contents | [ServiceNow community article](https://www.servicenow.com/community/ai-control-tower-articles/ai-control-tower-what-s-new-in-the-june-2026-release/ta-p/3561445) |
| LiteLLM virtual keys, budgets and the OSS-versus-Enterprise split | [LiteLLM virtual keys](https://docs.litellm.ai/docs/proxy/virtual_keys), [LiteLLM enterprise](https://docs.litellm.ai/docs/enterprise) |
| Registry and repository metadata behind the version, licence, release-date and star figures in sections 1 and 7 | [`langsmith` npm](https://registry.npmjs.org/langsmith), [`langsmith` PyPI](https://pypi.org/pypi/langsmith/json), [`litellm` PyPI](https://pypi.org/pypi/litellm/json), [litellm repository](https://github.com/BerriAI/litellm), [agentgateway releases](https://github.com/agentgateway/agentgateway/releases), [temporal releases](https://github.com/temporalio/temporal/releases) |

The sibling evaluations [`mcp-evaluation.md`](mcp-evaluation.md),
[`langgraph-evaluation.md`](langgraph-evaluation.md), [`ag-ui-evaluation.md`](ag-ui-evaluation.md)
and [`a2ui-evaluation.md`](a2ui-evaluation.md) cover the rails and the protocols; this one covers
the products built beside them. See the [section README](README.md).
