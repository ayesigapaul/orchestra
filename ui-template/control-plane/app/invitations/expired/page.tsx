import type { Metadata } from "next"
import { Clock } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Invitation expired" }

export default function InvitationExpiredPage() {
  return (
    <StatusPage
      icon={Clock}
      title="This invitation has expired"
      description="Invitation links are valid for 14 days. Ask the person who invited you to send a new one."
    >
      <Button className="w-full">Request a new invitation</Button>
      <Button variant="ghost" className="w-full">
        Go to homepage
      </Button>
    </StatusPage>
  )
}
