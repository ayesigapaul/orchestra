import type { Metadata } from "next"
import Link from "next/link"
import { Building2, CheckCircle2, CreditCard, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export const metadata: Metadata = { title: "You're all set" }

const summary = [
  {
    icon: Building2,
    title: "Acme Inc",
    description: "orgs.example.com/acme",
  },
  {
    icon: Users,
    title: "3 invitations sent",
    description: "Teammates get an email to join.",
  },
  {
    icon: CreditCard,
    title: "Growth plan · Annual",
    description: "14-day trial, no card required.",
  },
]

export default function CompletePage() {
  return (
    <Card className="animate-in duration-500 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none">
      <CardContent>
        <Empty className="p-2">
          <EmptyHeader>
            <EmptyMedia
              variant="icon"
              className="size-10 rounded-full bg-primary/10 text-primary"
            >
              <CheckCircle2 className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-lg">Your workspace is ready</EmptyTitle>
            <EmptyDescription>
              Everything is set up. You can adjust any of this later in
              organization settings.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-md">
            <ItemGroup className="gap-1 text-start">
              {summary.map((item) => (
                <Item key={item.title} size="sm" variant="muted">
                  <ItemMedia variant="icon">
                    <item.icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{item.title}</ItemTitle>
                    <ItemDescription>{item.description}</ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            <div className="mt-2 flex w-full flex-col gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/" />}
                className="w-full"
              >
                Go to dashboard
              </Button>
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/onboarding/invite-team" />}
                className="w-full"
              >
                Invite more people
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </CardContent>
    </Card>
  )
}
