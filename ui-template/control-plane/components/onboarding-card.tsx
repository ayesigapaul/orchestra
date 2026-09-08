import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Shared frame for a wizard step: title, body, back/continue footer.
export function OnboardingCard({
  title,
  description,
  backHref,
  nextHref,
  nextLabel = "Continue",
  skipHref,
  children,
}: {
  title: string
  description?: string
  backHref?: string
  nextHref: string
  nextLabel?: string
  skipHref?: string
  children: React.ReactNode
}) {
  return (
    <Card className="animate-in duration-500 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        {description && (
          <CardDescription className="text-base">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="justify-between">
        <div>
          {backHref && (
            <Button
              variant="ghost"
              size="lg"
              nativeButton={false}
              render={<Link href={backHref} />}
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {skipHref && (
            <Button
              variant="ghost"
              size="lg"
              nativeButton={false}
              render={<Link href={skipHref} />}
            >
              Skip for now
            </Button>
          )}
          <PendingButton size="lg" href={nextHref}>
            {nextLabel}
            <ArrowRight data-icon="inline-end" />
          </PendingButton>
        </div>
      </CardFooter>
    </Card>
  )
}
