# Agent Integration Platform — Vision & Architecture

**Status:** Vision / Architecture Brief  
**Audience:** Product owner, architects, coding agents, contributors  
**Primary client targets:** React Web + React Native  
**Reference backend:** Kotlin + MCP server  
**Agent runtime:** LangGraph  
**Design goal:** LLM-provider agnostic, protocol-first, extensible AI-agent integration platform

---

## 1. Executive Vision

We are building a platform that allows existing software systems to add capable AI agents without coupling the application to a single LLM provider, agent framework, UI technology, or backend implementation language.

The platform should provide a clean abstraction between:

- **Applications** that want AI capabilities.
- **Agents** that reason, orchestrate work, maintain state, and invoke tools.
- **Models** supplied by one or more LLM providers.
- **Tools and enterprise capabilities** exposed through MCP or internal adapters.
- **Agent-driven UI** rendered natively by the consuming application.
- **Client SDKs** for Web and Mobile.

The core architectural idea is:

```text
Application
    │
    ▼
Client SDK
    │
    │ Agent Events / UI Protocol
    ▼
AI Gateway
    │
    ▼
Agent Runtime
    │
    ├── Model Router ──► OpenAI / Anthropic / Gemini / Local / Custom
    │
    ├── MCP Client ────► MCP Servers
    │
    ├── Memory
    │
    ├── Policy / Approval
    │
    └── Persistence
```

The consumer should integrate with **our platform contracts**, not directly with LangGraph.

LangGraph is the initial orchestration implementation, not the public architectural boundary. LangGraph is designed for low-level, long-running, stateful agent orchestration with durable execution, streaming, persistence, and human-in-the-loop capabilities. Our platform should build on those capabilities while avoiding a hard public dependency on LangGraph concepts. See: https://docs.langchain.com/oss/python/langgraph/overview

---

# 2. Core Product Principle

> **Build the platform around stable domain and protocol abstractions, and treat infrastructure/framework choices as replaceable implementations.**

A customer should be able to say:

```text
"I have a React application.
I have a React Native application.
I have an existing backend.
I want to add an AI agent."
```

and integrate using our SDKs without needing to understand:

- LangGraph internals
- provider-specific APIs
- MCP implementation details
- model-specific streaming formats
- provider-specific tool-call structures
- how the agent stores checkpoints
- how the agent generates the UI internally

The customer should think in terms of:

```text
Agent
Run
Conversation
Message
Tool
Approval
UI Surface
UI Event
Model
Provider
```

---

# 3. Architectural Values

## 3.1 Provider agnostic

The platform must never assume one LLM vendor.

A deployment should support:

```text
OpenAI
Anthropic
Google
Local models
Open-source model gateways
Enterprise/private models
Custom provider adapters
```

The platform should also allow a single agent to use multiple models.

Example:

```yaml
models:
  fast:
    provider: openai
    model: <model>

  reasoning:
    provider: anthropic
    model: <model>

  multimodal:
    provider: google
    model: <model>

  local:
    provider: ollama
    model: <model>
```

Model selection should be policy-driven rather than hard-coded.

---

## 3.2 Protocol first

The platform should define explicit contracts for:

- agent runs
- events
- messages
- tool execution
- approvals
- UI surfaces
- UI actions
- model configuration
- provider capabilities

Prefer schemas and versioned contracts over undocumented internal object shapes.

JSON Schema should be considered a source of truth for wire contracts where practical.

---

## 3.3 Framework independence

The first runtime is LangGraph.

However:

```text
Our Agent API
      │
      ▼
Runtime Adapter
      │
      ├── LangGraph
      ├── Future custom runtime
      └── Future alternative runtime
```

No consumer-facing SDK should need to import LangGraph types.

This protects the platform from future runtime changes.

---

## 3.4 Native UI, not arbitrary generated code

The agent must not generate arbitrary JavaScript, React, or native code for execution in the client.

Instead:

```text
Agent
   │
   ▼
Declarative UI description
   │
   ▼
Validated client renderer
```

The renderer maps safe declarative components to native components.

This is safer, more portable, easier to version, and more suitable for enterprise integration.

