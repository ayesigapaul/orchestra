import type { Metadata } from "next"
import { Monitor, Smartphone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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

export const metadata: Metadata = { title: "Sessions" }

const sessions = [
  {
    icon: Monitor,
    title: "Chrome on macOS",
    description: "Kampala, Uganda · 102.89.44.12 · Active now",
    current: true,
  },
  {
    icon: Smartphone,
    title: "Safari on iPhone",
    description: "Kampala, Uganda · 102.89.41.7 · 2 hours ago",
  },
  {
    icon: Monitor,
    title: "Firefox on Windows",
    description: "Nairobi, Kenya · 197.248.10.90 · 6 days ago",
  },
]

export default function AccountSessionsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>
          Devices currently signed in to your account.
        </CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            Sign out all others
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {sessions.map((session, index) => (
            <div key={session.title} className="contents">
              {index > 0 && <ItemSeparator />}
              <Item>
                <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
                  <session.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {session.title}
                    {session.current && (
                      <Badge variant="secondary">This device</Badge>
                    )}
                  </ItemTitle>
                  <ItemDescription>{session.description}</ItemDescription>
                </ItemContent>
                {!session.current && (
                  <ItemActions>
                    <Button variant="ghost" size="sm">
                      Revoke
                    </Button>
                  </ItemActions>
                )}
              </Item>
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
