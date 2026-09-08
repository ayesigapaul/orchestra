import type { Metadata } from "next"
import { Plus } from "lucide-react"

import { OnboardingCard } from "@/components/onboarding-card"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const metadata: Metadata = { title: "Invite your team" }

const roles = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "billing", label: "Billing" },
]

function InviteRow({ index }: { index: number }) {
  return (
    <div className="flex gap-2">
      <Input
        aria-label={`Email address ${index + 1}`}
        type="email"
        placeholder="colleague@company.com"
        className="flex-1"
      />
      <Select items={roles} defaultValue="member">
        <SelectTrigger
          aria-label={`Role for invite ${index + 1}`}
          className="w-28 shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {roles.map((role) => (
              <SelectItem key={role.value} value={role.value}>
                {role.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

export default function InviteTeamPage() {
  return (
    <OnboardingCard
      title="Invite your team"
      description="Teammates get an email with a link to join your organization."
      backHref="/onboarding/organization-setup"
      nextHref="/onboarding/choose-plan"
      skipHref="/onboarding/choose-plan"
    >
      <FieldGroup>
        <Field>
          <FieldLabel>Email addresses</FieldLabel>
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <InviteRow key={index} index={index} />
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-fit">
            <Plus data-icon="inline-start" />
            Add another
          </Button>
          <FieldDescription>
            You can always invite more people later from organization settings.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </OnboardingCard>
  )
}