A2UI should be evaluated seriously as the external/interchange representation for agent-driven UI. A2UI currently defines a declarative, streaming UI protocol intended to render natively across web, mobile, and desktop without executing arbitrary code. Its current production release is v0.9.1, while v1.0 is a candidate. See:

- https://a2ui.org/
- https://a2ui.org/concepts/overview/

We should avoid inventing a proprietary UI wire format until A2UI compatibility and extension requirements have been assessed.

---

# 4. Target Platforms

## 4.1 Web

Primary SDK:

```text
React + TypeScript
```

Likely package:

```text
@<org>/agent-react
```

The web SDK should be usable by:

- React applications
- Next.js applications
- existing frontend applications

It should not require a specific application router or state-management library.

---

## 4.2 Mobile

Primary SDK:

```text
React Native + TypeScript
```

Potential package:

```text
@<org>/agent-react-native
```

React Native is selected over Flutter for this platform because React and React Native allow the core client developer experience, protocol types, validation, and tooling to remain in the TypeScript ecosystem.

For new React Native projects, prefer an established framework such as Expo. React Native's New Architecture has been production-ready since 0.76 and is enabled by default; current React Native releases continue this direction. The official documentation recommends using a framework such as Expo for new applications.

References:

- https://reactnative.dev/
- https://reactnative.dev/architecture/landing-page
- https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here

As of the current architecture plan, do not target Flutter as a first-class client.

A future Flutter SDK may be added if there is a compelling integration or ecosystem reason.

---

# 5. High-Level System Architecture

```text
                         ┌─────────────────────────┐
                         │       Host Apps         │
                         │                         │
                         │ React Web               │
                         │ React Native            │
                         └────────────┬────────────┘
                                      │
                              Client SDKs
                                      │
                         SSE / WebSocket / HTTPS
                                      │
                         ┌────────────▼────────────┐
                         │       AI Gateway         │
                         │                          │
                         │ Auth                     │
                         │ Sessions                 │
                         │ Streaming                │
                         │ Tenant isolation         │
                         │ Rate limiting            │
                         │ Policy                   │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │      Agent Runtime        │
                         │                           │
                         │ LangGraph                │
                         │ State                    │
                         │ Checkpoints              │
                         │ Memory                   │
                         │ Interrupts               │
                         └───────┬──────────┬────────┘
                                 │          │
                      ┌──────────▼───┐  ┌──▼──────────┐
                      │ Model Router │  │ MCP Client  │
                      └──────┬───────┘  └─────┬───────┘
                             │                │
              ┌──────────────┼──────────┐     │
              ▼              ▼          ▼     ▼
           Provider A    Provider B   Local   MCP
                                          Servers
                                               │
                                        ┌──────▼───────┐
                                        │ Application  │
                                        │ Services     │
                                        └──────────────┘
```

---

# 6. Platform Layers

## Layer 1 — Client SDK

Responsibilities:

- establish authenticated sessions
- send user messages
- receive streaming events
- render agent messages
- render declarative UI
- submit UI actions
- present approval requests
- reconnect to active runs
- expose lifecycle hooks
- expose typed APIs

The SDK should not implement agent reasoning.

---

## Layer 2 — Transport

The platform should use a transport-independent event model.

Potential transports:

```text
HTTPS
SSE
WebSocket
```

Initial recommendation:

- HTTPS for ordinary request/response operations.
- SSE for straightforward one-way agent event streaming.
- WebSocket where bidirectional, long-lived interaction makes it materially useful.

The application should depend on the event contract rather than the transport.

---

## Layer 3 — AI Gateway

The gateway is the public boundary between client applications and the agent platform.

Responsibilities:

- authentication
- authorization
- tenant isolation
- session management
- run creation
- event streaming
- connection management
- rate limiting
- request validation
- policy enforcement
- audit metadata
- routing to agent runtimes

The gateway should not contain the majority of agent business logic.

---

# 7. Agent Runtime

LangGraph is the first runtime.

Responsibilities:

- orchestration
- state transitions
- tool routing
- model invocation
- interrupts
- persistence integration
- resumability
- streaming
- retryable workflow steps

