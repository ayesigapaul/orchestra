import type { Metadata } from "next"

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

export const metadata: Metadata = { title: "Connected accounts" }

const providers = [
  {
    initial: "G",
    name: "Google",
    detail: "ayesiga@gmail.com · Connected 2 May 2026",
    connected: true,
  },
  {
    initial: "GH",
    name: "GitHub",
    detail: "Not connected",
    connected: false,
  },
  {
    initial: "M",
    name: "Microsoft",
    detail: "Not connected",
    connected: false,
  },
]

export default function ConnectedAccountsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>
          Sign in faster by linking accounts through your identity provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup>
          {providers.map((provider, index) => (
            <div key={provider.name} className="contents">
              {index > 0 && <ItemSeparator />}
              <Item>
                <ItemMedia>
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                    {provider.initial}
                  </span>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {provider.name}
                    {provider.connected && (
                      <Badge variant="secondary">Connected</Badge>
                    )}
                  </ItemTitle>
                  <ItemDescription>{provider.detail}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  {provider.connected ? (
                    <Button variant="ghost" size="sm">
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
                    </Button>
                  )}
                </ItemActions>
              </Item>
            </div>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  )
}
