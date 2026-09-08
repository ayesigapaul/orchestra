import Link from "next/link"
import { Command } from "lucide-react"

import { OnboardingSteps } from "@/components/onboarding-steps"
import { Button } from "@/components/ui/button"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col bg-chrome text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        {/* Logo placeholder */}
        <Link
          href="/"
          title="Home"
          className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Command className="size-5" />
        </Link>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          Sign out
        </Button>
      </header>

      <main className="mx-auto grid w-full max-w-4xl flex-1 content-start gap-6 p-4 pb-10 md:p-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:content-center lg:gap-10">
        <OnboardingSteps />
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  )
}
