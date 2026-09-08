import type { Metadata } from "next"
import { Ban } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Access denied" }

export default function Error403Page() {
  return (
    <StatusPage
      icon={Ban}
      code="403"
      title="Access denied"
      description="You don't have permission to view this page. If you believe this is a mistake, ask your administrator for access."
    >
      <Button className="w-full">Go to homepage</Button>
      <Button variant="ghost" className="w-full">
        Contact administrator
      </Button>
    </StatusPage>
  )
}
