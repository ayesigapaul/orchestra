import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"

import { FocusShell } from "@/components/focus-shell"
import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

// Interstitial for steps completed in the identity provider (Keycloak):
// explains the hand-off, offers a manual trigger, and a fallback action.
export function AuthRedirectCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  fallbackLabel,
  footer,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel: string
  fallbackLabel: string
  footer?: React.ReactNode
}) {
  return (
    <FocusShell>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted">
              <Icon className="size-5" />
            </div>
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="text-base">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-3.5" />
              Redirecting you automatically…
            </div>
            <div className="flex flex-col gap-2">
              <PendingButton size="lg" className="w-full">
                {actionLabel}
                <ArrowRight data-icon="inline-end" />
              </PendingButton>
              <Button variant="ghost" size="lg" className="w-full">
                {fallbackLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
        {footer && (
          <p className="text-center text-sm text-muted-foreground">{footer}</p>
        )}
      </div>
    </FocusShell>
  )
}
