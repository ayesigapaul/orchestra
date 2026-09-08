import type { Metadata } from "next"
import { TimerOff } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Session expired" }

export default function SessionExpiredPage() {
  return (
    <StatusPage
      icon={TimerOff}
      title="Your session has expired"
      description="For your security, you've been signed out after a period of inactivity. Sign in again to pick up where you left off."
    >
      <Button className="w-full">Sign in again</Button>
    </StatusPage>
  )
}
