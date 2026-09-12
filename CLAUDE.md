# CLAUDE.md

Context for any agent or engineer joining this repository. Read this first, then
[`docs/README.md`](docs/README.md).

## What Orchestra is

A **multi-tenant SaaS governance and connectivity layer for enterprise AI agents**. It is *not* an
agent framework. LangGraph, the model providers and MCP are treated as commodity rails; Orchestra
owns the control surface over them — identity, policy, approval, audit, connectivity, workflow
definition and metering.

> Deterministic where determinism matters. Agentic where judgment matters. Governed at every step.

**Status: pre-implementation and pre-customer.** The repository is a specification set. No platform
code exists yet. `ui-template/` is a front-end starting point, not a running product.

## Decisions already made — do not relitigate

These are recorded in [`docs/adr/`](docs/adr/). Read the ADR before proposing anything that
contradicts it; if you disagree, write a superseding ADR rather than arguing in prose or code.

| ADR | Decision | Status |
| --- | --- | --- |
| 0001 | Multi-tenant SaaS; multi-tenancy is MVP, not Phase 3 | Accepted |
| 0002 | Enterprise segment, BYOK model credentials | Accepted |
| 0003 | Governance layer, not an agent framework | Superseded by 0015 |
| 0004 | AG-UI internally; the public contract is an Orchestra-versioned profile | Proposed |
| 0005 | LangGraph is a compilation target, never a public boundary | Superseded by 0016 |
| 0006 | Model layer is a credential and endpoint broker, not a router | Accepted |
| 0007 | Outbound connector for enterprise tool reachability | Proposed |
| 0008 | Customer workflows are declarative and compiled, not interpreted | Superseded by 0014 |
| 0009 | Meter from day one; defer tiering | Accepted |
| 0010 | A2UI as GenUI interchange, deferred | Proposed |
| 0011 | Tenant isolation: shared schema with row-level security | Accepted |
| 0012 | Policy Decisions are a class of Audit Record over versioned Policies | Accepted |
| 0013 | Policy Decision writes are fail-closed; other audit writes may degrade | Accepted |
| 0014 | Orchestra builds the run supervisor; the runtime is an execution substrate | Accepted |
| 0015 | Differentiate on governed, accountable actions, not on connectivity | Accepted |
| 0016 | The compilation target is the LangGraph library, never its server | Accepted |
| 0017 | Keycloak is the identity provider, self-hosted | Accepted |
| 0018 | Apache APISIX is the edge, in front of the Gateway | Accepted |
| 0019 | Run supervisor on PostgreSQL; Temporal is the named fallback | Accepted |

**Proposed** ADRs are not binding. Each names the validation step that would make it so — usually a
spike or a design-partner conversation. Do not build on a Proposed decision as though it were settled.

## Working rules

1. **Decisions live in ADRs, not prose.** If a document explains *why*, it links to an ADR. If no
   ADR exists, say the decision is unmade rather than implying consensus.
2. **Never leak the rails through a public contract.** No LangGraph, provider or MCP type appears in
   an API, schema, SDK or customer-facing document. Adapters live at the edge.
3. **Vocabulary is fixed.** Use [`docs/GLOSSARY.md`](docs/GLOSSARY.md) exactly. Introducing a synonym
   for an existing term is a defect, not a style choice.
4. **Contracts evolve additively.** Consumers must ignore what they do not recognise. See
   [`docs/VERSIONING.md`](docs/VERSIONING.md) rule R3.
5. **Policy, not prompts, is the security boundary.** Prompt injection is defended by rules the model
   cannot argue past. A financial action over threshold requires a human regardless of the argument.
6. **Never blindly retry a side effect.** A failed model call is safe to retry; a partially executed
   tool call is not.
7. **Tenant scoping is mandatory** on every record, event and log line.
8. **This is pre-customer.** Every enterprise assumption is a guess. Prefer decisions that stay cheap
   to reverse, and say plainly when something is unvalidated.

## Repository conventions

- **Versions** — every technology runs its **latest stable release, pinned exactly**; where a project
  has an LTS line, latest LTS. No floors, no ranges, no pre-releases. The pinned table is
  [`docs/10-architecture/tech-stack.md`](docs/10-architecture/tech-stack.md) section 1.1 — re-check
  against the registries, not memory, before relying on it.

- **Commits** — Conventional Commits with a **required scope**, enforced by commitlint. Types:
  `feat fix docs adr rfc refactor perf test build ci chore revert`. Scopes are listed in
  [`.commitlintrc.json`](.commitlintrc.json).
- **Branches** — `<type>/<kebab-description>`, short-lived, deleted on merge.
- **Pull requests** — the title becomes the squash subject and must itself be conventional. `main` is
  protected: pull request required, every check green, resolved conversations, linear history,
  signed commits, and no bypass for anyone — including the repository owner.
- **Documents** — YAML front matter is mandatory and CI-validated. Conventions in
  [`docs/README.md`](docs/README.md) section 3.
- **Published docs** — Mintlify serves `docs/` from `docs/docs.json`, which
  `scripts/build-docs-nav.mjs` generates: navigation from the tree and titles, plus one redirect per
  page mapping its `.md` URL onto the extensionless one. That redirect is what lets the documents
  keep GitHub-correct `../section/page.md` links; without it the site had 550 broken links.
