import type { Metadata } from "next"
import { Check } from "lucide-react"

import { OnboardingCard } from "@/components/onboarding-card"
import { Badge } from "@/components/ui/badge"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export const metadata: Metadata = { title: "Choose a plan" }

const plans = [
  {
    value: "starter",
    name: "Starter",
    price: "Free",
    detail: "For individuals and small experiments.",
    features: ["Up to 3 members", "Core features", "Community support"],
  },
  {
    value: "growth",
    name: "Growth",
    price: "$29 / user / mo",
    detail: "For growing teams that need more control.",
    features: ["Unlimited members", "Advanced permissions", "Priority support"],
    recommended: true,
  },
  {
    value: "enterprise",
    name: "Enterprise",
    price: "Custom",
    detail: "Security, compliance, and dedicated support.",
    features: ["SSO & SCIM", "Audit logs", "Dedicated manager"],
  },
]

export default function ChoosePlanPage() {
  return (
    <OnboardingCard
      title="Choose a plan"
      description="Start free and change plans at any time — no lock-in."
      backHref="/onboarding/invite-team"
      nextHref="/onboarding/complete"
    >
      <div className="flex flex-col gap-4">
        <ToggleGroup defaultValue={["annual"]} variant="outline" spacing={0}>
          <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
          <ToggleGroupItem value="annual">
            Annual
            <Badge variant="secondary" className="ms-1">
              Save 20%
            </Badge>
          </ToggleGroupItem>
        </ToggleGroup>

        <RadioGroup defaultValue="growth" className="gap-3">
          {plans.map((plan) => (
            <FieldLabel key={plan.value} htmlFor={`plan-${plan.value}`}>
              <Field orientation="horizontal">
                <RadioGroupItem
                  value={plan.value}
                  id={`plan-${plan.value}`}
                  className="self-start"
                />
                <FieldContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <FieldTitle className="text-base">{plan.name}</FieldTitle>
                    {plan.recommended && <Badge>Recommended</Badge>}
                    <span className="ms-auto text-sm font-medium">
                      {plan.price}
                    </span>
                  </div>
                  <FieldDescription>{plan.detail}</FieldDescription>
                  <ul className="mt-1 flex flex-col gap-1">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="size-3.5 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </FieldContent>
              </Field>
            </FieldLabel>
          ))}
        </RadioGroup>
      </div>
    </OnboardingCard>
  )
}