LangGraph's persistence/checkpointing model is especially useful for human-in-the-loop workflows, conversational state, fault recovery, and resumption. The runtime should expose these benefits without leaking LangGraph's internal API to SDK consumers.

References:

- https://docs.langchain.com/oss/python/langgraph/overview
- https://docs.langchain.com/oss/python/langgraph/persistence
- https://docs.langchain.com/oss/python/langgraph/event-streaming
- https://docs.langchain.com/oss/python/langgraph/interrupts

---

# 8. Agent Domain Model

The first public domain model should include:

```text
Agent
Conversation
Run
Message
ToolCall
ToolResult
ApprovalRequest
UI Surface
UI Action
Model
Provider
Memory
```

A conceptual relationship:

```text
Agent
  │
  ├── has many Conversations
  │
  └── executes Runs
          │
          ├── Messages
          ├── ToolCalls
          ├── UI Events
          ├── Approvals
          └── State transitions
```

A `Run` should be the primary unit of execution and observability.

---

# 9. Event Model

The event system is one of the most important contracts in the platform.

Example categories:

```text
run.started
run.status_changed
run.completed
run.failed
run.cancelled

message.started
message.delta
message.completed

tool.started
tool.progress
tool.completed
tool.failed

approval.required
approval.approved
approval.rejected
approval.edited

ui.surface.created
ui.surface.updated
ui.surface.completed

error
```

Do not expose raw provider-specific streaming events directly to clients.

Normalize them into platform events.

Provider-specific metadata may be included under namespaced metadata where useful.

---

# 10. Model Abstraction

The model layer should separate:

```text
Provider
Model
Capability
Routing Policy
Invocation
```

Example:

```text
Provider
  └── Model
        ├── capabilities
        ├── context limits
        ├── modalities
        ├── tool calling
        ├── structured output
        └── cost metadata
```

The agent should request capabilities rather than hard-code vendor assumptions where possible.

Example:

```text
needs:
  reasoning: true
  tool_calling: true
  vision: false
  max_context: 100k
```

The model router determines the concrete model.

---

# 11. Multi-Provider Strategy

The routing layer should support:

### Explicit selection

```text
Use model X.
```

### Capability selection

```text
Use any model with vision + tool calling.
```

### Policy selection

```text
Prefer low latency.
Prefer low cost.
Prefer reasoning quality.
Prefer specific providers.
Fail over when unavailable.
```

### Fallbacks

Example:

```text
Primary provider
      │
      ├── available → execute
      │
      └── unavailable
               │
               ▼
          secondary
```

Fallbacks must be carefully designed around idempotency and tool calls. Retrying a model call is very different from retrying a tool side effect.

---

# 12. MCP Integration

MCP is the primary external tool/context interoperability layer.

The platform should operate as an MCP client/host and allow one agent to work with multiple MCP servers.

Conceptually:

```text
Agent
  │
  ▼
MCP Client Manager
  │
  ├── MCP Server A
  ├── MCP Server B
  └── MCP Server C
```

MCP follows a host/client/server architecture and supports resources, prompts, and tools, with capability negotiation between clients and servers. See:

https://modelcontextprotocol.io/specification/2025-06-18/architecture

MCP tools are model-controlled capabilities. The platform must therefore enforce authorization and policy around tool exposure and invocation.

References:

- https://modelcontextprotocol.io/specification/2025-06-18/architecture
- https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- https://modelcontextprotocol.io/specification/2025-06-18/server/index
- https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

---

# 13. Kotlin Reference Backend

The first reference application backend will use Kotlin.

Possible stack:

```text
Kotlin
Spring Boot or Ktor
PostgreSQL
Redis where needed
MCP server
REST/gRPC as appropriate
```

The Kotlin backend is a **reference implementation**, not a required deployment technology for customers.

Example domain:

```text
CustomerService
ProductService
OrderService
PaymentService
```

The MCP server exposes safe, domain-oriented capabilities such as:

```text
searchProducts
getProduct
getCustomer
getOrder
createOrder
cancelOrder
```

Avoid exposing overly granular infrastructure operations.

Good tool:

```text
createOrder(...)
```

Bad tool:

```text
executeSql(...)
```

Prefer business capabilities over infrastructure capabilities.

---

# 14. Tool Design Principles

