# UI Template

A Next.js dashboard shell used as the **starting point for every Orchestra front end**. Duplicate it
per surface; do not build dashboards from scratch and do not import across copies.

## Stack

| Item | Version |
| --- | --- |
| Next.js | 16.2.6 (App Router) |
| React | 19.2.4 |
| Tailwind CSS | 4 |
| TypeScript | 5 |
| shadcn/ui | 61 components in `components/ui/` |
| Package manager | pnpm |

Also included: Prettier, ESLint, a `Dockerfile`, and Kubernetes manifests under `k8s/`.

## What it already provides

Routes for `auth`, `onboarding`, `organizations`, `account`, `invitations` and `errors`, plus the
application shell — header, sidebar, rail, focus shell, theme provider, status and onboarding cards.

These map directly onto the Control Plane described in
[`../docs/10-architecture/`](../docs/10-architecture/): tenant and workspace switching, member
invitation, account administration.

## Duplicating it

```bash
cp -R ui-template/control-plane apps/<surface-name>
cd apps/<surface-name>
# set "name" in package.json to @orchestra/<surface-name>
pnpm install
pnpm dev
```

Then delete the routes the new surface does not need. Starting from the full shell and removing is
faster and more consistent than adding.

## Rules

1. **Duplicate, never share.** Each surface owns its copy. Divergence is expected and cheaper than a
   premature shared package. Extract to a package only once three surfaces need the same thing.
2. **This is Next.js 16, not the Next.js in your training data.** APIs, conventions and file
   structure differ. Read `node_modules/next/dist/docs/` before writing code, and heed deprecation
   notices. See `control-plane/AGENTS.md`.
3. **Add shadcn components through the CLI**, so `components.json` stays authoritative.
4. **No agent-generated executable UI.** Agent-driven surfaces render declaratively through an
   allow-listed registry — see [ADR-0010](../docs/adr/adr-0010-a2ui-genui-interchange.md).
5. **Never put a tenant API key in this bundle.** Browsers receive short-lived session tokens minted
   by the customer's backend. See [SECURITY.md](../SECURITY.md).
