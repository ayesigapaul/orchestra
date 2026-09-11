---
title: MCP Evaluation
doc_id: DOC-093
version: 0.13.0
status: Draft
last_updated: 2026-09-10
owners: [platform-architecture]
depends_on: [ADR-0003, ADR-0007, ADR-0008, ADR-0009, ADR-0011]
---

# MCP Evaluation

The evidence behind treating the Model Context Protocol as a commodity rail
([ADR-0003](../adr/adr-0003-governance-layer-positioning.md)) and behind the outbound connector
([ADR-0007](../adr/adr-0007-outbound-connector-for-enterprise-reachability.md)), recorded so the
reasoning survives independently of the decision records. An ADR says what was decided; this says
what was measured, from which source, on which date.

Investigation date: **2026-09-10**, against primary sources — the published specification, its
machine-readable schema, the governance documents, the `LICENSE` files, registry metadata — for
versions and download counts, never for licences — and vendor documentation. MCP moves quickly: the
specification repository was pushed on the day of this reading, and the current revision replaced
its predecessor by removing most of the connection model.
Treat every figure as a timestamped observation and re-take it before relying on it. ADR-0007 is
**Proposed**; section 3 bears on it and nothing here makes it binding. Orchestra is
pre-implementation and pre-customer: no platform code exists and no design partner has seen this.
MCP's own vocabulary appears throughout because this document is about MCP; under CLAUDE.md working
rule 2 it MUST NOT appear in an Orchestra public contract, and section 5 lists the terms that would
leak.

Every claim was then re-taken by an adversarial verification pass against the same primary sources.
It sustained all five verdicts in section 1 and overturned or narrowed fourteen supporting claims,
most consequentially a licence reading and a governance reading. Each correction is applied in the
text above and listed in section 11, because a reader of a research record needs to know which
findings were fragile.

## 1. What was checked, and the verdicts

MCP is an open protocol in which a client connects to a server exposing tools, resources and prompts
to a language model, as JSON-RPC over one of two standard bindings — what
[`GLOSSARY.md`](../GLOSSARY.md) means when it says a Tool is exposed via MCP or a native adapter.

| Question | Result |
| --- | --- |
| Version, governance, licence, stability | Satisfied with qualifications — better governed than either protocol in the sibling evaluations, but final authority is a two-person BDFL layer and the licence is mid-transition |
| Reachability: is the firewall problem MCP's or the network's? | The network's. MCP does not address it, and permits the transport that does |
| Tool poisoning: what does MCP supply? | Nothing meeting threat T2. MCP's own security group records the gap as open |
| Authorization: does it compose with capability grants? | Composes. It answers a coarser question and does not duplicate the grant |
| Schema versioning for rule W5 | Not supplied. Orchestra constructs it entirely |

Two findings were not asked for and are among the most consequential: what the `2026-07-28` revision
did to retry safety (section 7), and the `x-mcp-header` mechanism (section 4).

## 2. Version, governance, licence and stability

