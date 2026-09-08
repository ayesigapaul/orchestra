"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

export const onboardingSteps = [
  { slug: "welcome", title: "Welcome" },
  { slug: "profile", title: "Your profile" },
  { slug: "create-organization", title: "Create organization" },
  { slug: "organization-setup", title: "Organization details" },
  { slug: "invite-team", title: "Invite your team" },
  { slug: "choose-plan", title: "Choose a plan" },
  { slug: "complete", title: "Finish" },
]

function useActiveStep() {
  const pathname = usePathname()
  const slug = pathname.split("/").filter(Boolean).at(-1)
  const index = onboardingSteps.findIndex((step) => step.slug === slug)
  return index === -1 ? 0 : index
}

// Vertical stepper on desktop; compact progress bar on mobile.
export function OnboardingSteps() {
  const active = useActiveStep()

  return (
    <>
      <nav aria-label="Onboarding steps" className="max-lg:hidden">
        <ol className="flex flex-col">
          {onboardingSteps.map((step, index) => {
            const state =
              index < active ? "done" : index === active ? "active" : "todo"
            return (
              <li key={step.slug} className="group flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                      state === "done" && "bg-primary text-primary-foreground",
                      state === "active" &&
                        "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      state === "todo" &&
                        "border border-border text-muted-foreground"
                    )}
                  >
                    {state === "done" ? (
                      <Check className="size-4" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "my-1 w-px flex-1 bg-border group-last:hidden",
                      index < active && "bg-primary/40"
                    )}
                  />
                </div>
                <Link
                  href={`/onboarding/${step.slug}`}
                  className={cn(
                    "pt-1 pb-7 text-base transition-colors group-last:pb-0",
                    state === "active"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {step.title}
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="flex flex-col gap-2 lg:hidden">
        <div className="flex items-baseline justify-between text-base">
          <span className="font-medium">{onboardingSteps[active].title}</span>
          <span className="text-muted-foreground">
            Step {active + 1} of {onboardingSteps.length}
          </span>
        </div>
        <Progress value={((active + 1) / onboardingSteps.length) * 100} />
      </div>
    </>
  )
}
