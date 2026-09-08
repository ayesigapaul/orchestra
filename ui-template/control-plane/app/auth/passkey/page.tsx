import type { Metadata } from "next"
import { Fingerprint } from "lucide-react"

import { AuthRedirectCard } from "@/components/auth-redirect-card"

export const metadata: Metadata = { title: "Continue with passkey" }

export default function PasskeyPage() {
  return (
    <AuthRedirectCard
      icon={Fingerprint}
      title="Continue with your passkey"
      description="Your browser will prompt for your device's passkey through our secure sign-in service."
      actionLabel="Continue with passkey"
      fallbackLabel="Use another method"
      footer={
        <>
          Passkeys use your device&apos;s screen lock — nothing is shared with
          this site.
        </>
      }
    />
  )
}
