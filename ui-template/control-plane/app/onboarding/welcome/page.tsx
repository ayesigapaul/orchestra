import type { Metadata } from "next"
import { Building2, CreditCard, UserRound, Users } from "lucide-react"

import { OnboardingCard } from "@/components/onboarding-card"
import { Badge } from "@/components/ui/badge"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"

export const metadata: Metadata = { title: "Welcome" }

const steps = [
  {
    icon: UserRound,
    title: "Set up your profile",
    description: "Tell your teammates who you are.",
  },
  {
    icon: Building2,
    title: "Create your organization",
    description: "Name it and claim your workspace URL.",
  },
  {
    icon: Users,
    title: "Invite your team",
    description: "Collaboration starts with your first invite.",
  },
  {
    icon: CreditCard,
    title: "Pick a plan",
    description: "Start free — upgrade whenever you're ready.",
  },
]

export default function WelcomePage() {
  return (
    <OnboardingCard
      title="Welcome to your new workspace"
      description="Let's get you set up. Here's what we'll do together."
      nextHref="/onboarding/profile"
      nextLabel="Get started"
    >
      <div className="flex flex-col gap-4">
        <ItemGroup className="gap-1">
          {steps.map((step) => (
            <Item key={step.title} size="sm">
              <ItemMedia variant="icon" className="rounded-lg bg-muted p-2">
                <step.icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{step.title}</ItemTitle>
                <ItemDescription>{step.description}</ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
        <Badge variant="secondary" className="ms-3">
          Takes about 3 minutes
        </Badge>
      </div>
    </OnboardingCard>
  )
}