- **Diagrams** — inline Mermaid, so they version and diff with the prose. CI parses every one.
  Mintlify renders these fences as diagrams on the published site.
  Browsable HTML renders in `docs/assets/diagrams/` are generated from them by
  `scripts/build-diagrams.mjs`; re-run it after changing a diagram, because CI fails on a stale page.

## Commands

```bash
# Run exactly what CI runs, in the order CI runs it
npx --yes markdownlint-cli2@0.23.2        # style — version must match .github/workflows/docs.yml
node scripts/validate-docs.mjs            # front matter, ADR index, doc ids, internal links
node scripts/open-questions.mjs --check   # every register defers to a document that exists
node scripts/validate-schemas.mjs         # wire schemas, against VERSIONING.md §6
node scripts/build-diagrams.mjs --check   # HTML diagram pages match the Mermaid; drop --check to rebuild
node scripts/build-docs-nav.mjs --check   # docs/docs.json matches the tree; drop --check to rebuild
npx --yes lychee --config lychee.toml .   # external links

# Mermaid parse check needs its dependencies present
npm install --no-save mermaid@11.4.1 jsdom@25.0.1 && node scripts/check-mermaid.mjs
```

## Gotchas that have already cost time

- **Pin tool versions, not action wrappers.** A lint run passed locally and failed in CI because
  `markdownlint-cli2@0.18.1` bundles markdownlint 0.38.0 while the action bundled 0.41.1, and MD013
  counts differently between them. CI now invokes the pinned tool directly. Keep the version in
  `CLAUDE.md`, `CONTRIBUTING.md` and the workflow identical.
- **Git does not track empty directories.** A directory that exists locally will not exist in a CI
  checkout, so links into it break. Every such directory carries a `.gitkeep` or a real README.
- **`globalThis.navigator` is getter-only on Node 22.** Assigning to it throws; use
  `Object.defineProperty`.
- **`ui-template/` is Next.js 16**, which differs from most training data. Read
  `node_modules/next/dist/docs/` before writing code there.
- **A repo-local `commit.gpgsign=false` beats the global setting, silently.** Signing is set up per
  [`CONTRIBUTING.md`](CONTRIBUTING.md), and did nothing at all until that override was removed. Read
  `git config --local --list` before debugging a signature that never appears.
- **A signing key is not an authentication key.** GitHub stores them separately, so the same public
  key must be registered a second time as a signing key, or commits stay Unverified and
  `required_signatures` rejects the push. Adding one over the API needs `admin:ssh_signing_key`.
- **`main` must stay green, which shapes three workflow jobs.** Any check that derives a commit
  range from the event payload breaks on a first push or a force-push — it reaches for the root
  commit's parent, then reports failure having scanned nothing. commitlint therefore runs on pull
  requests only, and the secret scan calls a pinned `gitleaks` binary in whole-history mode rather
  than the action wrapper. The weekly link check reports instead of failing, because rot on a
  third-party site would otherwise redden `main` with nobody having touched the repository.
- **A re-run cannot see a corrected pull request title.** `pr-title` reads
  `github.event.pull_request.title` from the event payload, and re-running a job replays the
  payload it was triggered with. `hygiene.yml` therefore listens for `edited` as well as the
  default pull_request types, so retitling actually re-checks.
- **A bare `#NN` in a commit body fails the build.** commitlint's parser treats `#` as an issue
  prefix, so `in #16` mid-paragraph is read as a footer and warns `footer-leading-blank` — and the
  hygiene job sets `failOnWarnings: true`. Write `pull request 16`, and note that commitlint exits
  **0** on warnings, so a local run that checks only the exit code will call it clean.
- **Mintlify will not serve a page named README.** README.md is treated as a repository readme: a
  directory redirects to it and then 404s, which was a live 404 on the home page and all 14 section
  indexes. Each directory therefore carries a generated `section-index.md` copy of its `README.md`,
  written and checked byte-for-byte by `scripts/build-docs-nav.mjs`, with explicit redirects from
  the directory URL and both README URLs; every other script in `scripts/` skips that filename so
  the copy is not counted as a second document. Two earlier attempts passed locally and failed in
  production — a symlink, which `mint dev` follows and the cloud build does not, and a file named
  `index.md`, which the cloud build would not serve beside a README. **Verify docs-site behaviour
  against the deployed site, not the dev server.**
- **Documentation examples trip secret scanners.** A realistic-looking UUID in an HTTP example was
  enough for gitleaks to flag `generic-api-key`. Placeholders in angle brackets, matching the
  `<session-token>` style already used, keep the scan at full strength with no allowlist to maintain.
- **Provisional names.** `@orchestra/*` is a placeholder and the unscoped npm name `orchestra` is
  taken. **`orchestra.dev` is not ours** — it is parked by a third party, with a lander on the apex
  and a null MX, so no address or URL under it works. Schema `$id`s are GitHub-hosted for that
  reason and stay that way, and `scripts/validate-schemas.mjs` fails CI if one drifts from its
  filename. Check `dig MX <domain>` before publishing any contact address.

## Front-end work

Duplicate [`ui-template/control-plane`](ui-template/) per surface. Do not build a dashboard from
scratch and do not share code across copies. See [`ui-template/README.md`](ui-template/README.md).

## Keeping this file honest

Update `CLAUDE.md` whenever a decision changes, a convention changes, or something costs you time
that a note would have prevented. It is loaded into every session, so keep it short and let it point
at [`docs/`](docs/) rather than repeat it. Reusable procedures belong in
[`.claude/skills/`](.claude/skills/), not here.
