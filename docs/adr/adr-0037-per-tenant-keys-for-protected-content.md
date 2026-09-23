---
title: "ADR-0037: Per-tenant data keys extend beyond credentials to protected content"
adr_id: ADR-0037
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [security, tenancy, data, architecture]
depends_on: [ADR-0002, ADR-0011, ADR-0021, ADR-0023]
---

# ADR-0037: Per-tenant data keys extend beyond credentials to protected content

## Status

Accepted. This extends [ADR-0002](adr-0002-enterprise-segment-and-byok.md) rather than replacing any
part of it: ADR-0002's key hierarchy stands, and this record widens what sits on it.

## Context

[ADR-0002](adr-0002-enterprise-segment-and-byok.md) accepts custody of enterprise model credentials
and names the price — "KMS-backed envelope encryption, per-tenant data keys, key rotation, and
provably no plaintext in logs or backups". [`threat-model.md`](../40-governance/threat-model.md)
control C6 carries that into a normative rule, and it covers credentials only.

Everything else a Tenant's work produces is protected by row-level security and by nothing else.
[ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md) is explicit about what that leaves: a
compromised application role reaches every Tenant subject to the context it sets, and ownership is a
bypass of the policy definition. The content in question is not incidental.
[`approval-workflows.md`](../40-governance/approval-workflows.md) section 4 says an Evidence Set
"will also routinely hold a Tenant's most sensitive business data, retained for an
audit-retention period **decided nowhere in this repository**".

Three registers carry the same question — `multi-tenancy.md` section 10,
[`threat-model.md`](../40-governance/threat-model.md) section 14 and
[`compliance-roadmap.md`](../70-delivery/compliance-roadmap.md) section 6 — and the threat model
rates the key hierarchy expensive to reverse. It is cheapest to decide now, because no such content
exists yet: Orchestra is pre-implementation, so nothing has to be re-encrypted and no query has to
be rewritten.

One decision downstream depends on it. `audit-model.md` section 6 holds erasure open between
redacting fields, crypto-shredding a key and a contractual carve-out, and that decision waits on
legal input. Crypto-shredding is not available at all unless the content sits under a key that can
be destroyed, so deciding the key hierarchy now keeps the leading option open rather than closing it
by omission.

`multi-tenancy.md` section 8 already writes "per-tenant data keys — scoped by key, not by row" into
the store table for credential and key custody, so the shape is named there; what is undecided is
whether anything but a credential sits under it.

## Decision drivers

- A second boundary under the content a customer's security review will ask about, independent of
  row-level security and of the application role.
- Identifiers, state and references stay queryable, because isolation and every join depend on them.
- Crypto-shredding stays available as an erasure path, without deciding erasure here.
- Cheapest while no such content exists, and expensive to add afterwards.
- One key hierarchy, ADR-0002's, not a second mechanism beside it.
- No dependency on a cloud provider's feature while the deployment target is undecided.

## Considered options

1. **Storage-level encryption only** — full-disk or tablespace encryption, one key for everything.
2. **Per-tenant data keys for designated content classes**, with identifiers left in plaintext and
   application-level encryption on those paths.
3. **Per-tenant keys for all tenant data**, so most queries run against ciphertext.
4. **Option 2 plus customer-managed keys**, where a Tenant supplies or controls its own key.

## Decision

**Option 2.** Per-tenant data keys extend beyond BYOK credentials to four designated content classes,
called **protected content** together:

| Class | What it is | Where it is held |
| --- | --- | --- |
| Evidence Sets | The exact inputs an Agent relied on when proposing an action | Approval Requests, and audit |
| Tool results | What a Tool origin returned to a Step Execution | Run state, audit, Evidence Sets |
| Retrieved context | Content fetched into a model context during a Run | Run state, audit, Evidence Sets |
| Messages | The turns of a Conversation between an End User and an Agent | Conversation state, audit |

Those are the glossary's own words for what an Evidence Set carries. The decision is that they are
protected **wherever they are held**, not only inside an Evidence Set: the same bytes in Run state,
in an Audit Record's inputs or in a payload store are protected content on the same terms.