Tools should be:

- narrowly scoped
- typed
- deterministic where practical
- observable
- idempotent where possible
- explicit about side effects
- authorized independently
- safe to retry where possible

Every tool should communicate enough metadata for:

- authorization
- audit
- UI approval
- observability
- error handling

Tool schemas should be versionable.

---

# 15. Human-in-the-Loop

Human approval is a first-class platform capability.

Actions such as:

```text
send email
delete data
refund payment
place order
publish content
change permissions
```

may require approval.

Conceptually:

```text
Agent
  │
  ▼
Tool Call Proposed
  │
  ▼
Policy Engine
  │
  ├── safe → execute
  │
  └── approval required
          │
          ▼
      UI Approval
          │
     approve/reject/edit
          │
          ▼
       resume run
```

LangGraph interruptions and persistence provide a good execution primitive for this pattern.

The client should receive a normalized:

```text
approval.required
```

event and should not need to understand LangGraph interrupts directly.

---

# 16. GenUI / Agent-Driven UI

The GenUI system should treat UI as **declarative data**.

The agent may produce:

```text
Card
List
Table
Form
Select
DatePicker
Confirmation
Progress
Chart
```

but never arbitrary executable application code.

A conceptual flow:

```text
Agent
  │
  ▼
UI Description
  │
  ▼
Schema Validation
  │
  ▼
Client UI Registry
  │
  ▼
Native Rendering
```

The renderer maps protocol components to platform-native implementations.

---

# 17. UI Component Registry

The client should maintain an allow-listed component catalog.

Example:

```text
text
markdown
card
list
table
image
button
form
input
select
date_picker
progress
confirmation
```

A customer may eventually provide custom components.

However, custom components should be registered explicitly:

```text
agent UI protocol
       │
       ▼
component type
       │
       ▼
allow-listed registry
       │
       ▼
native component
```

Never dynamically execute arbitrary component code received from an agent.

---

# 18. A2UI Evaluation

A2UI should be treated as a strategic compatibility target.

Current A2UI concepts align strongly with this platform:

- streaming UI messages
- declarative components
- data binding
- progressive rendering
- platform-native renderers

Reference:

https://a2ui.org/concepts/overview/

Current specification status should be tracked carefully because versions are evolving. As of this architecture document, A2UI v0.9.1 is the current production release and v1.0 is a candidate.

Decision rule:

> Prefer interoperability with A2UI over creating a competing protocol unless our requirements demonstrably exceed A2UI or require a distinct abstraction.

---

# 19. State and Memory

Separate at least three concepts:

## Execution state

State required to resume a particular run.

```text
Run checkpoint
```

## Conversation state

State associated with a conversation/thread.

```text
Conversation history
```

## Long-lived memory

Information intentionally retained across conversations.

```text
User preferences
Domain facts
Long-term context
```

Do not assume that the LangGraph checkpoint store should become the entire platform memory architecture.

A platform-level interface may eventually resemble:

```typescript
interface MemoryStore {
  get(...)
  put(...)
  search(...)
  delete(...)
}
```

Implementations may include:

```text
PostgreSQL / pgvector
Redis
specialized vector databases
enterprise stores
```

---

# 20. Persistence

The system should persist enough information to:

- resume interrupted runs
- reconnect clients
- inspect execution
- support audits
- investigate failures
- recover from transient infrastructure failures

Avoid making the client responsible for authoritative agent state.

The server is authoritative.

---

# 21. Security Model

Security must be designed before broad tool adoption.

Key principles:

### Tenant isolation

Every request, run, memory record, tool call, and audit event must be associated with the correct tenant context.

### Least privilege

Agents should receive only the tools they need.

### Explicit side-effect policies

Tool metadata should distinguish:

```text
read-only
write
destructive
financial
external communication
```

### Approval

High-risk actions require explicit human authorization.

### Auditability

Record:

```text
who requested it
which agent ran
which model was used
which tool was invoked
what arguments were used
what policy applied
whether approval occurred
what happened
```

### Secrets

Never expose provider secrets, MCP credentials, or service credentials to client SDKs.

Client applications receive short-lived/session-scoped credentials where appropriate.

