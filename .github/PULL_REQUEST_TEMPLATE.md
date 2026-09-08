## Summary

<!-- What changes and why. One paragraph. -->

## Type of change

- [ ] Documentation — new or revised content
- [ ] ADR — a decision is being recorded
- [ ] RFC — a proposal is being opened for discussion
- [ ] Contract — protocol, schema or API surface
- [ ] Repository / CI
- [ ] Other

## Related

<!-- Closes #123 · Implements ADR-00NN · Supersedes docs/... -->

## Checklist

Do not delete items. Mark anything inapplicable as `N/A` with a one-line reason.

- [ ] Front matter is present and correct on every changed document
- [ ] `docs/CHANGELOG.md` updated, if the change is user-visible
- [ ] Terminology matches [`docs/GLOSSARY.md`](../docs/GLOSSARY.md); no new synonyms introduced
- [ ] Decisions are recorded in an ADR rather than asserted in prose
- [ ] Diagrams are inline Mermaid and render correctly
- [ ] Internal links resolve
- [ ] `node scripts/validate-docs.mjs` passes locally

### If this touches a published contract

- [ ] Change is additive, or a MAJOR version bump is justified in the description
- [ ] [`docs/VERSIONING.md`](../docs/VERSIONING.md) compatibility rules are satisfied
- [ ] The must-ignore rule (R3) still holds for existing consumers
- [ ] Deprecation notice and sunset date recorded, if anything is being retired

### If this adds or changes an ADR

- [ ] Status is one of Proposed / Accepted / Rejected / Superseded / Deprecated
- [ ] A `Proposed` ADR states its validation step explicitly
- [ ] Superseded ADRs are cross-linked in both directions
- [ ] The index and dependency graph in [`docs/adr/README.md`](../docs/adr/README.md) are updated

## Reviewer notes

<!-- What deserves the most scrutiny? What did you deliberately leave out? -->
