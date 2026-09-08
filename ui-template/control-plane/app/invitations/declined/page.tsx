import type { Metadata } from "next"
import { CircleSlash } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Invitation declined" }

export default function InvitationDeclinedPage() {
  return (
    <StatusPage
      icon={CircleSlash}
      title="Invitation declined"
      description={
        <>
          You&apos;ve declined the invitation to join Acme Inc. Changed your
          mind? <a href="#">Contact the organization admin</a> to be invited
          again.
        </>
      }
    >
      <Button variant="outline" className="w-full">
        Go to homepage
      </Button>
    </StatusPage>
  )
}
