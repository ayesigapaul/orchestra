import type { Metadata } from "next"
import { FileQuestion } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Page not found" }

export default function Error404Page() {
  return (
    <StatusPage
      icon={FileQuestion}
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist, was moved, or you don't have access to it."
    >
      <Button className="w-full">Go to homepage</Button>
      <Button variant="ghost" className="w-full">
        Report a problem
      </Button>
    </StatusPage>
  )
}
