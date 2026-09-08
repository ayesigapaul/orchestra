---
name: new-dashboard
description: Create a new Orchestra front-end surface by duplicating the Next.js dashboard template in ui-template/control-plane. Use when building any new dashboard, admin console, or web UI for the platform - never scaffold one from scratch.
---

# Create a dashboard surface

Every Orchestra front end starts as a copy of `ui-template/control-plane`. Never scaffold a new
Next.js app, and never share code between copies.

## Stack you are inheriting

Next.js 16.2.6 (App Router), React 19.2.4, Tailwind 4, TypeScript 5, 61 shadcn/ui components, pnpm,
Prettier, ESLint, a Dockerfile and Kubernetes manifests.

Routes already present: `auth`, `onboarding`, `organizations`, `account`, `invitations`, `errors`,
plus the shell — header, sidebar, rail, focus shell, theme provider.

## Steps

```bash
cp -R ui-template/control-plane apps/<surface-name>
cd apps/<surface-name>
# set "name" in package.json to @orchestra/<surface-name>
pnpm install
pnpm dev
```

Then **delete the routes this surface does not need**. Starting from the full shell and removing is
faster and more consistent than adding.

Available scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`. Run `typecheck` and `lint`
before committing.

## Critical: this is not the Next.js you know

Next.js 16 has breaking changes against most training data — APIs, conventions and file structure all
differ. **Read `node_modules/next/dist/docs/` before writing code**, and heed deprecation notices.
This warning is also carried in `ui-template/control-plane/AGENTS.md`.

## Rules

1. **Duplicate, never share.** Divergence between surfaces is expected and cheaper than a premature
   shared package. Extract only when three surfaces genuinely need the same thing.
2. **Add shadcn components via the CLI**, so `components.json` stays authoritative. Do not paste
   component source by hand.
3. **No agent-generated executable UI, ever.** Agent-driven surfaces render declaratively through an
   allow-listed registry. See `docs/adr/adr-0010-a2ui-genui-interchange.md`.
4. **Never ship a tenant API key in a browser bundle.** The client receives a short-lived session
   token minted by the customer's backend. See `SECURITY.md`.
5. **Tenant context is not optional.** Every request the surface makes carries it.

## Where this fits

The Control Plane is the product surface Orchestra sells — agents, workflows, policies, approvals,
audit, connectors, usage. Its architecture is in `docs/10-architecture/`, and the reason it is the
differentiated part of the platform is in
`docs/adr/adr-0003-governance-layer-positioning.md`.
