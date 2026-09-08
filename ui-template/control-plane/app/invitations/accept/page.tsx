import type { Metadata } from "next"
import { Building2 } from "lucide-react"

import { FocusShell } from "@/components/focus-shell"
import { Badge } from "@/components/ui/badge"
import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export const metadata: Metadata = { title: "Accept invitation" }

export default function AcceptInvitationPage() {
  return (
    <FocusShell>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
            <CardDescription className="text-base">
              Adaeze Obi (adaeze@acme.co) invited you to join their
              organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Item variant="outline">
              <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
                <Building2 />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  Acme Inc
                  <Badge variant="secondary">Member</Badge>
                </ItemTitle>
                <ItemDescription>
                  12 members · orgs.example.com/acme
                </ItemDescription>
              </ItemContent>
            </Item>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline">Decline</Button>
            <PendingButton href="/">Accept invitation</PendingButton>
          </CardFooter>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Signed in as ayesiga@example.com ·{" "}
          <a href="#" className="text-primary hover:underline">
            Switch account
          </a>
        </p>
      </div>
    </FocusShell>
  )
}