MCP HTTP authorization should follow the current MCP authorization requirements and OAuth 2.1 security guidance. Resource audience binding and PKCE are particularly important for public clients. See:

https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization

---

# 22. Observability

Every `Run` should have a traceable execution identity.

Minimum dimensions:

```text
tenant_id
agent_id
conversation_id
run_id
provider
model
tool
latency
token usage
estimated cost
status
error
```

A trace should conceptually look like:

```text
Run
 ├── Model Call
 │     └── token usage
 │
 ├── Tool Call
 │     └── MCP Server
 │
 ├── Model Call
 │
 ├── UI Event
 │
 └── Approval
```

Observability should be implementation-independent.

LangSmith may be used during development because it integrates with LangGraph, but the platform should retain ownership of its public telemetry model.

---

# 23. Reliability

Agent systems are distributed systems.

Plan for:

```text
provider timeout
provider rate limit
MCP timeout
MCP server unavailable
duplicate delivery
client reconnect
stream interruption
tool retry
agent process crash
partial execution
approval delayed for hours
```

Use:

- idempotency keys
- bounded retries
- exponential backoff
- explicit timeouts
- cancellation
- durable checkpoints
- run status transitions
- reconnect/resume semantics

Never blindly retry side-effecting operations.

---

# 24. API Design Principles

Prefer resource-oriented APIs.

Examples:

```text
POST   /v1/runs
GET    /v1/runs/{runId}
POST   /v1/runs/{runId}/messages
POST   /v1/runs/{runId}/cancel
POST   /v1/runs/{runId}/approval
GET    /v1/runs/{runId}/events
```

Avoid APIs tied directly to LangGraph terminology.

Do not create public contracts like:

```text
/langgraph/state
/langgraph/checkpoint
```

unless they are explicitly administrative/internal APIs.

---

# 25. Versioning

All public protocol contracts should be versionable.

Possible pattern:

```text
/v1/runs
/v1/events
```

For schemas:

```text
agent-event.v1.schema.json
ui-surface.v1.schema.json
```

Breaking changes should require a new version.

Prefer additive evolution where possible.

---

# 26. Package / Monorepo Direction

A likely repository structure:

```text
platform/
│
├── apps/
│   ├── gateway/
│   ├── agent-runtime/
│   ├── demo-kotlin/
│   └── demo-web/
│
├── packages/
│   ├── protocol/
│   ├── schemas/
│   ├── agent-core/
│   ├── model-abstraction/
│   ├── mcp-client/
│   ├── ui-protocol/
│   ├── react/
│   └── react-native/
│
├── examples/
│   └── ecommerce-agent/
│
├── docs/
│
└── tests/
```

Do not force every implementation into one language.

A reasonable split is:

```text
TypeScript
  ├── protocol definitions
  ├── schemas
  ├── client SDKs
  └── frontend-facing tooling

Python
  └── LangGraph runtime

Kotlin
  └── reference enterprise backend + MCP server
```

The protocols are the interoperability boundary.

---

# 27. Suggested Monorepo Tooling

For the TypeScript side, evaluate:

```text
pnpm workspaces
Turborepo or Nx
TypeScript
ESLint
Prettier
Vitest
Playwright
```

Do not add all tooling automatically. Choose only what supports the repository's actual scale.

For the Kotlin side, use the normal Gradle/Kotlin ecosystem and keep it independently buildable.

For Python/LangGraph, use a modern Python packaging and testing workflow.

---

# 28. Testing Strategy

Testing must exist at multiple levels.

## Protocol tests

Validate every schema and compatibility rule.

## Unit tests

Test:

```text
router
policy
event normalization
state transitions
tool adapters
UI validation
```

## Contract tests

Verify:

```text
runtime → gateway
gateway → SDK
MCP client → MCP server
```

## Integration tests

Use real:

```text
LLM provider
MCP server
database
```

where appropriate.

## End-to-end tests

Example:

```text
User
 → React app
 → agent run
 → model
 → MCP tool
 → approval
 → resume
 → UI result
```

## Failure tests

Simulate:

```text
provider timeout
MCP timeout
duplicate events
disconnect/reconnect
tool failure
agent crash
```

---

