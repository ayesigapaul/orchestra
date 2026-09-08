import type { Metadata } from "next"
import { UserX } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Account suspended" }

export default function AccountSuspendedPage() {
  return (
    <StatusPage
      icon={UserX}
      title="Your account is suspended"
      description="An administrator has suspended this account. If you think this is a mistake, contact support and we'll help you sort it out."
    >
      <Button className="w-full">Contact support</Button>
      <Button variant="ghost" className="w-full">
        Sign out
      </Button>
    </StatusPage>
  )
}
