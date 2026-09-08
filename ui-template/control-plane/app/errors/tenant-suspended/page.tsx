import type { Metadata } from "next"
import Link from "next/link"
import { Building2 } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Organization suspended" }

export default function TenantSuspendedPage() {
  return (
    <StatusPage
      icon={Building2}
      title="This organization is suspended"
      description="Acme Inc is currently suspended, usually because of a billing issue. Organization owners can restore access from billing settings."
    >
      <Button className="w-full">Go to billing</Button>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/organizations/select" />}
        className="w-full"
      >
        Switch organization
      </Button>
    </StatusPage>
  )
}
