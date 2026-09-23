---
title: "ADR-0043: An Approval Chain is satisfied position by position by Platform Users other than the human who initiated the Run, is reassigned only by hand, and expires only at a deadline its Policy declares"
adr_id: ADR-0043
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [governance, security, identity, audit]
depends_on: [ADR-0009, ADR-0012, ADR-0015, ADR-0024, ADR-0030, ADR-0032, ADR-0035, ADR-0040]
---

# ADR-0043: An Approval Chain is satisfied position by position by Platform Users other than the human who initiated the Run, is reassigned only by hand, and expires only at a deadline its Policy declares

## Status

Accepted.

## Context

[`approval-workflows.md`](../40-governance/approval-workflows.md) owns everything that happens after
a Policy Enforcement Point returns `require_approval`, and settles most of it: what an Approval
Request carries, the Evidence Set, and six rules every chain obeys, C1 to C6. It left five questions
open and marked each as needing an ADR.

- **What satisfies a chain.** Unanimity, a quorum, the first decision or any one of, and whether one
  rejection in a parallel chain is decisive (section 5).
- **Separation of duties.** Whether the Principal who triggered an action may approve it, and
  whether one Principal may hold two positions in a chain (section 6).
- **Who may sit in a chain.** Whether an End User may, which would give a Session Token an approval
  authority (section 11).
- **What happens after raise.** Whether escalation, delegation and reassignment exist, and what
  triggers them (section 5).
- **Deadlines.** Whether a decision deadline exists at all, and whether a request may be re-raised
  after it expires (section 7).

