import type { Metadata } from "next"

import { OnboardingCard } from "@/components/onboarding-card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

export const metadata: Metadata = { title: "Create organization" }

export default function CreateOrganizationPage() {
  return (
    <OnboardingCard
      title="Create your organization"
      description="Your organization is the shared home for your team's work."
      backHref="/onboarding/profile"
      nextHref="/onboarding/organization-setup"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
          <Input id="org-name" placeholder="e.g. Acme Inc" />
        </Field>
        <Field>
          <FieldLabel htmlFor="org-slug">Organization URL</FieldLabel>
          <InputGroup>
            <InputGroupAddon className="text-muted-foreground">
              orgs.example.com/
            </InputGroupAddon>
            <InputGroupInput id="org-slug" placeholder="acme" />
          </InputGroup>
          <FieldDescription>
            Lowercase letters, numbers, and dashes only. You can change this
            later in settings.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </OnboardingCard>
  )
}
