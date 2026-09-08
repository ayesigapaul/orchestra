"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

// Button with a pending state: click shows a spinner, then navigates to
// `href` (or resets, when there is no destination yet).
export function PendingButton({
  href,
  children,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { href?: string }) {
  const [pending, setPending] = useState(false)
  const router = useRouter()

  function handleClick() {
    if (pending) {
      return
    }
    setPending(true)
    if (href) {
      setTimeout(() => router.push(href), 600)
    } else {
      setTimeout(() => setPending(false), 1200)
    }
  }

  return (
    <Button {...props} disabled={disabled || pending} onClick={handleClick}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  )
}