# 29. Demo Application

Use an e-commerce scenario because it exercises the architecture naturally.

Reference backend:

```text
Customer
Product
Cart
Order
Payment
```

Agent capabilities:

```text
search products
inspect product
inspect customer
manage cart
create order
cancel order
```

Example flow:

```text
User:
"Find a laptop under $1,500."
```

Agent:

```text
searchProducts()
```

UI:

```text
Product cards
[View]
[Add to cart]
```

Then:

```text
User:
"Add the second one and check out."
```

Agent:

```text
addToCart()
calculateShipping()
```

UI:

```text
Checkout surface
```

Then:

```text
approval.required
```

User approves.

Agent:

```text
createOrder()
```

This single demo demonstrates:

- multi-step reasoning
- tool calling
- MCP
- state
- streaming
- GenUI
- React
- React Native
- human approval
- resumability

---

# 30. MVP Scope

The initial MVP should be deliberately narrow.

### Runtime

```text
LangGraph
```

### Models

Support at least two providers so the abstraction is real.

### Tools

```text
MCP client
```

### Backend

```text
Kotlin demo backend
Kotlin MCP server
```

### Client

```text
React SDK
React Native SDK
```

### UI

A small component catalog:

```text
Text
Markdown
Card
List
Image
Button
Form
Select
Confirmation
Table
Progress
```

### Transport

```text
HTTP
SSE
```

### Security

```text
authenticated sessions
tool authorization
approval workflow
audit records
```

### Observability

```text
run IDs
structured logs
basic traces
token usage
latency
errors
```

Do not build multi-tenancy administration, marketplace features, complex memory infrastructure, or ten model providers in MVP.

---

# 31. Post-MVP Roadmap

## Phase 2 — Platform maturity

Add:

```text
model routing
provider fallback
persistent memory
policy engine
advanced approval rules
reconnection/resume
better telemetry
agent registry
```

## Phase 3 — Enterprise integration

Add:

```text
OIDC/OAuth
RBAC
organization/tenant management
secret management
audit export
private networking
enterprise MCP authentication
data retention policies
```

## Phase 4 — Ecosystem

Potentially add:

```text
Flutter SDK
additional runtimes
additional UI catalogs
custom component registries
agent templates
tool marketplace/registry
developer portal
```

---

# 32. Architecture Decision Records

Every major irreversible architectural decision should receive an ADR.

Examples:

```text
ADR-001: React + React Native as primary client SDK platforms
ADR-002: LangGraph as initial agent runtime
ADR-003: MCP as external tool interoperability layer
ADR-004: A2UI compatibility strategy
ADR-005: SSE vs WebSocket
ADR-006: Event versioning
ADR-007: Model provider abstraction
ADR-008: Memory architecture
ADR-009: Authentication model
ADR-010: Tool authorization model
```

The coding agent should consult ADRs before making architectural changes that affect public contracts.

---

# 33. Coding-Agent Working Rules

The coding agent should follow these rules.

## Rule 1 — Protect public boundaries

Do not expose internal framework types through public SDKs.

Bad:

```typescript
function run(graph: LangGraphGraph): ...
```

Good:

```typescript
function run(agentId: string, input: RunInput): ...
```

---

## Rule 2 — Prefer explicit contracts

Before implementing a new cross-service feature:

1. Define the domain model.
2. Define the event/schema contract.
3. Define compatibility expectations.
4. Then implement.

---

## Rule 3 — Keep adapters at the edge

Provider-specific and framework-specific code should live behind adapters.

```text
core
 └── abstractions

adapters
 ├── openai
 ├── anthropic
 ├── gemini
 ├── langgraph
 └── mcp
```

---

## Rule 4 — Never leak secrets

No provider API keys or MCP credentials in:

- mobile bundles
- browser bundles
- logs
- event payloads
- UI protocol messages

---

## Rule 5 — Treat tool calls as distributed side effects

Before retrying a tool, ask:

```text
Is this operation idempotent?
Can the request have partially succeeded?
Can the user be charged twice?
Can the record be duplicated?
```

---

## Rule 6 — Validate external data

Validate:

```text
LLM output
MCP responses
UI payloads
client events
external API payloads
```

