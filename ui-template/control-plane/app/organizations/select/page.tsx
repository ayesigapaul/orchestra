import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"

import { FocusShell } from "@/components/focus-shell"
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
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"

export const metadata: Metadata = { title: "Choose an organization" }

const organizations = [
  { initial: "A", name: "Acme Inc", detail: "Owner · 12 members" },
  { initial: "G", name: "Gopher Group", detail: "Admin · 34 members" },
  { initial: "N", name: "Nile Labs", detail: "Member · 6 members" },
]

export default function SelectOrganizationPage() {
  return (
    <FocusShell>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Choose an organization</CardTitle>
            <CardDescription className="text-base">
              You&apos;re a member of {organizations.length} organizations.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <ItemGroup className="gap-1">
              {organizations.map((org) => (
                <Item key={org.name} variant="outline" render={<a href="#" />}>
                  <ItemMedia>
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                      {org.initial}
                    </span>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{org.name}</ItemTitle>
                    <ItemDescription>{org.detail}</ItemDescription>
                  </ItemContent>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Item>
              ))}
            </ItemGroup>
            <Separator className="my-1" />
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link href="/organizations/create" />}
              className="justify-start"
            >
              <Plus data-icon="inline-start" />
              Create a new organization
            </Button>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Signed in as ayesiga@example.com ·{" "}
          <a href="#" className="text-primary hover:underline">
            Sign out
          </a>
        </p>
      </div>
    </FocusShell>
  )
}
