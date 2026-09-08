import type { Metadata } from "next"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

import { StatusPage } from "@/components/status-page"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = { title: "Access denied" }

export default function OrganizationAccessDeniedPage() {
  return (
    <StatusPage
      icon={ShieldAlert}
      title="You don't have access to this organization"
      description="Your account isn't a member of Acme Inc, or your access was removed. You can request access or switch to another organization."
    >
      <Button className="w-full">Request access</Button>
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
