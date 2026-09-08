import type { Metadata } from "next"
import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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

export const metadata: Metadata = { title: "Delete account" }

export default function DeleteAccountPage() {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently remove your account and everything that belongs to it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Alert variant="destructive" className="border-destructive/30">
            <AlertTriangle />
            <AlertTitle>This action can&apos;t be undone</AlertTitle>
            <AlertDescription>
              Your profile, preferences, and sessions are deleted immediately.
              Organizations you own must be transferred or deleted first.
            </AlertDescription>
          </Alert>
          <Field>
            <FieldLabel htmlFor="confirm-username">
              Type your username to confirm
            </FieldLabel>
            <Input id="confirm-username" placeholder="ayesigapaul" />
            <FieldDescription>
              This extra step helps prevent accidental deletion.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="justify-end">
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" />}>
            Delete my account
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10 text-destructive">
                <AlertTriangle />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes your account, removes you from every
                organization, and revokes all sessions. There is no way back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive">
                Yes, delete my account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  )
}
