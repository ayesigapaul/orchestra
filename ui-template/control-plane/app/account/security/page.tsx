import type { Metadata } from "next"
import {
  ExternalLink,
  Fingerprint,
  KeyRound,
  Plus,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"

export const metadata: Metadata = { title: "Security" }

export default function AccountSecurityPage() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sign-in &amp; password</CardTitle>
          <CardDescription>
            Credentials are managed by your identity provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Item variant="outline">
            <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
              <KeyRound />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Password</ItemTitle>
              <ItemDescription>
                Last changed 3 months ago · Managed in the account console.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm">
                Manage
                <ExternalLink data-icon="inline-end" />
              </Button>
            </ItemActions>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>
            A second step at sign-in keeps your account safe even if your
            password leaks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Item variant="outline">
            <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
              <ShieldCheck />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                Authenticator app
                <Badge variant="secondary">Enabled</Badge>
              </ItemTitle>
              <ItemDescription>
                Added March 2026 · 8 recovery codes remaining
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="outline" size="sm">
                Manage
                <ExternalLink data-icon="inline-end" />
              </Button>
            </ItemActions>
          </Item>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Sign in with your device&apos;s screen lock — no password needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ItemGroup>
            <Item>
              <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
                <Fingerprint />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>MacBook Pro · Touch ID</ItemTitle>
                <ItemDescription>
                  Added 12 Jun 2026 · Last used today
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="sm">
                  Remove
                </Button>
              </ItemActions>
            </Item>
            <ItemSeparator />
            <Item>
              <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
                <Fingerprint />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Pixel 9 · Fingerprint</ItemTitle>
                <ItemDescription>
                  Added 2 Aug 2026 · Last used 3 days ago
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button variant="ghost" size="sm">
                  Remove
                </Button>
              </ItemActions>
            </Item>
          </ItemGroup>
          <Button variant="outline" className="w-fit">
            <Plus data-icon="inline-start" />
            Add passkey
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