For that reason `approval-request.v1` carries no satisfaction member, and
[`lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) section 3 draws `Expired`
as provisional. The product owner has decided all five, and two more that follow from decisions
taken beside this one.

- **Several matching rules.**
  [ADR-0035](adr-0035-cel-profile-for-policies-and-workflow-expressions.md) replaces
  [`policy-model.md`](../40-governance/policy-model.md) P4: a Policy Decision names every matching
  Policy version, and a gate requires the chain of every matching `require_approval` rule. How one
  Approval Request records more than one chain is registered in that document's section 9.
- **An `approval` Step whose Policies supply no chain.** `policy-model.md` V4 narrows a matching
  `allow` to `require_approval` at that boundary, so the gate exists whatever Policy says. An `allow`
  rule declares no chain, and nothing says what the gate is when no rule supplies one.

Seven facts bear on the choice.

- **The gate is what Orchestra sells.** [ADR-0015](adr-0015-governed-action-positioning.md) claims
  an explicit approval state where one is required, carrying the Evidence Set the model relied on.
  C3 already makes satisfaction affirmative, and C6 makes an ordered chain's progress recoverable.
- **Every action has exactly one Principal** (invariant I2 of
  [`domain-model.md`](../20-domain/domain-model.md)). The Principal a Run records at admission and
  the Principal who decides are both recorded, so they can be compared.
- **Identity is not equally strong for every subtype.** A Platform User authenticates at the
  Tenant's identity provider and is the seat-billable identity
  ([ADR-0009](adr-0009-meter-first-defer-tiering.md)). Orchestra never authenticates an End User. It
  trusts the customer backend's assertion, which
  [`threat-model.md`](../40-governance/threat-model.md) names boundary B1.
- **One Person per human, and never one Orchestra did not verify.**
  [ADR-0024](adr-0024-global-person-with-tenant-memberships.md) keys a Person to the subject the
  identity provider verified, so two Principals can stand on one Person, and keys a Person a
  customer's backend asserts to the asserting Tenant, which is never merged with another.
- **A Run pins its Policy versions for life**
  ([ADR-0012](adr-0012-policy-decisions-are-audit-records.md)). What a Policy declares about its
  chain holds for the whole of a suspension that may last days.
- **A suspended Run holds its version.** A `Retired` version cannot reach `Archived` while a Run
  pinned to it waits on a request nobody decides.
- **Four decisions recorded alongside this one bear on it.**
  [ADR-0030](adr-0030-platform-operator-and-observed-conditions.md) has a transition caused by an
  observed condition record its cause and no Principal.
  [ADR-0032](adr-0032-administrative-grants-are-orchestra-defined-roles.md) makes an administrative
  grant one of a closed set of Orchestra-defined roles, Tenant-scoped and optionally narrowed to a
  Workspace. ADR-0035 makes the verdict a function of every matching rule.
  [ADR-0040](adr-0040-run-outcomes-for-refusal-and-compensation.md) lets an `approval` Step declare
  rejection and expiry edges, and sends a refusal raised anywhere else where a `deny` at the same
  point would go — back to the model in an Agent Run, along a Workflow Step's refusal edge, and
  otherwise `Denied`.

Three neighbouring questions are settled in the documents rather than here, because each leaves the
control as strict as it already is, and only adopting one would need an ADR. An Audit Record names
only the Principal who acted, never one it acted for. Batching, standing approvals and automatic
approval below a bound are not permitted. And no break-glass path bypasses the gate.

Orchestra is pre-customer. No design partner has tested any of this, and every figure the decision
needs is one a Tenant writes into its own Policies.

## Decision drivers

- An approval is an affirmative decision by one accountable human, taken on the Evidence Set, or it
  is not a control (C3, C4).
- Separation of duties holds for a Tenant that writes no rule, and holds against the human rather
  than the credential. It is the control a security review asks about by name, and a default changed
  later silently changes what existing Policies mean.
- A gate that can never be satisfied is refused, never left open. A gate that can be satisfied but
  has nobody to satisfy it today has a governed way out, and no way out is a bypass of the gate.
- No figure is invented. A Tenant authors every duration and every count.
- Stricter first, because relaxing a rule later is additive, while tightening one that Policies
  already rely on is not.
- Everything that happens to a chain is reconstructible from the record (C1).

## Considered options

### What satisfies a chain

1. **Positions.** A chain's positions are ordered or parallel. Each position resolves, when the
   request is raised, to a set of eligible Principals, and one approval from any of them satisfies
   it. A parallel chain declares k of n, all positions by default. Any rejection at an open position
   is decisive.
2. **Unanimity** of every Principal the chain resolves to.
3. **The first decision** resolves the request.
4. **Positions with a quorum and no veto**, where a rejection only counts toward the quorum.

### Several matching rules

1. **One request carrying every matching rule's chain**, satisfied only when every chain is.
2. **One request carrying the strictest chain**, chosen by a rule that compares chains.
3. **One request per matching rule**, each gating the same action.

### An `approval` Step whose Policies supply no chain

1. **Refused at raise**, because the gate can never be satisfied.
2. **Raised with no position**, and left waiting for a reassignment.
3. **Refused at publication**, by a compiler that checks the Policies in force against the Step.

### Separation of duties

1. **A platform rule over Persons.** The human who initiated a Run never satisfies a position
   gating that Run, and one human counts at most once in a request, whichever Principal they act
   through. No Policy can override either.
2. **A platform rule over Principals**, under which one human acting as two Principals is not
   caught.
3. **Denied unless a Policy permits** self-approval.
4. **Permitted unless a Policy forbids** it.

### Who may sit in a chain

1. **Platform Users only.**
2. **End Users as well, within their own Conversation.**
3. **End Users as well, but never as a chain's only position.**

### What happens after raise

1. **Reassignment by hand only**, by a Principal holding an administrative grant, and never onto
   the Principal performing it.
2. **Nothing.** A request that cannot be decided waits.
3. **Reassignment by hand, and automatic escalation** as time passes.
4. **Reassignment by hand, and standing delegation**, such as an out-of-office rule.
5. **Reassignment by hand, with the reassigning Principal free to take the position.**

### Deadlines

1. **An optional deadline a Policy declares**, as an ISO 8601 duration, with no re-raise operation.
2. **No deadlines.**
3. **A mandatory platform maximum.**
4. **Automatic re-raise** after expiry.

## Decision

Option 1 in each of the seven questions.

### A chain is ordered or parallel positions

A Policy under which a request can be raised declares its chain: whether it is ordered or
parallel, and its positions.

- When the request is raised, each position resolves to the set of Principals eligible at it, and
  the chain is recorded as resolved (C1). A Policy writes who is eligible in the policy language,
  and no syntax is fixed here.
- A position is **open** while the request is `Pending` and the position is not yet satisfied. In
  an ordered chain a position opens only once every position ahead of it is satisfied (C6). In a
  parallel chain every position is open from the raise.
- A position is satisfied by one approval from any one of the Principals eligible at it.
- An ordered chain is satisfied when every one of its positions is. A parallel chain declares k, how
  many of its n positions must be satisfied, and requires all n where it declares none.
- The request resolves `Approved` the moment its chain is satisfied. Positions still open then close
  undecided.
- Any rejection by a Principal eligible at an open position is decisive. It resolves the request
  `Rejected`, whatever the other positions hold.
- Silence, unavailability and elapsed time never count toward satisfaction (C3). A position with no
  eligible Principal cannot be satisfied, and the request waits for a reassignment. A chain that
  cannot reach the positions it requires never resolves `Approved` (C2).

### One request carries every matching rule's chain

ADR-0035 replaces P4: the verdict is a function of every matching rule, and a gate requires the
chain of every matching `require_approval` rule. One Approval Request carries each of those chains,
and none stands in for another.

- The request resolves `Approved` only when **every** chain it carries is satisfied, each on its own
  terms — every position of an ordered chain, k positions of a parallel one.
- A rejection at any open position of any chain is decisive, and resolves the whole request
  `Rejected`.
- The **earliest** deadline any matching rule declares applies to the whole request. It is computed
  once, at raise, like any other deadline, and a chain carrying no deadline does not extend it.
- One Principal counts at most once across the whole request, not once per chain, and under
  separation of duties so does one human. A chain cannot be satisfied a second time by somebody a
  neighbouring chain has already spent.

In `approval-request.v1` the chains are an optional addition, MINOR under
[`VERSIONING.md`](../VERSIONING.md) section 6. The existing single-chain member is set only when
exactly one chain applies, which is the same narrowing ADR-0035 makes for `policy_version`.

### An `approval` Step whose Policies supply no chain is refused at raise

At the boundary of an `approval` Step a matching `allow` rule becomes `require_approval` under V4,
so the gate exists whatever the Tenant wrote. An `allow` rule declares no chain, so a Step gated
only by `allow` rules reaches raise with no chain at all.

- A gate to which no matching rule supplies a chain has no position, can never be satisfied, and is
  **refused at raise**. No Approval Request enters `Pending`, because none could ever be decided;
  the refusal is recorded with its causing Policy Decision and the proposed action, as any
  governance refusal is.
- The Run then does what it does after any refused gate at an `approval` Step: it follows the Step's
  rejection edge where the definition declares one, and otherwise ends `Denied` (ADR-0040). A
  `require_approval` rule that declares no chain reaches the same place from anywhere else, and the
  Run goes wherever ADR-0040 sends a refusal raised at that point.
- The Control Plane warns an author when an `approval` Step has no Policy version in force supplying
  a chain, because the warning is the cheap place to catch it. It is a warning and not a publication
  error: Policies and definitions are versioned and published separately, and a compiler that
  refused the Step would make one publication depend on the other's contents.
- This is not the case a chain with nobody eligible creates. There a chain **was** declared, so the
  request is raised, waits, and is reassigned under C11 — the deadlock separation of duties can
  cause, which has a way out.

### Separation of duties is the platform's rule, not a Policy's

- The Principal a Run records at admission, its initiating Principal, is never eligible at any
  position of a chain gating that Run.
- One Principal counts at most once across a request, however many chains it carries. Once a
  Principal has approved at one position, they are eligible at no other.
- Both rules compare the **Person** behind a Principal, where the identity provider verified that
  Person. Two Principals standing on the same verified Person count as one, so a human who initiated
  a Run through one Principal is never eligible through another, and one human satisfies at most one
  position.
- A Principal that no verified Person stands behind is compared as itself: a Service Account, which
  has none, and an End User whose Person a customer's backend asserts, which ADR-0024 keys to the
  asserting Tenant and never merges. Orchestra will not treat an assertion it did not verify as
  proof that two Principals are one human, in either direction.
- No Policy can permit what these rules refuse, and none is written into a Policy. All of them bind
  the chain as resolved at raise and every reassignment of it.

### Only Platform Users sit in a chain

A position resolves only to Platform Users. A Service Account, a Connector and an End User are
never eligible. A confirmation an End User gives inside the customer's application is input to a
Run, not an approval, and it satisfies no position.

### After raise, a chain changes only by reassignment, by hand

- A Principal holding an administrative grant for it, under ADR-0032, may reassign the chain of a
  `Pending` request. A reassignment changes which Platform Users are eligible at a position that is
  not yet satisfied.
- A reassignment never satisfies a position, never removes or alters a recorded decision, never
  changes the chain from ordered to parallel or back, and never lowers how many positions it
  requires.
- **A reassignment never makes the Principal performing it eligible.** It can no more add the
  reassigning Principal to a position of that chain than it can add the Run's initiating Principal,
  and the Person rules above bind it the same way. Another Principal holding the grant reassigns the
  position to them, so a reassignment onto oneself is two governed acts by two people or it does not
  happen.
- Every reassignment is an Audit Record naming its acting Principal, with its cause and the chain
  before and after. It amends the chain and never rewrites it, so the chain as resolved at raise
  stays reconstructible. An escalation is a reassignment like any other.
- Nothing reassigns a request on its own. There is no escalation on elapsed time and no standing
  delegation.
- Reassignment is also the way out when separation of duties leaves a position with nobody eligible.

### A Policy may declare a decision deadline

- The deadline is an ISO 8601 duration that a Policy declares beside its chain. A Policy that
  declares none gives its requests none, and Orchestra sets no default and no bound.
- The deadline runs from the raise. The instant it falls is computed once, at raise, from the Policy
  version the Run pinned, and is recorded with the request. Where several matching rules declare
  one, the earliest instant is the request's. A reassignment does not move it.
- When the deadline passes while the request is still `Pending`, the request resolves `Expired`,
  distinct from `Rejected` (D1). Expiry is an observed condition, so its record carries its cause
  and no Principal (ADR-0030), and it is never recorded as a decision (D2).
- There is no re-raise operation, and a terminal request is never reopened (D3). Proposing the
  action again raises a new Approval Request from a new verdict: where ADR-0040 sends the Run after
  a refused gate — a declared rejection or expiry edge, a Workflow Step's refusal edge, the next
  evaluation the model reaches in an Agent Run — or in a new Run (D3, J3). A decision that arrives
  after the request is terminal is refused.

### What stays undecided

- How the Expression Profile writes eligibility, k and a deadline. The positions above are what it
  has to express, and ADR-0035 leaves how a rule names its chain to this document's prose rather
  than to a syntax.
- Which role in ADR-0032's closed set carries reassignment.
- Whether an ordered chain's partial progress is a substate of `Pending` or an attribute of it,
  which C6 leaves representational.

### What this amends

- `approval-workflows.md` states these rules in sections 5 to 7, as C1 to C16 and D1 to D4. Its
  section 10 records that batching, standing approvals, automatic approval below a bound and
  break-glass are not permitted. Seven rows of its section 11 are discharged and none is added.
- `lifecycle-state-machines.md` section 3 draws `Expired` as settled rather than provisional, and
  two rows of its section 6 are discharged.
- `threat-model.md` T8 and section 14, `audit-model.md` A3 and sections 3, 5, 9 and 13,
  `policy-model.md` V2, V4, N2 and section 9, and `gateway-api.md` G18 and sections 5 and 9 are
  amended to match. The row ADR-0035 adds to `policy-model.md` section 9, on how one request records
  the chains of several matching rules, is discharged with it.
- `approval-request.v1` gains a chain's positions and how many it requires, every matching rule's
  chain, a decision's position and chain, chain amendments and the deadline. `policy-rule.v1` gains
  the chain and deadline a rule declares. Every addition is optional, and one constraint is relaxed
  so that a chain with nobody eligible can be recorded and then reassigned. Both are MINOR changes
  under [`VERSIONING.md`](../VERSIONING.md) section 6.
- The glossary's Approval Chain entry names positions and Platform Users.
- The rows asking these questions in `identity-and-access.md` section 12, `product-thesis.md`
  section 7 and the worked examples are discharged, and `personas.md` section 5 no longer holds the
  End User question open.
- `ui-protocol.md` AS1, AS5 and UA2, `event-protocol.md` section 11, `step-types.md` section 7,
  `execution-semantics.md` section 10, `reliability.md` section 11, `domain-model.md` sections 6 and
  11, `scope-and-non-goals.md` section 2.4 and the schemas README follow the rules above.

## Rationale

**Positions express four-eyes review without letting one absence block it.** Two positions, ordered
or parallel, are the four-eyes control a review asks for. Letting any one of several eligible
Platform Users serve a position means one absent approver blocks nothing. Unanimity of every
resolved Principal lets exactly that absence block every request. A first decision lets one person
decide every chain, and turns a parallel chain into a race. A quorum with no veto lets a qualified
"no" be outvoted, when the approver who noticed a supplier's changed bank details is the one whose
rejection matters. A decisive rejection is the conservative reading of a control, and satisfaction
stays affirmative (C3) and ordered progress recoverable (C6). A quorum without veto can be added
later as something a chain declares. Taking a veto away from Policies written against it could not.

**Every matching rule's chain is the only reading that cannot silently weaken a gate.** Under
ADR-0035 a Workspace Policy can add a gate and never remove a Tenant's, and the same logic holds one
level down: if a second matching rule could replace the first rule's chain, a Tenant could weaken a
gate by adding a rule, which is what precedence was made order-independent to prevent. Picking the
strictest chain needs a total order over chains that nothing supplies — an ordered pair against a
parallel three is not comparable — and would invent one. One request per matching rule splits an
Evidence Set across gates that can disagree about the same action, and V2 gives `require_approval`
exactly one request. Conjunction is also the additive direction: a Tenant that wants one chain to
suffice writes one rule.

**A gate nobody could ever satisfy is a refusal, and saying so early is the honest answer.** V4 is
deliberately conservative — more gates, never fewer — so an `approval` Step gated only by `allow`
rules must still gate, and the only chain available is none. Raising that request would suspend a
Run on a gate whose sole exit is a reassignment nobody has been told to make, which reads to an
operator as a stuck Run rather than as a misconfiguration. Refusing at publication would make a
Workflow version's validity depend on the Policy versions in force at that moment, and both are
published independently, so a Policy edit could retroactively invalidate a definition. Refusing at
raise puts the answer where the facts are, and ADR-0040 already says what a refused gate does to the
Run. The Control Plane's warning is where an author finds out before a Run does.

**Separation of duties has to hold for a Tenant that writes nothing, and against the human.**
Permitting self-approval unless a Policy forbids it fails silently: a Tenant that never writes the
rule has a gate the person taking the action can satisfy alone. Denying it unless a Policy permits
it lets any Tenant reopen the hole a review asks about. A platform rule gives every Tenant the same
answer. Comparing Principals alone would leave the rule trivially walked around by one human with
two Principals, which is the first thing an auditor tries; ADR-0024 already gives the join, because
one verified Person spans every Tenant a human belongs to and costs nothing to compare. It stops at
what Orchestra verified, because treating a customer backend's assertion as proof of identity would
let a Tenant merge two humans, or split one, by writing its own subject claims — and B1 is exactly
the boundary the gate is not allowed to rest on. The cost of the whole rule is deadlock where a
Workspace has one qualified approver, and reassignment pays that cost with a governed, attributed
act rather than a weaker rule. A Policy-permitted exception can be added later without changing what
existing Policies mean. Starting loose and tightening later would change them silently.

**An approval is only as strong as the identity behind it.** An End User's identity is whatever the
customer's backend asserts (B1), and no control Orchestra builds improves it. That is too weak for
the gate ADR-0015 sells. A Platform User authenticates at the Tenant's identity provider, and the
approver is already a Platform User on the seat-billable identity
([`personas.md`](../00-overview/personas.md) section 2.3). Admitting End Users within their
Conversation would also depend on what a Session Token's scope may contain, which is undecided.

**Reassignment by hand meets both constraints section 5 set, and needs nothing new.** Delegation
must record the delegate, and escalation must amend a chain rather than rewrite it. An audited
amendment with one acting Principal does both. Automatic escalation on elapsed time needs a deadline
and an amendment nobody made, on every escalation. Standing delegation creates a standing authority,
and an acted-for Principal the audit model does not record. Without either, a stuck request still
has a governed way out, so no bypass is needed, and both can be added later.

**A reassignment onto oneself is the whole control in one act.** The grant that reassigns is held
for operational reasons, and it is narrower than the judgement the gate exists to collect. If its
holder could add themselves to an open position, one person could route a request to themselves and
decide it, which is the self-approval the platform rule refuses, reached by a different door. The
record would show it, and showing is not preventing. Requiring a second holder of the grant costs a
message in the rare case and closes the door in every case, and it composes with the rule above:
whoever reassigns is compared as a human, not as a credential.

**A Tenant that wants a liveness promise can write one, and Orchestra invents none.** With no
deadlines, a suspended Run holds a `Retired` version undrainable forever, and a Tenant has no answer
for it. A mandatory platform maximum is a number nothing supports. Automatic re-raise is a loop
nothing bounds. An optional duration the Tenant authors answers the Tenant that needs it. The
earliest of several is the conservative composition, for the same reason a second chain can only
tighten a gate. Because there is no re-raise operation, D3 holds without exception: every new
request comes from a new verdict, captures its own Evidence Set, and never reopens an old one.

## Consequences

### Positive

- `approval-request.v1`, the approval surface and the `orchestra.approval.*` events have one
  satisfaction semantics to implement, and it does not change when a second rule matches.
- Separation of duties holds for every Tenant from its first Policy, against the human rather than
  the credential, so a security review gets a plain answer.
- A request nobody can decide has three governed ways out: reassignment, a declared deadline, or
  cancelling its Run. None of them bypasses the gate.
- A gate that could never be satisfied fails at raise with a refusal an operator can read, rather
  than as a Run stuck on a pending request.
- Every chain's history is reconstructible from Audit Records, from the raise through each
  reassignment and decision to the resolution.
- A Tenant that declares deadlines bounds how long its Runs can hold a `Retired` version.

### Negative

- A Tenant or Workspace with one qualified approver deadlocks on that approver's own Runs until an
  administrator reassigns them.
- One eligible Platform User can stop an action every other approver would accept, and nothing
  outvotes them.
- Reassignment is manual work. Nothing escalates on its own, so an unattended request waits for its
  deadline or for a person.
- Reassignment onto oneself takes two administrators, so a small Tenant whose only grant holder is
  also its only approver cannot resolve that deadlock without granting a second person the role.
- Reassignment remains a lever over the control. A Principal holding the grant can route an open
  request to a Platform User the Policy did not name, which the record shows but does not prevent.
- The Person rules compare only identity Orchestra verified, so one human acting as a Service
  Account and as a Platform User is still two actors to the platform.
- An approval Step gated only by `allow` rules refuses every Run that reaches it until a Policy
  supplies a chain, and the Control Plane's warning is the only thing between that and a surprise.
- Several matching gates can make a request nobody expected to be this hard to satisfy, because each
  rule's chain is added and none replaces another.
- An End User cannot approve from inside the customer's application. A customer that wants a user's
  confirmation collects it as input to a Run, and it is not an Orchestra approval.

### Neutral / follow-on work

- Express eligibility, k and the decision deadline in the Expression Profile, when it is specified.
- Name the role in ADR-0032's closed set that carries reassignment, where that set is enumerated.
- Specify reassigning a pending request's chain as an operation in the Gateway contract, carrying
  `Idempotency-Key`. Expiry and re-raise are not operations.
- Give the Control Plane a place to reassign a request, beside the approval surface, and the warning
  an `approval` Step with no chain earns.
- Name the `orchestra.approval.*` events for a satisfied position, a reassignment and an expiry,
  with the carrier that ADR-0004's second validation step settles.
- Specify how a duration with calendar components, such as months, is added to the raise instant.
- Decide how a Person is resolved on the enforcement path cheaply enough to compare at raise, which
  is Tenant User Management's contract rather than this decision's.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Separation of duties leaves a position with nobody eligible, and the request deadlocks | High | Medium | Reassignment by hand; a deadline where the Policy declares one; cancelling the Run |
| A Principal reassigns a position to a Platform User who should not decide it | Medium | High | Every reassignment names its acting Principal, carries its cause and both chains, and appears beside the decision it enabled; neither the initiating Principal nor the reassigning Principal can be made eligible, so routing a request to oneself takes a second grant holder |
| One human starts a Run as an End User or through a Service Account, and approves as a Platform User | Medium | High | Where one verified Person stands behind both Principals they count as one and the approval is refused; where the other Principal is a Service Account or an asserted End User, ADR-0024 gives no verified join, so a Policy narrowing who is eligible is the only control |
| A Person lookup on the enforcement path is slow or unavailable at raise | Medium | Medium | The comparison is over the Tenant's own Memberships, which resolve fail-closed under ADR-0024; a raise that cannot resolve a Person refuses rather than admits |
| An `approval` Step reached with no chain refuses Runs a Tenant expected to gate | Medium | Medium | The Control Plane warns at authoring; the refusal names the Step and its Policy Decision, and follows the rejection edge the author declared |
| Several matching rules make a request nobody can satisfy in practice | Low | Medium | Every chain is recorded against the Policy version that declared it, so the request shows which rule added which position |
| A decisive rejection stalls legitimate work | Low | Medium | The rejection is attributed to one Platform User; a quorum without veto is the named additive change |
| A deadline set too short expires requests nobody could have decided in time | Medium | Medium | `Expired` stays distinct from `Rejected` in audit and metering; the Tenant sets the figure and sees time-to-resolution |
| A decision and an expiry race | Medium | Medium | Whichever is recorded first resolves the request; a decision after it is terminal is refused, and the request never reopens |
| Reassignment by hand is slow enough that approvals move outside the platform | Medium | High | Automatic escalation and standing delegation are named additive changes; time-to-resolution shows the pressure |

## Revisit criteria

Reopen this decision in any of these cases:

- Design partners find deadlock under separation of duties routine rather than exceptional, and ask
  for a Policy-permitted exception.
- A customer's control framework requires a quorum that a single rejection cannot veto.
- Reassignment by hand is shown to push approvals outside the platform, which argues for automatic
  escalation or standing delegation.
- Requiring a second grant holder to reassign a position onto its holder is shown to block a real
  incident response rather than a hypothetical one.
- End User identity becomes something Orchestra authenticates rather than trusts, and a customer
  needs an End User's decision to count as an approval.
- A regulation or a contract requires a maximum decision time that a Tenant may not omit.

## References

- [`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) sections 5 to 7,
  10 and 11: the rules this states, and the register it discharges
