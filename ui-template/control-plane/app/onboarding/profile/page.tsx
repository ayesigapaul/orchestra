import type { Metadata } from "next"

import { OnboardingCard } from "@/components/onboarding-card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

export const metadata: Metadata = { title: "Your profile" }

const timezones = [
  { value: "africa-kampala", label: "(GMT+3) Africa/Kampala" },
  { value: "africa-lagos", label: "(GMT+1) Africa/Lagos" },
  { value: "europe-london", label: "(GMT+0) Europe/London" },
  { value: "america-new-york", label: "(GMT-5) America/New York" },
]

export default function ProfilePage() {
  return (
    <OnboardingCard
      title="Set up your profile"
      description="This is how you'll appear to your teammates."
      backHref="/onboarding/welcome"
      nextHref="/onboarding/create-organization"
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <Avatar className="size-12 ring-1 ring-foreground/10">
            <AvatarImage
              src="https://github.com/shadcn.png"
              alt="Ayesiga Paul"
            />
            <AvatarFallback>AP</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <Button variant="outline" size="sm" className="w-fit">
              Upload photo
            </Button>
            <FieldDescription>PNG or JPG, up to 2&nbsp;MB.</FieldDescription>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="full-name">Full name</FieldLabel>
          <Input id="full-name" defaultValue="Ayesiga Paul" />
        </Field>
        <Field>
          <FieldLabel htmlFor="job-title">Job title</FieldLabel>
          <Input id="job-title" placeholder="e.g. Engineering manager" />
        </Field>
        <Field>
          <FieldLabel htmlFor="timezone">Timezone</FieldLabel>
          <Select items={timezones} defaultValue="africa-kampala">
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {timezones.map((timezone) => (
                  <SelectItem key={timezone.value} value={timezone.value}>
                    {timezone.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>
            Used for notifications and scheduled reports.
          </FieldDescription>
        </Field>
      </FieldGroup>
    </OnboardingCard>
  )
}
