---
title: "ADR-0003: Position Orchestra as a governance layer, not an agent framework"
adr_id: ADR-0003
status: Accepted
date: 2026-09-08
deciders: [product-owner, platform-architecture]
tags: [product, strategy, scope]
depends_on: [ADR-0001, ADR-0002]
---

# ADR-0003: Position Orchestra as a governance layer, not an agent framework

## Status

Accepted

## Context

The v0.1 MVP scope (§30) contained an agent runtime, a model router, an MCP client, two client SDKs,
an eleven-component UI catalog, a reference backend, an MCP server, transport, security and
observability. Sorting that list by whether it is differentiated is revealing:

**Commodity, and improving without us:** agent orchestration (LangGraph), model invocation, MCP
client libraries, and agent-to-UI event streaming with React bindings — the last of which already
exists as AG-UI with native LangGraph support.

**Differentiated:** reaching tools behind an enterprise firewall; custodying BYOK credentials across
tenants; policy and approval as an administered system rather than a code-level interrupt; audit and
attribution that survives a security review; and quota-aware scheduling against the customer's own
limits.

v0.1 allocated most of its weight to the commodity set. It gave the policy engine — drawn once in
§15 as *tool call → policy → approval → resume* — roughly ten lines and no schema, while spending
two full sections on model routing that [ADR-0006](adr-0006-model-layer-as-credential-broker.md)
shows is unimplementable under BYOK.

The purchase driver in the target segment is not the ability to build an agent, which is now
inexpensive. It is the ability to answer, under audit: who may use this agent, which capabilities it
holds, who approved this action, on what evidence, at what cost, and how it is stopped.

## Decision drivers

- Build where the value is defensible and the incumbents are absent.
- Pre-customer, avoid competing on a commodity that a well-funded ecosystem is improving weekly.
- Enterprise procurement buys assurance, not capability.

## Considered options

1. **Full-stack agent platform** — own runtime, own protocol, own SDKs, plus governance.
2. **Governance and connectivity layer** — adopt commodity rails; own the control surface.
3. **Pure connectivity** — enterprise MCP gateway only, no agent concepts.

## Decision

Orchestra is positioned as the **governance and connectivity layer for enterprise AI agents**. The
orchestration runtime, model providers and tool protocol are treated as commodity rails. Orchestra owns
the control surface over them: identity, policy, approval, audit, connectivity, workflow definition
and metering.

The v0.1 analogy is retained but corrected: Stripe did not build the card networks — it built the
control surface over them. LangGraph, the model providers and MCP are the rails.

## Rationale

Option 1 spends the majority of a pre-customer year on the parts of the system with the least
defensibility and the strongest incumbents. Option 3 discards the agent-facing value that makes
governance necessary in the first place. Option 2 concentrates effort on the questions an enterprise
buyer actually asks, and treats every improvement in the underlying rails as a tailwind rather than
a competitive threat.

This positioning also supplies the correct answer to prompt injection, which v0.1 never mentioned
despite connecting an LLM to enterprise write-capable tools: injection is not defended by better
prompts, but by policy the model cannot argue past. A financial action above a threshold requires a
human regardless of how persuasively the agent justifies it.

## Consequences

### Positive

- Documentation, roadmap and engineering effort concentrate on defensible surface.
- Improvements to LangGraph, MCP and AG-UI accrue to Orchestra rather than competing with it.
- Produces a coherent buyer story for security and compliance stakeholders, who hold the veto.

### Negative

- Dependence on third-party projects for rails Orchestra does not control. Mitigated by keeping every
  such dependency behind an adapter and never in a public contract.
- The narrative is less exciting to a builder audience than "our own agent framework". This is a
  positioning cost, not an engineering one.

### Neutral / follow-on work

- The **Control Plane** becomes a first-class product surface with its own architecture document. It
  is absent from v0.1 entirely.
- **Policy Enforcement Points** become the architectural centre of the data plane and require a
  normative specification.
- Threat modelling — prompt injection, tool poisoning, confused-deputy, egress and SSRF — becomes a
  required document, not an appendix.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A rail provider adds governance and absorbs the category | Medium | High | Compete on cross-runtime, cross-provider neutrality and enterprise depth |
| "Governance" reads as low-value overhead to buyers | Medium | Medium | Lead with approval, audit and connectivity outcomes, not with the abstract word |
| Upstream breaking changes in adopted rails | Medium | Medium | Adapters at the edge; pinned versions; conformance tests |

## Revisit criteria

Reopen if design partners consistently report that governance is satisfied by existing controls and
that their unmet need is orchestration capability itself.