**On ADR-0002's hierarchy, at the application level.** A key management service holds one
key-encryption key per Tenant. A data key per Tenant is wrapped by it and unwrapped in memory by the
service that needs it. Protected content is encrypted by the service that produces it, before it
reaches any store, and decrypted by the service that reads it — never by the datastore, so the
protection does not end where PostgreSQL's privileges do.

**Authenticated encryption, bound to its place.** Ciphertext is produced with an authenticated
encryption algorithm with associated data ([RFC 5116](https://www.rfc-editor.org/rfc/rfc5116));
AES-256-GCM ([NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final)) is the default. The
associated data binds the ciphertext to its Tenant and to the identifier of the record holding it,
so a ciphertext moved to another row, another record or another Tenant fails to decrypt rather than
decrypting into the wrong place. Each ciphertext carries the identifier of the key that produced it.

**Identifiers stay queryable.** Tenant identifiers, record identifiers, references between records,
timestamps, ordering keys, state, verdicts, Side-Effect Classes and every other member a query, a
row-level security policy or a Policy evaluation reads stay plaintext. Only the content classes above
are ciphertext. [ADR-0023](adr-0023-no-foreign-key-constraints.md)'s write policies check references
by identifier, and none of those identifiers is protected content, so nothing here weakens them.

**Key lifecycle follows [NIST SP 800-57 Part 1](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final).**
Rotating a Tenant's key-encryption key rewraps the data key and rewrites no ciphertext. Rotating a
data key is re-encryption, is not required on a schedule, and a retired data key stays available
until nothing references it. Destroying a Tenant's keys renders its protected content unreadable,
which is what makes crypto-shredding available — **and whether erasure is satisfied that way is not
decided here**: `audit-model.md` section 6 and `multi-tenancy.md` section 10 hold that open, and it
waits on legal input.

**Customer-managed keys are not adopted.** Option 4 is a design-partner question layered on this
decision, and this decision does not foreclose it: a Tenant's key-encryption key is already the unit
that would become customer-managed.

**What this amends.**

- ADR-0002's key hierarchy now carries protected content as well as credentials. Nothing ADR-0002
  decides is reversed.
- `multi-tenancy.md` section 8: the credential and key custody row widens, and protected content is
  named as scoped by key as well as by row.
- `multi-tenancy.md` section 10, `threat-model.md` section 14 and `compliance-roadmap.md` section 6:
  the register rows asking whether per-tenant keys reach data at rest are discharged.
- `threat-model.md` T5 gains a control: protected content is encrypted under the same per-tenant data
  keys, so a credential is no longer the only thing custody covers.
- The glossary gains *Protected Content*.

## Rationale

**Option 1 protects against a stolen disk and nothing else.** Storage-level encryption is
transparent to every process that reads the database, which is exactly the set of processes the
threat model is worried about, and it gives no per-tenant separation at all. It stays worth having
underneath, and it answers none of the three register rows.

**Option 3 makes the datastore useless for the work it does.** Row-level security is a predicate on
a tenant identifier, and Policy evaluation, reconciliation, lifecycle transitions and every audit
query read structured members. Encrypting those means either decrypting whole tables to answer a
query or inventing searchable encryption, which is a research problem, not a platform decision.

**Option 2 puts the boundary where the sensitivity is.** The classes chosen are the ones a customer
names in a security review, the ones an Evidence Set is built from, and the ones with no query
predicate on them — they are read whole, by identifier, on a path that already knows its Tenant. The
cost is a key unwrap on those paths and nothing on any other. It also produces a property
[ADR-0036](adr-0036-signed-merkle-checkpoints-over-audit.md) needs: shredding destroys a key, not the
bytes, so an audit log's leaves and proofs survive an erasure that redaction would break.

**Option 4 asks a customer a question no customer has been asked.** It is ADR-0002's own pattern —
decide what is cheap and reversible now, test the rest with a design partner — and it sits on top of
option 2 whenever it is wanted.

## Consequences

### Positive

- A Tenant's most sensitive content is unreadable to a process that has not unwrapped that Tenant's
  key, which a row-level security bypass alone does not give.
- A backup, a replica and a stolen dump carry ciphertext for every protected class.
- Crypto-shredding stays open as an erasure path, and it is the path that does not break ADR-0036's
  proofs.
- Customer-managed keys stay available as a later, additive step.
- Answers three register rows with one decision, before any such content exists.

### Negative

- **Application-level encryption is application-level responsibility.** A path that forgets to
  encrypt writes plaintext, and nothing below the application catches it — the same weakness
  `multi-tenancy.md` section 8 names for stores outside the datastore.
- **A key management service is now on the read path** for approvals, audit reads and Conversation
  history. Its availability bounds theirs, and its latency is on them.
- Protected content cannot be filtered, searched or indexed by the datastore. Any future search over
  Messages or Evidence Sets needs a design that does not exist.
- Losing a Tenant's keys loses that Tenant's protected content irrecoverably, which is the same
  property that makes shredding work.
- More key material to custody, rotate and audit than ADR-0002 alone required.

### Neutral / follow-on work

- Specify the envelope format, the associated data, the key identifier and the unwrap path in
  `docs/10-architecture/`, with the credential custody path `identity-and-access.md` owns.
- Add a CI control that the protected classes are written only through the encrypting path, on the
  model of `multi-tenancy.md` section 5's control. Naming discipline alone is what section 8 already
  calls strictly weaker than an engine-enforced policy.
- Decide where a key management service comes from with the deployment target, and how the local
  stack stands in for one.
- The erasure decision, and the audit-retention period, both still wait on input this record does not
  supply.
- Whether large protected content is materialised by value or by reference stays
  `approval-workflows.md` section 4's question; either way the bytes are protected.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A write path stores protected content in plaintext | Medium | High | One encrypting path per class, a CI control over the classes, and an isolation test per class before the first customer |
| The key management service is unavailable, and approvals cannot be read | Medium | High | Availability is designed with the deployment target; unwrapped data keys are cached in memory for a bounded time, never written down |
| A Tenant's data key is lost, and its protected content with it | Low | High | Key management service durability, rotation by rewrap rather than re-encryption, and a retired key retained until nothing references it |
| Ciphertext is moved between rows or Tenants to confuse a reader | Low | High | The Tenant and the record identifier are associated data, so a moved ciphertext fails to decrypt |
| Encryption is read as satisfying erasure before erasure is decided | Medium | Medium | This record states that it does not, and the erasure rows stay in their registers |
| The classes turn out to be the wrong four | Medium | Medium | The list is named in one place and additive; adding a class is a migration, not a redesign |

## Revisit criteria

Reopen this decision in any of these cases:

- A design partner requires customer-managed keys, which layers option 4 on this decision.
- A product requirement needs search or filtering over a protected class, which this design cannot
  serve.
- Measured key-unwrap cost on the approval or audit read path proves material against observed
  volume.
- A residency or sovereignty requirement makes the key's location, rather than the data's, the
  control a buyer asks about.

## References

- [ADR-0002](adr-0002-enterprise-segment-and-byok.md): BYOK custody, envelope encryption and
  per-tenant data keys
- [ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md): what row-level security does not cover
- [ADR-0036](adr-0036-signed-merkle-checkpoints-over-audit.md): why shredding leaves an audit log
  verifiable
- [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) sections 8, 9 and 10
- [`../40-governance/threat-model.md`](../40-governance/threat-model.md) T5 and C6
- [`../40-governance/approval-workflows.md`](../40-governance/approval-workflows.md) section 4: what
  an Evidence Set holds
- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) section 6: erasure, still open
- [RFC 5116](https://www.rfc-editor.org/rfc/rfc5116): authenticated encryption with associated data
- [NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final): AES-GCM
- [NIST SP 800-57 Part 1](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final): key management
