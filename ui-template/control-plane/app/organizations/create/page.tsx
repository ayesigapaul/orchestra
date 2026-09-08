import type { Metadata } from "next"
import Link from "next/link"

import { FocusShell } from "@/components/focus-shell"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const metadata: Metadata = { title: "Create organization" }

const regions = [
  { value: "africa", label: "Africa" },
  { value: "europe", label: "Europe" },
  { value: "americas", label: "Americas" },
  { value: "apac", label: "Asia Pacific" },
]

export default function CreateOrganizationPage() {
  return (
    <FocusShell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Create an organization</CardTitle>
          <CardDescription className="text-base">
            A shared home for your team&apos;s projects, members, and billing.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            </Field>
            <Field>
              <FieldLabel htmlFor="org-region">Data region</FieldLabel>
              <Select items={regions} defaultValue="africa">
                <SelectTrigger id="org-region" className="w-full">
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
              <FieldDescription>
                Where your organization&apos;s data is stored. This can&apos;t
                be changed later.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/organizations/select" />}
          >
            Cancel
          </Button>
          <PendingButton href="/">Create organization</PendingButton>
        </CardFooter>
      </Card>
    </FocusShell>
  )
}
