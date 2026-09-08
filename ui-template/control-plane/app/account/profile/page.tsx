import type { Metadata } from "next"
import { BadgeCheck } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"

export const metadata: Metadata = { title: "Profile" }

export default function AccountProfilePage() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Public profile</CardTitle>
          <CardDescription>
            How you appear to teammates across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <Avatar className="size-14 ring-1 ring-foreground/10">
                <AvatarImage
                  src="https://github.com/shadcn.png"
                  alt="Ayesiga Paul"
                />
                <AvatarFallback>AP</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Upload photo
                  </Button>
                  <Button variant="ghost" size="sm">
                    Remove
                  </Button>
                </div>
                <FieldDescription>
                  PNG or JPG, up to 2&nbsp;MB.
                </FieldDescription>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="full-name">Full name</FieldLabel>
              <Input id="full-name" defaultValue="Ayesiga Paul" />
            </Field>
            <Field>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <InputGroup>
                <InputGroupAddon className="text-muted-foreground">
                  @
                </InputGroupAddon>
                <InputGroupInput id="username" defaultValue="ayesigapaul" />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="bio">Bio</FieldLabel>
              <Textarea
                id="bio"
                placeholder="A short introduction for your teammates"
                defaultValue="Commit early, commit often"
                rows={3}
              />
              <FieldDescription>
                Shown on your profile card. Markdown is supported.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="ghost">Cancel</Button>
          <Button>Save changes</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>
            Your sign-in email is managed by your identity provider.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="email">
              Email
              <Badge variant="secondary">
                <BadgeCheck />
                Verified
              </Badge>
            </FieldLabel>
            <Input id="email" defaultValue="ayesiga@example.com" disabled />
            <FieldDescription>
              To change it, update your email in the account console of your
              identity provider.
            </FieldDescription>
          </Field>
        </CardContent>
      </Card>
    </>
  )
}
