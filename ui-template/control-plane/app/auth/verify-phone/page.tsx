import type { Metadata } from "next"

import { FocusShell } from "@/components/focus-shell"
import { PendingButton } from "@/components/pending-button"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"

export const metadata: Metadata = { title: "Verify your phone" }

export default function VerifyPhonePage() {
  return (
    <FocusShell>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Verify your phone</CardTitle>
            <CardDescription className="text-base">
              Enter the 6-digit code we sent to +256 ••• ••• 782.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="otp" className="sr-only">
                  Verification code
                </FieldLabel>
                <InputOTP
                  id="otp"
                  maxLength={6}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="size-10 text-base" />
                    <InputOTPSlot index={1} className="size-10 text-base" />
                    <InputOTPSlot index={2} className="size-10 text-base" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} className="size-10 text-base" />
                    <InputOTPSlot index={4} className="size-10 text-base" />
                    <InputOTPSlot index={5} className="size-10 text-base" />
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription className="text-center">
                  Didn&apos;t receive a code? <a href="#">Resend in 0:42</a>
                </FieldDescription>
              </Field>
              <Field>
                <PendingButton size="lg" className="w-full">
                  Verify
                </PendingButton>
                <Button variant="ghost" className="w-full">
                  Use a different number
                </Button>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{" "}
          <a href="#" className="text-primary hover:underline">
            Sign out
          </a>
        </p>
      </div>
    </FocusShell>
  )
}
