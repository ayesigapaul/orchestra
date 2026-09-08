import type { Metadata } from "next"

import { OnboardingCard } from "@/components/onboarding-card"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const metadata: Metadata = { title: "Organization details" }

const companySizes = [
  { value: "solo", label: "Just me" },
  { value: "small", label: "2–10 people" },
  { value: "medium", label: "11–50 people" },
  { value: "large", label: "51–200 people" },
  { value: "enterprise", label: "More than 200" },
]

const industries = [
  { value: "technology", label: "Technology" },
  { value: "finance", label: "Financial services" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
]

const regions = [
  { value: "africa", label: "Africa" },
  { value: "europe", label: "Europe" },
  { value: "americas", label: "Americas" },
  { value: "apac", label: "Asia Pacific" },
]

export default function OrganizationSetupPage() {
  return (
    <OnboardingCard
      title="Tell us about your organization"
      description="This helps us tailor defaults — it never affects pricing."
      backHref="/onboarding/create-organization"
      nextHref="/onboarding/invite-team"
    >
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Company size</FieldLegend>
          <RadioGroup defaultValue="small" className="gap-2.5">
            {companySizes.map((size) => (
              <Field key={size.value} orientation="horizontal">
                <RadioGroupItem value={size.value} id={`size-${size.value}`} />
                <FieldLabel
                  htmlFor={`size-${size.value}`}
                  className="text-base font-normal"
                >
                  {size.label}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>
        <Field>
          <FieldLabel htmlFor="industry">Industry</FieldLabel>
          <Select items={industries} defaultValue="technology">
            <SelectTrigger id="industry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {industries.map((industry) => (
                  <SelectItem key={industry.value} value={industry.value}>
                    {industry.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="region">Data region</FieldLabel>
          <Select items={regions} defaultValue="africa">
            <SelectTrigger id="region" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {regions.map((region) => (
                  <SelectItem key={region.value} value={region.value}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
    </OnboardingCard>
  )
}
