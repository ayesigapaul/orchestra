---
title: "ADR-0029: Kafka carries facts between services, captured from each outbox by Debezium"
adr_id: ADR-0029
status: Accepted
date: 2026-09-13
deciders: [product-owner, platform-architecture]
consulted: []
informed: []
supersedes: []
superseded_by: []
tags: [architecture, protocol, services]
depends_on: [ADR-0011, ADR-0017, ADR-0020, ADR-0021, ADR-0026]
---

# ADR-0029: Kafka carries facts between services, captured from each outbox by Debezium

## Status

Accepted.

## Context

[ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md) has a fact another
service reacts to, such as a Membership granted or a Tenant suspended, leave its owner through a
transactional outbox. The event is written in the owner's own schema, in the same transaction as the
change it records. It is delivered at least once and consumed idempotently by its identifier, and
no order is promised across events. No service reads another's outbox table
([ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rule B4).

ADR-0026 named two candidates for the transport from an outbox to its consumers, a relay pushing
over HTTP and a broker, and deferred the choice until the first cross-service consumer exists.
[`containers.md`](../10-architecture/containers.md) section 12 registers the question as needing an
ADR. No consumer has been designed yet. The product owner chose to decide the transport now, so that
the first event type and its consumer are built against it, rather than against a relay that would
be replaced.

Four facts bear on the choice.

- **The outbox is a PostgreSQL table** ([ADR-0021](adr-0021-postgresql-is-the-datastore.md)). Its
  inserts are in the write-ahead log, which PostgreSQL streams through logical decoding.
- **Services connect through a transaction-mode pooler** (ADR-0021), and a replication connection
  cannot pass through one.
- **Every fact is tenant-scoped** by invariant I1, and
  [`multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 8 puts the tenant identifier in
  the addressing key of any store outside the row-level-secured datastore.
- **Every call is authenticated with the caller's own credential**, never by network location
  ([`http-conventions.md`](../30-protocol/http-conventions.md) HC17), and the product owner requires
  international standards for data formats.

## Decision drivers

- No fact is lost between a change and its delivery, without a dual write or a distributed
  transaction.
- A consumer that is down, or added later, still receives every fact it subscribes to.
- Tenant scoping, authentication and encryption hold on the transport as they do on a call.
- One transport for every service, with no relay code in each, which ADR-0020 rule B5 would forbid
  sharing.
- Established, open-source, self-hostable components, pinned exactly.
- Standard event metadata, not an envelope Orchestra invents.

## Considered options

1. **Kafka, fed by Debezium change data capture** from each outbox.
2. **A relay pushing over HTTP**, under HC16 to HC20.
3. **NATS JetStream**, fed by a relay that reads each outbox.

## Decision

**Option 1.**

**Capture.** [Debezium](https://debezium.io/)'s PostgreSQL connector reads each service's outbox
table from the write-ahead log, through logical decoding with PostgreSQL's built-in `pgoutput`
plugin. Its outbox event router turns each row into one Kafka record. Debezium runs on Kafka
Connect, with one connector for each service's outbox.

- PostgreSQL runs with `wal_level = logical`. Each service's migrations create a publication of its
  own outbox table and nothing else, and each connector holds one replication slot.
- The connector connects to PostgreSQL directly, not through PgBouncer, with a role of its own that
  may replicate and may read only that service's outbox. It is platform infrastructure rather than
  a service, and it reads no other table.
- A service may delete an outbox row in the transaction that inserts it. The write-ahead log keeps
  the insert, and the table stays small.
- The connector takes no snapshot of rows already in the table, because the outbox is not a history.

**Transport.** [Apache Kafka](https://kafka.apache.org/), self-hosted, in KRaft mode.

- There is one topic per event type and major version, named for the event's schema in
  `docs/30-protocol/schemas/`. A breaking change is a new major version on a new topic, as
  [`VERSIONING.md`](../VERSIONING.md) requires of every wire contract.
- Every record's key is the tenant identifier of the fact it carries (I1). The Tenant is the
  addressing key multi-tenancy.md section 8 requires, and a Tenant's facts share a partition.
- Order is still not promised, as ADR-0026 says. A consumer handles each fact idempotently by its
  identifier and never relies on arrival order.
- A topic keeps facts for at least as long as a consumer may be down. The figure is registered, not
  invented here.

**Format.** Each record is a [CloudEvents 1.0](https://github.com/cloudevents/spec) event in the
Kafka protocol binding's binary content mode.

- `ce_id` is the identifier consumers deduplicate by, `ce_source` the owning service, `ce_type` the
  event type and its major version, `ce_time` an RFC 3339 time, and `ce_specversion` is `1.0`.
- The tenant identifier also travels as the extension attribute `ce_tenantid`, because CloudEvents
  attribute names allow only lowercase letters and digits.
- The record's value is the event's JSON document, valid against its schema, with
  `content-type: application/json`.
- A `traceparent` header carries the W3C trace context of the transaction that wrote the event, so
  the consumer continues the owner's trace (HC12).

**Security.** No client is trusted for where it connects from.

- A service authenticates to Kafka with an access token that the identity provider issues to it
  through the client credentials grant, over SASL/OAUTHBEARER, as HC17 has it authenticate a call.
- Kafka ACLs let each connector write only its own service's topics, and each consumer read only the
  topics it consumes.
- Outside the local stack, every connection is encrypted with TLS.

**When it is built.** With the first event type and its consumer, not before. That work adds Kafka
and Kafka Connect with Debezium to the local stack, with the first outbox table, publication,
connector and event schema.

**What this amends.**

- ADR-0026's follow-on work on the transport is discharged. Its negative consequence that every
  publishing service carries a relay no longer holds, because Debezium is the relay.
- `containers.md` section 12's transport row is discharged, and multi-tenancy.md section 8
  registers the topics as a store.
- `http-conventions.md` section 8 names the transport, and `tech-stack.md` pins Kafka and Debezium
  and records logical decoding.

## Rationale

**Capturing from the log means no committed fact goes unpublished.** A row is in the write-ahead log
the moment its transaction commits, and Debezium reads it from there. The service writes nothing
but its own transaction. A relay polling the table, as options 2 and 3 need, is code each service
writes, tests and runs, because ADR-0020 forbids sharing it, and its poll interval trades latency
against load on the table. Kafka keeps each topic for its retention, so a consumer that was down, or
added later, reads what it missed. An HTTP push cannot offer that without the relay storing
everything itself.

**It is the most established pairing, and the heaviest.** Kafka with Debezium is the most widely
deployed form of the outbox pattern, with a documented outbox event router. Both are open source
and self-hostable, like the identity provider, the edge and the datastore. NATS JetStream is lighter
to run, but still needs a relay in each service. Option 2 needs no new infrastructure, which is its
real advantage and the reason the revisit criteria name it.

**The rules keep Kafka inside decisions already taken.** Tenant keys satisfy I1 and the store rule
of multi-tenancy.md section 8. OAuth over SASL keeps HC17's rule that a client authenticates as
itself. CloudEvents and W3C Trace Context are the standards for exactly this metadata, so Orchestra
invents no envelope.

## Consequences

### Positive

- A fact reaches Kafka when its transaction commits, with no delivery code in any service.
- A consumer can fall behind, restart or arrive later without losing facts within retention.
- One transport, one format and one security model for every service's facts.
- A trace continues from the transaction that wrote a fact into the consumer that handles it.

### Negative

- Orchestra operates Kafka and Kafka Connect, the heaviest components in the platform, before event
  volume is known.
- A stalled connector holds its replication slot, and PostgreSQL keeps write-ahead log for it until
  it resumes, which can fill the disk. Slot lag has to be monitored and bounded.
- The capture connection bypasses the pooler with a role that can replicate, a privileged path to
  guard.
- The local stack grows by two services with the first consumer.

### Neutral / follow-on work

- Specify the topic names, the CloudEvents mapping, the outbox table's columns and the connector's
  configuration in `docs/30-protocol/`, with the first event type.
- Set the topics' retention and the bound on replication slot lag with `reliability.md`.
- Build Kafka, Kafka Connect and Debezium into the local stack with the first event type and its
  consumer.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| A stalled connector fills PostgreSQL's disk with retained write-ahead log | Medium | High | Slot lag is monitored and `max_slot_wal_keep_size` bounds it; a connector past the bound is re-created and its gap reconciled |
| A fact is delivered twice | High | Low | Expected: delivery is at least once, and consumers deduplicate by `ce_id` |
| A consumer comes to depend on order | Medium | Medium | ADR-0026 promises none, and contract tests deliver facts out of order |
| A service reads another's facts without a grant | Low | High | Kafka ACLs per client, each authenticated with its own token |
| Kafka is too heavy for what the first consumers need | Medium | Medium | The revisit criteria name the HTTP relay, and the outbox table is the same under either |

## Revisit criteria

Reopen this decision in any of these cases:

- Once the first consumers are designed, their volume and fan-out are small enough that operating
  Kafka costs more than a relay pushing over HTTP would.
- The deployment target offers a managed Kafka-compatible service that meets the security and
  residency rules above.
- Capture through logical decoding conflicts with the mechanism for durable Policy Decision writes
  that [ADR-0013](adr-0013-fail-closed-policy-decision-writes.md) leaves open.

## References

- [ADR-0026](adr-0026-services-call-over-http-and-publish-through-an-outbox.md): the outbox, and the
  deferred transport
- [ADR-0020](adr-0020-monorepo-with-enforced-service-boundaries.md) rules B4 and B5, and
  [ADR-0021](adr-0021-postgresql-is-the-datastore.md): service boundaries, PostgreSQL and the pooler
- [`../10-architecture/multi-tenancy.md`](../10-architecture/multi-tenancy.md) section 8: stores
  outside the datastore
- [`../30-protocol/http-conventions.md`](../30-protocol/http-conventions.md) HC12 and HC17: trace
  context, and authenticating as oneself
- [Debezium's outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html)
- [CloudEvents' Kafka protocol binding](https://github.com/cloudevents/spec/blob/main/cloudevents/bindings/kafka-protocol-binding.md)
- [PostgreSQL logical decoding](https://www.postgresql.org/docs/current/logicaldecoding.html)
