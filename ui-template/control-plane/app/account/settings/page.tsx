import type { Metadata } from "next"

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
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
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
import { Switch } from "@/components/ui/switch"

export const metadata: Metadata = { title: "Settings" }

const languages = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "sw", label: "Kiswahili" },
]

const timezones = [
  { value: "africa-kampala", label: "(GMT+3) Africa/Kampala" },
  { value: "africa-lagos", label: "(GMT+1) Africa/Lagos" },
  { value: "europe-london", label: "(GMT+0) Europe/London" },
]

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

const notifications = [
  {
    id: "product-updates",
    title: "Product updates",
    description: "News about features and improvements.",
    defaultChecked: true,
  },
  {
    id: "security-alerts",
    title: "Security alerts",
    description: "Sign-ins from new devices and critical changes. Required.",
    defaultChecked: true,
    disabled: true,
  },
  {
    id: "weekly-digest",
    title: "Weekly digest",
    description: "A summary of activity across your organizations.",
    defaultChecked: false,
  },
]

export default function AccountSettingsPage() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Language, time, and appearance.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="language">Language</FieldLabel>
              <Select items={languages} defaultValue="en">
                <SelectTrigger id="language" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {languages.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="tz">Timezone</FieldLabel>
              <Select items={timezones} defaultValue="africa-kampala">
                <SelectTrigger id="tz" className="w-full">
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
            </Field>
            <FieldSet>
              <FieldLegend variant="label">Theme</FieldLegend>
              <RadioGroup
                defaultValue="system"
                className="grid-cols-3 gap-2.5 max-sm:grid-cols-1"
              >
                {themes.map((theme) => (
                  <Field key={theme.value} orientation="horizontal">
                    <RadioGroupItem
                      value={theme.value}
                      id={`theme-${theme.value}`}
                    />
                    <FieldLabel
                      htmlFor={`theme-${theme.value}`}
                      className="font-normal"
                    >
                      {theme.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
            </FieldSet>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost">Reset</Button>
          <Button>Save changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>
            Choose what we send to ayesiga@example.com.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {notifications.map((notification) => (
              <Field key={notification.id} orientation="horizontal">
                <FieldContent>
                  <FieldTitle>{notification.title}</FieldTitle>
                  <FieldDescription>
                    {notification.description}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  aria-label={notification.title}
                  defaultChecked={notification.defaultChecked}
                  disabled={notification.disabled}
                />
              </Field>
            ))}
          </FieldGroup>
        </CardContent>
      </Card>
    </>
  )
}
