import type { Metadata } from "next"
import { Lock } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Sign in required" }

export default function Error401Page() {
  return (
    <StatusPage
      icon={Lock}
      code="401"
      title="Sign in required"
      description="You need to sign in to view this page. Your session may have ended."
    >
      <Button className="w-full">Sign in</Button>
      <Button variant="ghost" className="w-full">
        Go to homepage
      </Button>
    </StatusPage>
  )
}
