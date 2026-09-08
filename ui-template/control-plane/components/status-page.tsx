import type { LucideIcon } from "lucide-react"

import { FocusShell } from "@/components/focus-shell"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Full-page status message (errors, ended flows) on the focus shell.
export function StatusPage({
  icon: Icon,
  code,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  code?: string
  title: string
  description: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <FocusShell>
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <Icon className="size-6" />
          </EmptyMedia>
          {code && (
            <Badge variant="outline" className="font-mono">
              {code}
            </Badge>
          )}
          <EmptyTitle className="text-xl">{title}</EmptyTitle>
          <EmptyDescription className="text-base">
            {description}
          </EmptyDescription>
        </EmptyHeader>
        {children && <EmptyContent>{children}</EmptyContent>}
      </Empty>
    </FocusShell>
  )
}
