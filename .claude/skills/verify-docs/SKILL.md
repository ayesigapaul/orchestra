---
name: verify-docs
description: Run the exact checks CI runs against the Orchestra documentation set, before pushing. Use whenever markdown, ADRs, schemas, diagrams or workflow files have been changed, or when a CI documentation check has failed and needs reproducing locally.
---

# Verify documentation locally

CI runs seven checks. Four of them can fail on documentation changes. Reproduce them **exactly** —
version drift between local and CI has already cost a debugging cycle here.

## Run in this order

Cheapest and most likely to fail first.

```bash
# 1. Structure — front matter, status values, doc_id uniqueness, ADR index
#    consistency in both directions, internal links resolving on disk
node scripts/validate-docs.mjs

# 2. Style — the version MUST match .github/workflows/docs.yml exactly
npx --yes markdownlint-cli2@0.23.2

# 3. Diagrams — parses every mermaid block with the real parser
npm install --no-save mermaid@11.4.1 jsdom@25.0.1
node scripts/check-mermaid.mjs

# 4. External links
npx --yes lychee --config lychee.toml .
```

Clean up afterwards so the tree stays tidy: `rm -rf node_modules package-lock.json package.json`.

## Before you conclude "it passes locally"

- **Check the version.** `grep markdownlint-cli2 .github/workflows/docs.yml` must match what you
  ran. Different bundled markdownlint cores count line length differently.
- **Check for untracked files.** `git status --porcelain`. Git does not track empty directories, so
  a directory that exists on your disk will not exist in a CI checkout and links into it will break.
  Every such directory needs a `.gitkeep` or a real README.

## Fixing what it finds

- `markdownlint-cli2 --fix` handles blank-line and spacing rules mechanically. Review the diff.
- MD013 line-length must be fixed by hand. Do not raise the limit to avoid wrapping.
- Never reflow `docs/archive/**` or `CODE_OF_CONDUCT.md` — both are excluded deliberately, being
  immutable and vendored respectively.
- A broken relative link is usually a forward reference to a document not yet written. Point at the
  containing directory instead, or write the document.

## After it is green

Commit with a required scope, e.g. `docs(governance): …` or `ci(ci): …`. See
[CONTRIBUTING.md](../../../CONTRIBUTING.md).