**The current revision is `2026-07-28`**, [published on that
date](https://blog.modelcontextprotocol.io/posts/2026-07-28/). There is no 1.0 and no semantic
version. Identifiers are dates, and the [versioning
policy](https://modelcontextprotocol.io/specification/versioning) says an identifier records "the
last date backwards incompatible changes were made" and is *not* incremented while changes stay
backwards-compatible — so each identifier **after the first** marks an incompatibility. There have
been five identifiers and therefore four breaks: `2024-11-05`, the initial release, then
`2025-03-26`, `2025-06-18`, `2025-11-25` and `2026-07-28`.

**`2026-07-28` is a deep break.** Per the
[changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog): protocol-level
sessions and the `Mcp-Session-Id` header removed; the `initialize`/`initialized` handshake removed,
with protocol version and client capabilities now carried per request in `_meta`; server-initiated
requests replaced by the Multi Round-Trip Requests pattern; SSE stream resumability and message
redelivery removed; Tasks moved into an extension. Three further structural changes on the same
page were missing from this list on first reading and are restored here: a new
[`server/discover`](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) RPC
that servers **MUST** implement, advertising their supported protocol versions, capabilities and
identity; the HTTP GET endpoint and `resources/subscribe`/`resources/unsubscribe` replaced by
`subscriptions/listen`, a single client-opt-in notification stream; and `ping`, `logging/setLevel`
and `notifications/roots/list_changed` removed outright. Roots, Sampling and Logging are Deprecated,
as are the HTTP+SSE transport and Dynamic Client Registration.

**A stability guarantee now exists, at feature granularity.** The same revision adopted a [feature
lifecycle and deprecation policy](https://modelcontextprotocol.io/community/feature-lifecycle):
Active, Deprecated and Removed states, a minimum **twelve-month** window between deprecation and
eligibility for removal, a documented migration path, and a ninety-day floor under an expedited
security exception. That is a stronger written promise than either protocol in
[`ag-ui-evaluation.md`](ag-ui-evaluation.md) or [`a2ui-evaluation.md`](a2ui-evaluation.md) holds. It
constrains how features leave, not whether a revision restructures the protocol — which is what
`2026-07-28` did.

**Governance has two layers, and only the lower one is multi-vendor.** Anthropic
[donated MCP on 2025-12-09](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
to the Agentic AI Foundation, a directed fund of the Linux Foundation. The [governance
document](https://modelcontextprotocol.io/community/governance) establishes the project as "Model
Context Protocol a Series of LF Projects, LLC", records that governance changes must also be
approved by LF Projects, LLC, and defines a Steering Group of Maintainers, Core Maintainers and two
Lead Maintainers who are "the final decision makers (also known as BDFL - Benevolent Dictator for
Life)". Specification changes go through a public [Specification Enhancement
Proposal](https://modelcontextprotocol.io/community/sep-guidelines) process.

*The Core Maintainer group is genuinely cross-vendor.*
[`MAINTAINERS.md`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/MAINTAINERS.md)
lists six — Caitie McCaffrey, Clare Liguori, Kurtis Van Gent, Nick Cooper, Paul Carleton and Peter
Alexander. Where an affiliation is published it spans three competitors: Clare Liguori is "a Senior
Principal Engineer at Amazon Web Services" per the [maintainer update of
2026-04-08](https://blog.modelcontextprotocol.io/posts/2026-04-08-maintainer-update/), Kurtis Van
Gent's [GitHub profile](https://github.com/kurtisvg) gives Google Cloud and Peter Alexander's
[gives Anthropic](https://github.com/pja-ant). Two publish none.

*The layer above it is not.* Both Lead Maintainers can overrule any Core Maintainer decision, and
one of the two is confirmed Anthropic staff: Den Delimarsky is "a Member of Technical Staff at
Anthropic, where he works across the MCP ecosystem: the specification, the SDKs, governance" per the
same maintainer update, corroborated by his [GitHub profile](https://github.com/localden). The
other, David Soria Parra, publishes no employer on any source read here; that is recorded as
unestablished in section 10 rather than inferred. Both facilitators of the [Security Interest
Group](https://modelcontextprotocol.io/community/interest-groups/security) whose open agenda items
section 4 relies on — Den Delimarsky and Paul Carleton — are listed with Organization **Anthropic**
in that group's own leadership table.

*Platinum membership is evidence about funding, not about who controls the specification.* The
[formation
release](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
names Amazon Web Services, Anthropic, Block, Bloomberg, Cloudflare, Google, Microsoft and OpenAI as
platinum members, and eight competitors funding a foundation is worth recording. It is not evidence
about specification authority, and the governance document severs the two itself: membership in
technical governance "is for individuals, not companies. That is, there are no seats reserved for
specific companies." A neutral steward does not dilute a BDFL either, and the governance document
does not pretend otherwise.

**Licence.** The specification repository's
[`LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/LICENSE)
records a transition in progress: new code and specification contributions are
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), contributions whose authors have not
granted relicensing consent remain MIT, and documentation excluding specifications is CC-BY-4.0 —
so GitHub's detection reports `NOASSERTION` for the
[repository](https://github.com/modelcontextprotocol/modelcontextprotocol). Apache-2.0 carries an
express patent grant, and that grant covers consented contributions only — the file does not say
what proportion of the corpus remains MIT. It distinguishes MCP from **AG-UI**, which is MIT
([`ag-ui-evaluation.md`](ag-ui-evaluation.md)). It does not distinguish MCP from **A2UI**, whose
[`LICENSE`](https://raw.githubusercontent.com/a2ui-project/a2ui/main/LICENSE) is Apache-2.0 and
carries the identical grant ([`a2ui-evaluation.md`](a2ui-evaluation.md)).

| Adoption signal | Reading on 2026-09-10 |
| --- | --- |
| SDK versions | [`@modelcontextprotocol/sdk`](https://registry.npmjs.org/@modelcontextprotocol/sdk) **1.30.0** and the v2 packages including [`@modelcontextprotocol/client`](https://registry.npmjs.org/@modelcontextprotocol/client) **2.0.0**, both 2026-07-27; [`mcp`](https://pypi.org/pypi/mcp/json) **2.2.0** on PyPI, 2026-09-07 |
| SDK licences, read from `LICENSE` and not from registry metadata | TypeScript carries the same Apache-2.0/MIT transition text as the specification repository ([`LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/LICENSE)) and GitHub reports `NOASSERTION`; its npm `license` field still says MIT and is stale. Python is plain MIT ([`LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/LICENSE)) |
| [`@modelcontextprotocol/sdk` downloads, month to 2026-09-09](https://api.npmjs.org/downloads/point/last-month/@modelcontextprotocol/sdk) | 188,117,149 |
| [v1 monolith](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/sdk) vs [v2 `core`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/core), week to 2026-09-09 | 30,023,263 vs 3,187,835, roughly 9:1. `core` is the package both v2 halves depend on; [`client`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/client) alone is 1,939,833 and [`server`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/server) 2,870,967 |
| Specification repository | 9,180 stars, 1,786 forks, [69 open issues](https://github.com/modelcontextprotocol/modelcontextprotocol/issues?q=is%3Aissue+is%3Aopen) — 146 is GitHub's combined issues-and-pull-requests count — pushed 2026-09-10 |
| Foundation projects | Six on the [AAIF list](https://aaif.io/projects/), including A2A and agentgateway, against three at launch |
| Hyperscalers | [Bedrock AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway.html) converts APIs and Lambda functions into MCP tools; [Azure API Management](https://learn.microsoft.com/en-us/azure/api-management/export-rest-mcp-server) exposes a managed REST API as a remote MCP server |
| Model vendors | [OpenAI's Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp) calls remote MCP servers and ships its own MCP connectors |

The v1-to-v2 ratio matters, but only because the package boundary can be tied to a protocol
boundary, which it can: `@modelcontextprotocol/sdk` 1.30.0 declares
`LATEST_PROTOCOL_VERSION = '2025-11-25'` and a `SUPPORTED_PROTOCOL_VERSIONS` list topping out there
([`src/types.ts` at
1.30.0](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/1.30.0/src/types.ts)),
so the v1 line *cannot* negotiate `2026-07-28` at all. Six weeks after the revision shipped, the
dominant TypeScript client line is structurally incapable of the current protocol. Whether the
Python and other SDK lines are in the same position was not checked; see section 10.

## 3. Reachability — the question ADR-0007 rests on

**The firewall problem is a property of enterprise networks, not of MCP.** The
[transports overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
defines two standard bindings: stdio, over the standard streams of a client-launched subprocess, and
[Streamable
HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http),
where each message is an HTTP POST to a single MCP endpoint. Both are client-initiated toward the
server. MCP has no deployment model in which the server dials out, and none is being standardised:
[SEP-1287](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1287), a WebSocket
transport, was closed unmerged on 2025-12-03, and the [roadmap of
2026-08-22](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/) sets the transport direction as
unification *on* HTTP, including local servers speaking Streamable HTTP over stdio.

**MCP does permit the transport ADR-0007 describes.** The same page states the protocol is
transport-agnostic and can be implemented over any channel supporting bidirectional message
exchange, provided a custom transport preserves the JSON-RPC message format, the message patterns
and the per-request metadata model. A multiplexed connector tunnel is a conformant binding, not a
fork — a finding in ADR-0007's favour, and the first time its central mechanism has been checked
against the specification text. `2026-07-28` also makes that tunnel cheaper: statelessness removes
session affinity, servers no longer initiate requests so nothing must be routed backwards out of
band, and standard request headers let an intermediary route and meter without parsing the body. The
[Standard Request
Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
table is precise about which, and the first reading of it here was not: `Mcp-Method` is REQUIRED on
all requests, `Mcp-Name` only on `tools/call`, `resources/read` and `prompts/get`. Method-level
metering is therefore available on every POST and name-level metering on exactly those three — which
includes every tool call, so the point that bears on
[ADR-0009](../adr/adr-0009-meter-first-defer-tiering.md) survives at the granularity that matters.

**The consequential half: the outbound connector is being commoditised by the model vendors.**
[OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) runs a
`tunnel-client` inside the customer network which opens outbound HTTPS to OpenAI, long-polls for
queued work, forwards each JSON-RPC request locally and posts the response back: "The private MCP
server does not need a public listener." [Anthropic MCP
tunnels](https://platform.claude.com/docs/en/agents-and-tools/mcp-tunnels/overview) run `cloudflared`
outbound from the customer network into a proxy that terminates an inner TLS session under a
certificate only the customer holds, validates upstream IPs, routes by hostname, and leaves OAuth on
each MCP server as a third layer; deployment is Kubernetes or a VM with Docker. Anthropic's is a
**research preview**, "as-is", with no uptime, support or continuity commitment.

**What this does to ADR-0007, which is Proposed.** Its premise survives and is strengthened: two of
the largest model vendors built outbound-only tunnels, which is evidence that public exposure is
refused often enough to justify the workaround. Its *positioning* does not survive unexamined.
ADR-0003 classifies as commodity anything "improving without us", and by that test the tunnel now
is. ADR-0007 reopens today only if design partners can expose MCP publicly; on this evidence a
second reopener exists, because a partner already running a vendor tunnel changes the
build-or-integrate question rather than the necessity question. **Recommended, not decided:** add
that criterion, and have the ADR state which half of the connector it claims as differentiated. The
evidence points at the governance carried on the tunnel rather than at the tunnel — the enforcement
point, the capability grant, the connector's own allow-list and the governance-visible refusal fixed
by [`tool-authorization.md`](../40-governance/tool-authorization.md) TA15–TA18 — but that is the
content of a recommendation, not a finding this document is entitled to settle on the ADR's behalf.

**A finding that bears on an Accepted ADR.**
[ADR-0003](../adr/adr-0003-governance-layer-positioning.md) is **Accepted**, and its Context lists
"reaching tools behind an enterprise firewall" first among five differentiated capabilities. The
evidence in this section is that SaaS-to-private-network reachability with no inbound listener is
shipped and documented by two model vendors, and that ADR-0003's own commodity test — "improving
without us" — is met by it. That does not touch ADR-0003's *decision*, which is about what Orchestra
builds; it falsifies one of the five entries in the sort that justifies the decision. Recorded here
and routed to the repository owner. A superseding ADR would have to argue a re-sorted Context that
moves enterprise firewall reachability into the commodity column, naming these two tunnels; state
what remains differentiated once it moves; and say whether Orchestra claims the tunnel itself or
only the governance carried on it. **This document does not argue any of that, and amends no ADR.**
[`prior-art-survey.md`](prior-art-survey.md) reaches the same row from another direction, and rates
enterprise tool reachability against an in-cluster proxy rather than against these tunnels; the
evidence here is the stronger challenge of the two. That survey has since reconciled to it — its
section 7.2 cites this section directly and rates the row against these tunnels.

## 4. Tool poisoning — what MCP supplies, and what it leaves to the host

**It supplies nothing meeting threat T2** of [`threat-model.md`](../40-governance/threat-model.md).
Checked against the machine-readable
[schema](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.json),
a `Tool` carries exactly `name`, `title`, `description`, `icons`, `inputSchema`, `outputSchema`,
`annotations` and `_meta`, of which only `name` and `inputSchema` are required. There is no
signature, no digest, no version, no issuer and no expiry.

- **Annotations are hints, and MCP says so.** The schema's own description: "all properties in
  `ToolAnnotations` are **hints** … Clients should never make tool use decisions based on
  `ToolAnnotations` received from untrusted servers", and the
  [tools page](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) makes it
  normative — annotations MUST be treated as untrusted unless they come from trusted servers, with
  no definition anywhere of what makes a server trusted. `readOnlyHint`, `destructiveHint`,
  `idempotentHint` and `openWorldHint` are the nearest thing MCP has to a Side-Effect Class, and are
  exactly what TA9 forbids reading at invocation time. MCP agrees with Orchestra here.
- **Server identity is self-asserted, including where the protocol advertises it.** `2026-07-28`
  adds
  [`server/discover`](https://modelcontextprotocol.io/specification/2026-07-28/server/discover),
  which servers MUST implement and which returns supported protocol versions, capabilities and
  identity — the only protocol-level identity advertisement that exists, and one this document
  omitted on first reading. It does not close the gap. The identity it returns is
  `io.modelcontextprotocol/serverInfo`, and the
  [`_meta` rules](https://modelcontextprotocol.io/specification/2026-07-28/basic/index) state that
  `clientInfo` and `serverInfo` "are self-reported by the sender and are not verified by the
  protocol", and SHOULD NOT be relied on for security decisions. The RPC advertises an identity and
  nothing binds it. There is still no server identity in the protocol to bind a registered Tool
  record to.
- **The only drift signal is one the attacker chooses to send.** `notifications/tools/list_changed`
  is emitted at the server's discretion, so an origin that quietly rewrites a description produces
  none. `ListToolsResult` also carries origin-set `ttlMs` and `cacheScope`, and
  `cacheScope: "public"` invites shared intermediaries to cache and serve a tool list "across
  authorization contexts" — an origin-supplied instruction that, honoured by a multi-tenant
  platform, would breach working rule 7 and
  [ADR-0011](../adr/adr-0011-tenant-isolation-shared-schema-rls.md).

**Signing has been proposed four times and accepted none; two proposals are live.**
[PR #649](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/649), the Enhanced Tool
Definition Interface — immutable versioned tool definitions aimed explicitly at tool poisoning and
rug pulls — opened 2025-06-04 and closed unmerged 2025-09-24;
[SEP-2091](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2091), Server
Capability Signatures, opened 2026-01-15 and closed unmerged thirteen days later;
[SEP-3140](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3140), Signed
Capability Declarations, opened 2026-07-27 and still open. The fourth is **SEP-2809**, Attested
Tool-Server Admission, which the [Security Interest
Group](https://modelcontextprotocol.io/community/interest-groups/security) carries at status
**Draft** with a named champion, and whose In Scope text claims "server identity, attestation, and
admission … including signed assertions, trust roots". The same agenda carries "Runtime drift:
`list_changed` semantics after approval" and "Tool identity across servers" at status **Open** with
no champion. Quoting only the championless rows, as this document did on first reading, overstated
the dormancy: upstream is working on the gap. What has shipped is still nothing, which remains
upstream confirmation of the threat model's own sentence, that detection of post-registration drift
is a design nobody has done. The registry does not close the gap either: its [design
principles](https://raw.githubusercontent.com/modelcontextprotocol/registry/main/docs/design/design-principles.md)
commit to DNS and OAuth verification of the publisher alongside "no built-in ranking, curation, or
quality judgments", and its own [validation
note](https://raw.githubusercontent.com/modelcontextprotocol/registry/main/docs/design/proposed-enhanced-validation.md)
records that servers are published today without full validation against the `server.json` schema.
It binds names, not content.

**A surface T2 does not name: `x-mcp-header`.** A server's `inputSchema` may mark parameters with
`x-mcp-header`, and a Streamable HTTP client then mirrors those argument values into `Mcp-Param-*`
HTTP headers, visible to every intermediary; use of the marking is optional for servers but
"clients MUST support this feature"
([transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)).
Clients "MUST reject tool definitions where any `x-mcp-header` value violates these constraints" —
constraints on emptiness, HTTP token syntax, control characters, uniqueness, primitive type and
static reachability, which validate the header *name*, not what travels in it. The protection
against exfiltration is a SHOULD NOT addressed to the server developer: "Server developers SHOULD
NOT mark sensitive parameters (passwords, API keys, tokens, PII) with `x-mcp-header`, as header
values are visible to network intermediaries"
([tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).
Under T2 the schema is attacker-influenced, so the mitigation is addressed to the attacker.
**Recommended, not decided:** T2 should name this, and TA9's registered record should capture
`x-mcp-header` markings so a later addition is detectable drift. Nothing here changes the threat
model, but the confirmation is worth having: it removes "upstream will fix this" from the range of
plans.

## 5. Authorization — composition, and where the vocabulary leaks

MCP's [authorization
specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) is
OPTIONAL, applies to HTTP transports only — stdio implementations take credentials from the
environment — and casts the MCP server as an OAuth 2.1 resource server, the client as an OAuth 2.1
client. Load-bearing requirements: RFC 9728 protected resource metadata for authorization-server
discovery; RFC 8707 resource indicators on authorization and token requests; servers MUST validate
that a token was issued for them as audience and MUST NOT accept or transit any other; RFC 9207
issuer validation before a code is redeemed; scope challenges and step-up authorization on `403`;
and Client ID Metadata Documents as the preferred registration path now that Dynamic Client
Registration is deprecated. The [security best-practices
page](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices) covers
the confused deputy in its OAuth-proxy form, token passthrough, SSRF and mix-up attacks.

**It composes with deny-by-default capability grants because it answers a coarser question.** MCP
authorization decides whether a caller may reach a server. It has no concept of a per-Tool grant, a
Side-Effect Class, an approval gate, or a Principal on whose behalf a Run executes. It is the
credential presented at the origin *after* TA11's enforcement point has decided, not a parallel
decision — and TA8 is worth restating against it: a valid token is reachability, not authority.

**One MCP mechanism speaks to an open Orchestra question.** The [Enterprise-Managed Authorization
extension](https://modelcontextprotocol.io/extensions/auth/enterprise-managed-authorization) puts
the enterprise IdP in the path: the client obtains an Identity Assertion JWT Authorization Grant
(ID-JAG) from the IdP and exchanges it for an access token at the server's authorization server, so
the origin sees a delegated corporate identity rather than an opaque service identity, and the
roadmap commits to Workload Identity Federation, DPoP and standard token exchange for agent
identity. That is a standards-track answer to one of the three questions
[`tool-authorization.md`](../40-governance/tool-authorization.md) section 6 leaves open — what
identity the Tool origin sees — without settling it: the extension grants access per *server*, not
per Tool, and like all [extensions](https://modelcontextprotocol.io/docs/extensions/overview) is
disabled by default and evolves independently of the core. The useful consequence is narrower: the
ADR section 6 calls for should be written against these mechanisms rather than inventing one.

**Where MCP vocabulary would leak.** Under rule 2 none of these may appear in an Orchestra API,
schema, SDK or customer-facing document: `tools/call`, `inputSchema` and `outputSchema`,
`annotations` and the `*Hint` fields, `_meta` and any `io.modelcontextprotocol/*` key, `resultType`,
`structuredContent`, the `Mcp-Method`, `Mcp-Name` and `Mcp-Param-*` headers, the `-32020` to
`-32099` error range, and the protocol revision string. The sharpest hazard is the last: MCP
revisions are dates, and so are Orchestra gateway revisions (`Orchestra-Version: 2026-09-08`,
[`VERSIONING.md`](../VERSIONING.md) section 4). Two date-shaped version identifiers will coexist and
exactly one may ever be visible.

A second gap is definitional rather than a leak. `GLOSSARY.md` deliberately admits **MCP Server** as
an Orchestra term but has none for three MCP concepts an origin may serve: resources, prompts, and
the Tasks extension's durable handles — the last overlapping **Run** and **Checkpoint**. An MCP
server exposing resources and prompts has nowhere to land in the Tool Catalog today. Named, not
decided: the Catalog schema is unwritten and [`domain-model.md`](../20-domain/domain-model.md) is
silent.

## 6. Schema versioning — rule W5 is Orchestra's alone

[`VERSIONING.md`](../VERSIONING.md) rule W5 pins the MAJOR version of each Tool schema a Workflow
references. **MCP supplies no version to pin.** The `Tool` object has no version field. Identity is
`name`, unique only within one server, and the specification notes that aggregators combining
servers SHOULD prefix names with a server identifier because collisions are expected, adding that
the server's own `name` is not guaranteed unique and SHOULD NOT be relied on for disambiguation. The
identity of a Tool across time and across origins is Orchestra's to construct. Three version-shaped
things exist and none is a tool schema version: the protocol revision, a date describing the wire;
the `version` field on a registry `server.json` record, describing a distribution; and `serverInfo`,
self-reported and not to be relied on for security.

The consequence joins two work items that currently sit apart. To pin a MAJOR, Orchestra must
*compute* the version by comparing what an origin serves now against the `inputSchema` and
`outputSchema` captured at registration — the same comparison T2's undesigned drift detection
requires. **W5 and T2 drift detection are one mechanism**: a MAJOR bump is a detected drift
classified as breaking. `tool-authorization.md` section 10 routes drift detection to a later
document; on this evidence it is also the precondition for W5 in a published Workflow, which argues
for raising its priority. A recommendation about sequencing, not a decision.

## 7. Retry and idempotency — the finding nobody asked for

The string `idempot` occurs exactly once in the whole `2026-07-28` schema: `idempotentHint`, the
untrusted annotation. `CallToolRequestParams` carries `_meta`, `arguments`, `inputResponses`, `name`
and `requestState` — there is **no idempotency key in the protocol**. Against that, the revision
removed resumability: `Last-Event-ID` is not supported, and the changelog states that a broken
response stream loses the in-flight request and clients **MUST re-issue it as a new request with a
new request ID**. That is precisely the blind retry of a partially executed side effect prohibited
by working rule 6, invariant I4,
[ADR-0008](../adr/adr-0008-declarative-workflow-definitions.md) and TA18. **A conformant MCP client
is not a safe Orchestra Tool client**, and this is where a stock SDK will breach an Orchestra
invariant by default: on a tunnel drop mid-call, the exact failure ADR-0007 names. The safe
behaviour must be built above the SDK, at Step Execution.

The extension point exists. `_meta` is open by prefixed key, reverse-DNS notation is recommended,
and only prefixes whose second label is `modelcontextprotocol` or `mcp` are reserved — so Orchestra
can carry tenant, run, step-execution and idempotency identifiers under its own prefix,
structurally the same accommodation the **Proposed**
[ADR-0004](../adr/adr-0004-adopt-ag-ui-event-protocol.md) profile makes inside AG-UI's `metadata`.
Two limits, both unresolved: nothing found requires a server or intermediary to *preserve* unknown
`_meta` keys, and nothing requires an origin to honour an idempotency key it does not understand.
One bonus: `traceparent`, `tracestate` and `baggage` are reserved `_meta` keys for OpenTelemetry
trace context propagation — the reservation is OpenTelemetry's, the three headers themselves are
W3C — so trace propagation into an origin is free for the audit and observability model.

## 8. What this would change, and in which ADR

| ADR or document | Finding | Effect |
| --- | --- | --- |
| ADR-0003 (Accepted) | Neutral foundation stewardship, public SEP process, a cross-vendor Core Maintainer group, an Apache-2.0 transition carrying an express patent grant, hyperscaler implementations, 188M monthly SDK downloads | **Confirms** the commodity-rail classification, with the qualification that final authority is a two-person BDFL layer, one of them confirmed Anthropic staff |
| ADR-0003 (Accepted) | Two model vendors ship SaaS-to-private-network MCP tunnels needing no inbound listener | **Bears on the Context sort.** "Reaching tools behind an enterprise firewall" now meets ADR-0003's own commodity test. Routed to the repository owner; only a superseding ADR can re-sort it, and this document does not argue one |
| ADR-0007 (Proposed) | Reachability is a network property; MCP permits a conformant custom transport; statelessness and header routing reduce tunnel cost | **Confirms** the design, and answers a question the ADR never put to the specification |
| ADR-0007 (Proposed) | OpenAI and Anthropic both ship outbound-only MCP tunnels; Anthropic's is a research preview | **Would reopen the positioning.** Recommend a second revisit criterion and an explicit differentiation claim, the evidence pointing at the governance rather than the transport |
| ADR-0008 (Accepted at investigation; superseded by ADR-0014 on 2026-09-11), invariant I4 | No idempotency key; the specification mandates re-issuing a lost request | **Confirms** the prohibition and names where a stock client breaks it |
| ADR-0009 (Accepted) | `Mcp-Method` is required on every Streamable HTTP request; `Mcp-Name` only on `tools/call`, `resources/read` and `prompts/get` | Method-level metering on every POST and name-level metering on every tool call, neither needing body parsing |
| `threat-model.md` T2 | Nothing upstream; `x-mcp-header` is an unnamed exfiltration surface | Recommend T2 and TA9 be extended |
| `VERSIONING.md` W5 | No tool schema version exists in MCP | W5 depends on drift detection; they are one mechanism, which raises its priority |

Nothing above is decided here, and no ADR is amended by it. Where a change is warranted the ADR is
named, the evidence is stated, and — for the two rows against Accepted ADRs — what a superseding ADR
would have to argue is set out in section 3 and left there for the repository owner.

## 9. Is MCP a safe rail, and what is the single biggest risk

**Yes, on today's evidence, and more comfortably than the two protocols already evaluated.** It sits
under neutral Linux Foundation stewardship with a documented governance structure, a public proposal
process, a cross-vendor Core Maintainer group, a twelve-month deprecation floor, an Apache-2.0
licensing transition carrying an express patent grant for consented contributions, and
implementations from every hyperscaler. Two qualifications belong in the same breath rather than in
a footnote. Final authority is a two-person BDFL layer, one of whom is confirmed Anthropic staff and
the other of whom publishes no affiliation, and both Security Interest Group facilitator seats are
Anthropic; and the foundation's eight platinum members are evidence about funding, not about who
controls the specification. The gaps that matter to a governance layer — integrity of tool metadata,
drift detection, per-Tool authorization, schema versioning, idempotency — are gaps Orchestra had
already assigned to itself. Nothing here requires reversing ADR-0003's decision. One entry in the
Context sort behind that decision does not survive, which section 3 states and routes rather than
acts on.

**The single biggest risk is protocol-era skew, not tool poisoning.** Poisoning is a known gap
Orchestra owns and has specified controls for. Skew compounds. Five revisions in twenty-one months,
four of them breaking; the newest removed sessions, the handshake, server-initiated requests and
resumability; and six weeks on, the dominant TypeScript SDK line cannot negotiate the new one at
all. Orchestra's Tool Catalog will therefore span protocol eras indefinitely — and under
[`VERSIONING.md`](../VERSIONING.md) section 9
the connector carrying much of that traffic runs inside customer networks and cannot be
force-upgraded. Every governance control must hold identically across both eras and across a
transport whose version Orchestra does not control. That is a permanent, compounding tax on the
adapter rather than a one-off migration, and TA15 — a decision MUST NOT vary by transport — is the
requirement most likely to be quietly broken by it.

## 10. What this does not establish

- Whether any server or intermediary is required to preserve unknown `_meta` keys. No normative
  statement was found either way, and Orchestra's carriage strategy depends on it.
- Whether Bedrock AgentCore Gateway or Azure API Management reach private or on-premises targets,
  and which protocol revision either vendor tunnel speaks. The pages read do not say.
- How many servers the public registry holds. The API paginates and publishes no total.
- Whether SEP-3140 will be accepted. It has been open six weeks; two predecessors were closed.
- Whether MCP's conformance tooling is adequate for an Orchestra adapter, and whether the Tasks
  extension's durable handles collide with **Run** and **Checkpoint**. Neither was assessed.
- Where the second Lead Maintainer works. Den Delimarsky's Anthropic employment is stated on MCP's
  own blog and on his GitHub profile; David Soria Parra's employer appears on none of the governance
  page, `MAINTAINERS.md`, his GitHub profile, the donation announcement or the foundation formation
  release. The concentration finding in section 2 therefore rests on one confirmed Lead Maintainer
  and two confirmed Security Interest Group facilitators, not on two confirmed Lead Maintainers, and
  it is stated at that strength.
- What proportion of the specification corpus the Apache-2.0 patent grant reaches. The transition
  leaves unconsented contributions under MIT and the `LICENSE` does not quantify them.
- Which protocol revision the non-TypeScript installed base speaks. The TypeScript v1 line is
  settled — 1.30.0 lists no supported version later than `2025-11-25` — but the Python, Java, Go and
  other SDK lines were not read.
- Everything downstream of a real buyer. Per working rule 8 this is pre-customer: no enterprise
  reviewer has seen the reachability finding or the drift gap.

## 11. Corrections applied

An adversarial verification pass re-took every claim above against the same primary sources. It
sustained all five section 1 verdicts, both findings in section 1's closing note, and section 9's
risk conclusion. It overturned or narrowed the following, all of which are corrected in the text
above rather than repeated here. Recorded so the provenance of this document is auditable, in the
same house format as [`a2ui-evaluation.md`](a2ui-evaluation.md).

| Original claim | Correction |
| --- | --- |
| SDKs, all MIT | Read from `LICENSE`, not registry metadata: the TypeScript SDK carries the same Apache-2.0/MIT transition text as the specification repository and is `NOASSERTION` on GitHub; only its stale npm `license` field says MIT. The Python SDK genuinely is MIT |
| Apache-2.0's patent grant distinguishes MCP from the MIT-licensed protocols in the sibling evaluations | It distinguishes MCP from AG-UI alone. A2UI is Apache-2.0 and carries the identical grant |
| Governance is multi-vendor | True of the Core Maintainer group. The Lead Maintainer BDFL layer above it, and both Security Interest Group facilitator seats, are not |
| Eight competing platinum members is governance evidence | It is funding evidence. The governance document reserves no technical governance seats for companies |
| `Mcp-Method` and `Mcp-Name` are mandatory on every POST | `Mcp-Method` on all requests; `Mcp-Name` only on `tools/call`, `resources/read` and `prompts/get` |
| Each identifier marks an incompatibility, and there have been five | Each identifier after the first. Five identifiers, four breaks — which is what section 9 said all along |
| 146 open issues | 69 open issues; 146 is GitHub's combined issues-and-pull-requests count |
| The v1-to-v2 download ratio, measured against `@modelcontextprotocol/client` | Roughly 9:1 measured against `@modelcontextprotocol/core`, the package both v2 halves depend on. `client` alone understates v2 adoption because a server-side adopter installs `server` |
| Six weeks on, the ecosystem is still speaking the old protocol | Sound, but it was inferred from package major versions. Now established directly: `@modelcontextprotocol/sdk` 1.30.0 lists no supported protocol version later than `2025-11-25` |
| Signing has been proposed three times | Four. SEP-2809 (Attested Tool-Server Admission) is Draft with a named champion, alongside the still-open SEP-3140 |
| The `2026-07-28` break list | Incomplete. `server/discover`, `subscriptions/listen` and the removal of `ping`, `logging/setLevel` and `notifications/roots/list_changed` were missing; `server/discover` is a new MUST that section 4 now disposes of explicitly |
| `traceparent`, `tracestate` and `baggage` are reserved for W3C Trace Context | Reserved for OpenTelemetry trace context propagation. The three headers are W3C; the reservation is not |
| `Orchestra-Version` is defined in `VERSIONING.md` section 5 | Section 4, Gateway HTTP API |
| The LangGraph evaluation and the prior-art survey are planned | Both exist, at this document's own version and date |

Two things the pass did **not** change, recorded because they were tested: the `x-mcp-header`
finding in section 4 and the retry-safety finding in section 7 were both re-read against the
specification and stand as written.

## 12. Sources

Sources whose paths are too long for prose, or which are cited more than once. All returned HTTP 200
on 2026-09-10, as did every link above.

| Evidence | Source |
| --- | --- |
| Licence text, read from the file rather than from registry metadata | [specification `LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/LICENSE), [TypeScript SDK `LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/LICENSE), [Python SDK `LICENSE`](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/LICENSE), [A2UI `LICENSE`](https://raw.githubusercontent.com/a2ui-project/a2ui/main/LICENSE) |
| Maintainer roster and published affiliations | [`MAINTAINERS.md`](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/MAINTAINERS.md), [maintainer update, 2026-04-08](https://blog.modelcontextprotocol.io/posts/2026-04-08-maintainer-update/), [governance](https://modelcontextprotocol.io/community/governance), [Security Interest Group](https://modelcontextprotocol.io/community/interest-groups/security), profiles for [localden](https://github.com/localden), [kurtisvg](https://github.com/kurtisvg) and [pja-ant](https://github.com/pja-ant) |
| Download figures, week to 2026-09-09 | [`sdk`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/sdk), [`core`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/core), [`client`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/client), [`server`](https://api.npmjs.org/downloads/point/last-week/@modelcontextprotocol/server) |
| Repository counts | [repository](https://github.com/modelcontextprotocol/modelcontextprotocol), [open issues excluding pull requests](https://github.com/modelcontextprotocol/modelcontextprotocol/issues?q=is%3Aissue+is%3Aopen) |
| The v1 protocol ceiling | [`src/types.ts` at 1.30.0](https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/1.30.0/src/types.ts) |
| `x-mcp-header`, both halves | [server tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http) |

The sibling evaluations are [`ag-ui-evaluation.md`](ag-ui-evaluation.md),
[`a2ui-evaluation.md`](a2ui-evaluation.md) and [`langgraph-evaluation.md`](langgraph-evaluation.md),
with the wider [`prior-art-survey.md`](prior-art-survey.md); all four are written. See the
[section README](README.md).
