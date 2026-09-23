---
title: "ADR-0036: Audit immutability is also cryptographic, through periodic signed Merkle checkpoints per Tenant"
adr_id: ADR-0036
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [audit, security, governance, data]
depends_on: [ADR-0011, ADR-0012, ADR-0013, ADR-0021, ADR-0026, ADR-0027, ADR-0029]
---

# ADR-0036: Audit immutability is also cryptographic, through periodic signed Merkle checkpoints per Tenant

## Status

Accepted.

## Context

[`audit-model.md`](../40-governance/audit-model.md) rule A2 requires immutability to be
**structural**: the role that writes audit holds neither update nor delete privilege on it, which is
[ADR-0011](adr-0011-tenant-isolation-shared-schema-rls.md)'s reasoning applied a second time. A2 then
says plainly that whether immutability is *additionally* cryptographic — a hash chain, write-once
storage, external notarisation — is not decided, and section 13 registers the question.

Structural immutability is a privilege boundary, and it holds only while the privileges do. The
owner role that runs migrations can alter history undetectably; `multi-tenancy.md` section 9 already
names ownership as a bypass of the policy definition. A backup restored into place, a support path
that reaches the table and a compromised database host land in the same category. Nothing in the
repository lets a Tenant, an auditor or Orchestra itself tell an intact trail from an edited one.

Three things have changed since the question was registered.

- **The datastore half of the dependency is answered.** The register row waits on "a security review,
  and the datastore selection ADR-0011 constrains but does not make". The datastore is PostgreSQL
  ([ADR-0021](adr-0021-postgresql-is-the-datastore.md)). The comparison below is the security review
  the row asks for, on the precedent [ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md)
  set; an independent review before the first external deployment is still advisable.
- **Export needs it.** `audit-model.md` section 12 requires a Tenant to be able to obtain its own
  Audit Records, and observes that an exported record should be verifiable as unaltered — "A2's
  cryptographic question again". An export a compliance reviewer cannot verify independently is read
  as a trail they cannot check.
- **Records no longer arrive in one order.** [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md)
  and [ADR-0029](adr-0029-kafka-carries-facts-captured-by-debezium.md) have facts leave a service
  through an outbox and reach consumers over Kafka, so records written by several services do not
  arrive in the order they occurred. A7 already separates the trail's ordering key from wall-clock
  time for that reason.

Two costs bound any mechanism. **The write path is already expensive**: ADR-0013 puts a fail-closed
Policy Decision write ahead of every gated action, and
[ADR-0016](adr-0016-compile-to-the-langgraph-library.md) accepts a checkpoint write beside it — "two
durable writes per Step is the price of a trail that means anything". A third is not free. And
**erasure is undecided**: `audit-model.md` section 6 holds redaction, crypto-shredding and a
contractual carve-out all open, pending legal input, so nothing here may assume a record's bytes are
permanent.

## Decision drivers

- A Tenant, an auditor and Orchestra can each tell an intact trail from an edited one, without
  trusting whoever holds the database.
- An export is verifiable by its recipient, using published structures rather than Orchestra's word.
- Nothing is added to the latency path of a governed action.
- Records that arrive out of order through an outbox do not serialize on each other.
- Standard structures with existing verifier implementations, not an Orchestra invention.
- One more signing key at most, on custody Orchestra already carries (ADR-0027).
- No dependency on a cloud feature while the hosting target is undecided.

## Considered options

1. **Structural only.** Leave A2 as it stands; anyone with owner access can alter history
   undetectably.
2. **A per-record hash chain per Tenant**, each record naming the digest of the one before it.
3. **Periodic signed Merkle checkpoints per Tenant** over records in arrival order, included in
   exports.
4. **A write-once object-storage copy**, using a cloud provider's object-lock feature.

## Decision

**Option 3.** Audit immutability is structural *and* cryptographic.

**One append-only log per Tenant.** Every Audit Record that Tenant holds is a leaf of one Merkle
tree, in the order the audit store received it. Arrival order is the log's own order: it is neither
A7's ordering key nor `occurred_at`, and the log makes no claim about when anything happened. A
record's leaf is computed over its canonical serialization — the same bytes an export carries,
canonicalized under [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), the JSON Canonicalization
Scheme — so a verifier reconstructs a leaf from the export alone.