- [`../40-governance/policy-model.md`](../40-governance/policy-model.md) V2 and V4: one request per
  `require_approval` verdict, and the boundary that never returns `allow`
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T8 and boundary B1: bypass
  of the gate, and End User identity as an assertion
- [`../20-domain/lifecycle-state-machines.md`](../20-domain/lifecycle-state-machines.md) sections 3
  and 4: the Approval Request lifecycle, and draining a `Retired` version
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) A3: attribution to the
  Principal who acted
- [`../30-protocol/schemas/approval-request.v1.schema.json`](../30-protocol/schemas/approval-request.v1.schema.json)
  and
  [`../30-protocol/schemas/policy-rule.v1.schema.json`](../30-protocol/schemas/policy-rule.v1.schema.json):
  the wire contracts this extends
- [ADR-0015](adr-0015-governed-action-positioning.md): the gate as the product
- [ADR-0024](adr-0024-global-person-with-tenant-memberships.md): the verified Person separation of
  duties compares, and the asserted one it never merges
- [ADR-0030](adr-0030-platform-operator-and-observed-conditions.md): attribution of observed
  conditions, which expiry is
- [ADR-0032](adr-0032-administrative-grants-are-orchestra-defined-roles.md): the administrative
  grants a reassignment is taken under
- [ADR-0035](adr-0035-cel-profile-for-policies-and-workflow-expressions.md): every matching rule
  contributes its chain, and P4 is replaced
- [ADR-0040](adr-0040-run-outcomes-for-refusal-and-compensation.md): where a refused gate sends the
  Run, and the edges an `approval` Step may declare
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339#appendix-A) Appendix A: the grammar of an
  ISO 8601 duration
