import type { Metadata } from "next"
import Link from "next/link"

import { FocusShell } from "@/components/focus-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = { title: "All pages" }

const groups = [
  {
    title: "App",
    links: [{ label: "Dashboard", href: "/" }],
  },
  {
    title: "Auth",
    description: "Sign-in itself lives in Keycloak",
    links: [
      { label: "Signed out", href: "/auth/signed-out" },
      { label: "Verify phone", href: "/auth/verify-phone" },
      { label: "Two-factor (redirect)", href: "/auth/two-factor" },
      { label: "Passkey (redirect)", href: "/auth/passkey" },
    ],
  },
  {
    title: "Onboarding",
    links: [
      { label: "Welcome", href: "/onboarding/welcome" },
      { label: "Your profile", href: "/onboarding/profile" },
      { label: "Create organization", href: "/onboarding/create-organization" },
      {
        label: "Organization details",
        href: "/onboarding/organization-setup",
      },
      { label: "Invite your team", href: "/onboarding/invite-team" },
      { label: "Choose a plan", href: "/onboarding/choose-plan" },
      { label: "Finish", href: "/onboarding/complete" },
    ],
  },
  {
    title: "Invitations",
    links: [
      { label: "Accept", href: "/invitations/accept" },
      { label: "Expired", href: "/invitations/expired" },
      { label: "Declined", href: "/invitations/declined" },
    ],
  },
  {
    title: "Organizations",
    links: [
      { label: "Choose organization", href: "/organizations/select" },
      { label: "Create organization", href: "/organizations/create" },
      { label: "Access denied", href: "/organizations/access-denied" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Profile", href: "/account/profile" },
      { label: "Settings", href: "/account/settings" },
      { label: "Security", href: "/account/security" },
      { label: "Sessions", href: "/account/sessions" },
      { label: "Connected accounts", href: "/account/connected-accounts" },
      { label: "Delete account", href: "/account/delete" },
    ],
  },
  {
    title: "Errors",
    links: [
      { label: "401 · Sign in required", href: "/errors/401" },
      { label: "403 · Access denied", href: "/errors/403" },
      { label: "404 · Not found", href: "/errors/404" },
      { label: "Account suspended", href: "/errors/account-suspended" },
      { label: "Organization suspended", href: "/errors/tenant-suspended" },
      { label: "Session expired", href: "/errors/session-expired" },
    ],
  },
]

export default function PagesDirectoryPage() {
  return (
    <FocusShell>
      <div className="flex w-full max-w-4xl flex-col gap-5 self-start">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold">All pages</h1>
          <p className="text-sm text-muted-foreground">
            Every screen in the organization app, grouped by flow.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.title} size="sm" className="gap-2">
              <CardHeader>
                <CardTitle>{group.title}</CardTitle>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex flex-col">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{link.label}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {link.href}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </FocusShell>
  )
}
