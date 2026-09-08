---
name: new-adr
description: Author a new Architecture Decision Record for Orchestra, or supersede an existing one. Use when a decision is costly to reverse and affects more than one component or team, or when an accepted decision needs changing - accepted ADRs are immutable and must be superseded rather than edited.
---

# Write an ADR

## Decide whether one is warranted

Write an ADR when the decision is **costly to reverse** *and* **affects more than one component or
team**. Reversible implementation choices do not need one. If unsure, open an RFC in `docs/rfc/`
first and let the discussion produce the decision.

## Steps

1. **Take the next number.** `ls docs/adr/adr-*.md | tail -1`. Numbers are never reused, even for
   rejected ADRs.
2. **Copy the template** — `docs/adr/adr-template.md` → `docs/adr/adr-NNNN-short-kebab-title.md`.
   The `adr_id` in front matter must match the filename number; CI enforces this.
3. **Write it.** Guidance below.
4. **Update the index** — `docs/adr/README.md`: add a table row *and* a node in the Mermaid decision
   dependency graph, classed `accepted` or `proposed`. CI fails if the index and the files disagree.
5. **Update affected documents** and add a `docs/CHANGELOG.md` entry.
6. **Run** the `verify-docs` skill.

## Writing it well

- **Context states facts and forces, not preferences.** What is true today that makes this decision
  necessary now? Mark anything unverified explicitly as an assumption — this project is pre-customer
  and most enterprise claims are still guesses.
- **At least two real options.** A single option with two strawmen is not analysis.
- **Consequences must include negatives.** An ADR with no negative consequences has not been thought
  through. Name what this costs.
- **Record what it breaks.** If it contradicts an earlier document, say which section and why.
- **Revisit criteria are mandatory.** A decision with no revisit criteria is dogma.

## Status

`Proposed` until validated; `Accepted` once binding. **A Proposed ADR must name its validation step**
— a spike, a benchmark, or a design-partner conversation — and nothing may be built on it as though
it were settled.

## Superseding

Accepted ADRs are immutable. To change one:

1. Write a new ADR with `supersedes: [ADR-NNNN]`.
2. Set the old one's status to `Superseded by ADR-MMMM` and its `superseded_by` field.
3. Update both rows in the index and the dependency graph.

Never edit the reasoning of an accepted ADR. The trail is the point of the practice.
