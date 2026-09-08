import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { AuthRedirectCard } from "@/components/auth-redirect-card"

export const metadata: Metadata = { title: "Two-factor verification" }

export default function TwoFactorPage() {
  return (
    <AuthRedirectCard
      icon={ShieldCheck}
      title="Two-factor verification"
      description="You'll continue to our secure sign-in service to verify your identity with your second factor."
      actionLabel="Continue to verification"
      fallbackLabel="Use a recovery code"
      footer={
        <>
          Having trouble?{" "}
          <a href="#" className="text-primary hover:underline">
            Contact your administrator
          </a>
        </>
      }
    />
  )
}
