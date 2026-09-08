# Contributing to Orchestra

## Ground rules

1. **Decisions live in ADRs, not in prose.** If a document explains *why*, it links to an ADR. If no
   ADR exists, the decision has not been made — say so rather than implying consensus.
2. **ADRs are immutable once Accepted.** Supersede, never edit. The reasoning trail is the point.
3. **`main` is protected.** All changes arrive by pull request.
4. **Contracts are versioned.** Anything touching `docs/30-protocol/` follows
   [`docs/VERSIONING.md`](docs/VERSIONING.md).

## Workflow

```mermaid
flowchart LR
  I["Idea"] --> R["RFC in docs/rfc/"]
  R --> D{"Decision<br/>reached?"}
  D -->|no| R
  D -->|yes| A["ADR — Proposed"]
  A --> V{"Validation<br/>required?"}
  V -->|yes| S["Spike / design-partner<br/>conversation"]
  S --> AC["ADR — Accepted"]
  V -->|no| AC
  AC --> U["Update affected documents"]
  U --> C["Update docs/CHANGELOG.md"]
  C --> PR["Pull request"]
```

## Branches

Short-lived, branched from `main`, deleted on merge.

```text
<type>/<short-kebab-description>

feat/connector-enrolment
docs/policy-model
adr/0011-tenant-isolation-strategy
fix/broken-schema-links
chore/bump-actions
```

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), enforced in CI by
commitlint. A scope is **required**.

```text
<type>(<scope>): <Subject in sentence case>
```

**Types** — `feat` `fix` `docs` `adr` `rfc` `refactor` `perf` `test` `build` `ci` `chore` `revert`

**Scopes** — `overview` `architecture` `domain` `protocol` `governance` `workflows` `operations`
`delivery` `reference` `adr` `rfc` `schemas` `ci` `repo` `deps` `release`

```text
docs(governance): Add policy enforcement point specification
adr(adr): Record tenant isolation strategy as ADR-0011
ci(ci): Pin lychee action to a released version
```

A breaking change to a published contract is marked `!` after the scope and explained in a
`BREAKING CHANGE:` footer.

## Pull requests

- One logical change per pull request.
- The PR title must itself be a valid Conventional Commit — it becomes the squash-merge subject.
- Complete the checklist in the PR template. Do not delete items; mark them N/A with a reason.
- All CI checks must pass, and every review conversation must be resolved.
- Merge strategy is **squash and merge**. `main` keeps a linear history.

## Signed commits

Commits to `main` must be signed. Set up once:

```bash
git config --global commit.gpgsign true
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
```

Then add the same public key to GitHub as a **signing key** (separate from an authentication key).

## Documentation conventions

Every document under `docs/` carries YAML front matter — see
[`docs/README.md`](docs/README.md) §3. CI validates it.

Diagrams are Mermaid, inline, so they version and diff with the prose.

Requirement keywords (MUST, SHOULD, MAY) carry [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
meanings and are written in capitals.

## Running checks locally

```bash
npx --yes markdownlint-cli2@0.23.2          # style (same version CI runs)
node scripts/validate-docs.mjs              # front matter, ADR index, doc ids, internal links
npx --yes lychee --config lychee.toml .     # external links
```

## Releases

The documentation set is versioned in `docs/README.md` front matter and changelogged in
`docs/CHANGELOG.md`. A release is an annotated, signed tag on `main`:

```bash
git tag -s docs-v0.2.0 -m "Documentation set v0.2.0"
git push origin docs-v0.2.0
```
