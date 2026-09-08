import type { Metadata } from "next"
import { LogOut } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Signed out" }

export default function SignedOutPage() {
  return (
    <StatusPage
      icon={LogOut}
      title="You've been signed out"
      description="Your session has ended securely. Sign in again to get back to your workspace."
    >
      <Button className="w-full">Sign in again</Button>
      <Button variant="ghost" className="w-full">
        Return to homepage
      </Button>
    </StatusPage>
  )
}