**The log structure is RFC 9162's.** [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162), Certificate
Transparency version 2.0, defines the Merkle tree, its leaf and node hashing with distinct prefixes,
its inclusion proof and its consistency proof. Orchestra uses that structure and those proofs, with
SHA-256 ([RFC 6234](https://www.rfc-editor.org/rfc/rfc6234)) as the hash. Orchestra is not a
Certificate Transparency log, does not gossip, and publishes nothing to any third party; it takes the
data structure and the proof formats, which have verifiers already written against them.

**A checkpoint is a signed tree head.** At an interval, and per Tenant, Orchestra produces a
checkpoint carrying the Tenant, the tree size, the root hash at that size, and the time it was
produced, signed with an asymmetric JOSE algorithm as ADR-0027's tokens are. A checkpoint is not an
Audit Record: nothing acted, and it attests to the log rather than to an act. It is held beside the
records it covers, retained at least as long as they are, and never edited — a later checkpoint is
appended, never a correction of an earlier one.

**A separate key, on ADR-0027's custody.** The checkpoint signing key is not the Principal Token
signing key. In production it is held where it cannot be read, in a key management service or a
hardware security module; in the local stack it is held in a file. The public keys are published as
a JWK Set on the same terms ADR-0027 sets, so a verifier needs no credential to check a checkpoint,
and key lifecycle follows [NIST SP 800-57 Part 1](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final).

**Exports carry their checkpoints.** An export over a range carries the records, every checkpoint
covering them, and the inclusion and consistency proofs a recipient needs to verify that each record
is in the log, and that each checkpoint extends the one before it. Section 12's completeness
requirement gains a second mechanical half: a recipient can now show that an export is not missing a
record the log contains, because the tree size in a checkpoint counts leaves.

**Nothing joins the write path.** The log is built by reading the audit store in arrival order, after
the fact. No write blocks on a hash, no append serializes on another, and a record that arrives late
through an outbox is a leaf where it arrives. The cost is detection latency: an alteration made
before a record is covered by a signed checkpoint is not detectable by this mechanism, and one made
after it is. **The checkpoint interval sets that window, and no interval is decided here** — the
trade is detection latency against signing and storage cost, and it needs observed write volume.
`audit-model.md` section 13 registers it.

**Verification is offered, not merely possible.** Orchestra verifies its own logs on a schedule, and
a Tenant can verify an export it holds. A verification that fails is an incident, not a report.

**What this amends.**

- `audit-model.md` A2: immutability is structural and cryptographic, and the sentence leaving the
  second open goes.
- `audit-model.md` section 12: an exported record's verifiability is answered, and an export carries
  the checkpoints and proofs that answer it.
- `audit-model.md` section 13: the cryptographic-immutability row is discharged; a row for the
  checkpoint interval takes its place.
- `audit-record.v1`'s comment that no member expresses cryptographic immutability now says why none
  does: the log is over records, not inside one.
- The glossary gains *Audit Checkpoint*.

## Rationale

**Option 1 leaves the product claim unsupported.** Audit is a product surface
([ADR-0003](adr-0003-governance-layer-positioning.md), `audit-model.md` section 8), and a surface
whose integrity rests on Orchestra's own privilege discipline is exactly what a security review
probes. The cost of closing it is now low enough that leaving it open is a choice rather than a
constraint.

**Option 2 pays on the write path for a property option 3 also gives.** A per-record chain has to
decide each record's predecessor at write time, which serializes appends per Tenant and turns a
partitioned, outbox-fed ingest into an ordered one. ADR-0029 makes out-of-order arrival normal, and
ADR-0013 and ADR-0016 already spend the write path's budget. A chain also detects tampering only when
someone walks it, so its advantage over a checkpoint is a window, bought at a structural cost.

**Option 3 detects the same tampering for the price of a periodic read.** The Merkle structure gives
what a chain gives — any alteration below a signed root changes the root — and adds two things a
chain does not: an inclusion proof, so a recipient can verify one record without holding the log, and
a consistency proof, so a recipient can verify that a new checkpoint extends the log they saw before
rather than replacing it. Both are what makes an export verifiable to someone who does not trust
Orchestra, which is section 12's actual requirement.

**Option 4 buys a cloud feature before the cloud is chosen.** Object lock is a real control, but it
binds the audit design to one provider's feature while `tech-stack.md` leaves the deployment target
open, and it still gives a recipient no way to verify an export. It stays available later as
defence in depth under a checkpointed log, and the two do not conflict.

## Consequences

### Positive

- An alteration of any covered record is detectable by anyone holding a checkpoint, Orchestra
  included, and a Tenant no longer takes the trail's integrity on trust.
- An export is verifiable by its recipient with published proof formats and existing verifiers.
- Nothing is added to the latency of a governed action, and out-of-order arrival stays free.
- Crypto-shredding stays available as an erasure path: destroying a key leaves the ciphertext, so
  the leaf and every proof over it remain valid
  ([ADR-0037](adr-0037-per-tenant-keys-for-protected-content.md)). Redacting a record's bytes does
  not, which is now a fact the erasure decision has to weigh.
- ADR-0011's promotion path gains the property it needs: a relocated Tenant's trail is movable with
  its checkpoints, and a break in it is visible.

### Negative

- **A detection window by design.** Tampering with a record not yet covered by a signed checkpoint
  is not caught by this mechanism. The window is the interval, and the interval is undecided.
- **A second signing key to custody and rotate**, with the same seriousness as ADR-0027's. A key an
  attacker holds lets them re-sign a rewritten log.
- Checkpoints, proofs and the log's internal nodes are storage that grows with the trail, on top of
  retention that is itself undecided.
- Detection is not prevention. The mechanism says a trail was altered; it does not stop the alteration
  and it does not recover the original record.
- Erasure is now harder to design, not easier: any erasure that rewrites a covered record's bytes
  breaks verification, so the erasure decision inherits a constraint it did not have.

### Neutral / follow-on work

- Specify the log, the canonical serialization, the checkpoint's members, the export bundle and the
  verification procedure in `docs/30-protocol/`, alongside the export format section 12 still lacks.
- Choose the checkpoint interval when write volume is observable, and record it where operational
  figures live.
- Decide where the log and its checkpoints are held. Held in the datastore under the same forced
  row-level security, they add no store outside it; held anywhere else, `multi-tenancy.md` section 8's
  two rules attach — the tenant identifier in the addressing key, and a registry entry.
- Build verification with the export surface, and not before.
- The erasure decision `audit-model.md` section 6 holds open now has this constraint as an input.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| The checkpoint signing key is stolen, and a rewritten log is re-signed | Low | High | A key management service or hardware module holds it; it is separate from ADR-0027's key; rotation is routine and retired keys stay published until every checkpoint they signed is superseded |
| Tampering inside the interval is never detected | Medium | Medium | Structural immutability still applies; the interval is chosen against observed volume; verification runs on a schedule rather than on request |
| Verification is built, then never run | Medium | High | Orchestra verifies its own logs on a schedule, and a failed verification is an incident |
| An erasure design later requires rewriting covered records | Medium | High | The constraint is recorded now, before any erasure path is chosen, and crypto-shredding is the path that does not break proofs |
| The canonical serialization drifts from what an export carries, and proofs stop reproducing | Medium | High | One serialization, RFC 8785, specified once in the protocol document and exercised by the export contract test |
| The log's storage grows faster than the records it covers | Low | Medium | Internal nodes are recomputable from leaves; only checkpoints and leaves need retaining |

## Revisit criteria

Reopen this decision in any of these cases:

- A customer or regulator requires notarisation by a third party, or a published log, rather than a
  signed checkpoint Orchestra holds.
- The erasure decision settles on a path that rewrites a covered record's bytes, which this structure
  cannot absorb.
- Measured checkpoint production costs more than the detection window it buys is worth.
- The datastore or the deployment target gains a write-once guarantee strong enough to make the log
  redundant rather than complementary.

## References

- [`../40-governance/audit-model.md`](../40-governance/audit-model.md) A2, sections 6, 12 and 13:
  immutability, erasure, export and the register row this discharges
- [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) and
  [ADR-0016](adr-0016-compile-to-the-langgraph-library.md): the two durable writes already on a Step
- [ADR-0021](adr-0021-postgresql-is-the-datastore.md): the datastore half of the register's dependency
- [ADR-0027](adr-0027-tenant-user-management-signs-principal-tokens.md): signing-key custody and the
  published JWK Set
- [ADR-0029](adr-0029-kafka-carries-facts-captured-by-debezium.md): why arrival order is not
  occurrence order
- [RFC 9162](https://www.rfc-editor.org/rfc/rfc9162): the Merkle log, inclusion and consistency proofs
- [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785): JSON Canonicalization Scheme
- [RFC 6234](https://www.rfc-editor.org/rfc/rfc6234): SHA-256
- [NIST SP 800-57 Part 1](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final): key management