Never blindly trust an agent-generated UI payload or tool arguments.

---

## Rule 7 — Design for cancellation

Users should be able to cancel long-running agent runs.

Cancellation must propagate through:

```text
client
 → gateway
 → runtime
 → model/tool operations
```

where technically possible.

---

## Rule 8 — Preserve observability

Every new subsystem should emit enough metadata to answer:

```text
What happened?
Why did it happen?
Which run?
Which agent?
Which model?
Which tool?
How long?
What failed?
```

---

# 34. Non-Goals

At this stage, the project is not:

```text
A replacement for every agent framework.
A replacement for every LLM API.
A generic workflow engine for all workloads.
An arbitrary code execution platform.
A UI framework.
A vector database.
A complete enterprise IAM product.
```

Those may integrate with the platform later, but they should not define the initial architecture.

---

# 35. Success Criteria

The architecture is successful when a developer can:

1. Add the SDK to an existing React application.
2. Connect the application to an agent.
3. Start a run.
4. Stream text and structured events.
5. Invoke MCP tools.
6. Render agent-generated native UI.
7. Require human approval for sensitive actions.
8. Resume interrupted executions.
9. Switch between LLM providers without changing application code.
10. Run the same agent experience from React Web and React Native.

The strongest proof is:

```text
Same Agent
Same Protocol
Same Business Capabilities
Different LLM
Different Client
Different Backend Implementation
```

while preserving the same developer-facing integration model.

---

# 36. Initial Architectural Hypothesis

The current hypothesis is:

```text
Protocol-first
+
LangGraph runtime
+
MCP interoperability
+
A2UI-compatible GenUI
+
React Web
+
React Native
+
Kotlin reference backend
+
multi-provider model router
```

This should be considered the **starting architecture**, not dogma.

The project should evolve through explicit experiments, benchmarks, ADRs, and integration tests.

---

# 37. Immediate Next Discussions

The next design sessions should tackle these in order:

### 1. Protocol contracts

Define:

```text
AgentEvent
Run
Message
ToolCall
ToolResult
ApprovalRequest
UISurface
UIAction
```

### 2. Model abstraction

Define:

```text
Provider
Model
Capability
Router
Invocation
Fallback
```

### 3. MCP architecture

Define:

```text
MCP server registry
connection lifecycle
tool discovery
tool authorization
credential handling
timeouts
retries
```

### 4. GenUI/A2UI architecture

Define:

```text
surface lifecycle
component catalog
data binding
actions
validation
streaming patches
custom components
```

### 5. Gateway API

Define:

```text
authentication
run creation
SSE
reconnection
cancellation
approval
```

### 6. Reference implementation

Build the smallest end-to-end vertical slice:

```text
React
  ↓
Gateway
  ↓
LangGraph
  ↓
Model
  ↓
MCP
  ↓
Kotlin
  ↓
UI event
  ↓
React renderer
```

Only after this path works should additional abstractions be generalized.

---

# 38. Guiding Mental Model

The platform should ultimately feel like:

```text
"Stripe for agent capabilities"
```

not because the product is identical to Stripe, but because the developer experience should be similarly simple:

```text
Existing Application
        │
        │ SDK
        ▼
   Agent Platform
        │
        ├── models
        ├── tools
        ├── state
        ├── approvals
        └── UI
```

The developer integrates a stable interface and does not need to rebuild agent infrastructure themselves.

---

# References

- LangGraph overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- LangGraph streaming: https://docs.langchain.com/oss/python/langgraph/event-streaming
- LangGraph interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- React Native: https://reactnative.dev/
- React Native New Architecture: https://reactnative.dev/architecture/landing-page
- React Native 0.84: https://reactnative.dev/blog/2026/02/11/react-native-0.84
- MCP architecture: https://modelcontextprotocol.io/specification/2025-06-18/architecture
- MCP tools: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MCP authorization: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- A2UI: https://a2ui.org/
- A2UI concepts: https://a2ui.org/concepts/overview/

---

## Document Status

This document is the initial architecture/vision baseline.

It is intentionally opinionated about boundaries but intentionally flexible about implementation details.

**Next artifact:** the concrete protocol/schema design.
