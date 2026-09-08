"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Link2,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"

const sections = [
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/settings", label: "Settings", icon: Settings2 },
  { href: "/account/security", label: "Security", icon: ShieldCheck },
  { href: "/account/sessions", label: "Sessions", icon: MonitorSmartphone },
  {
    href: "/account/connected-accounts",
    label: "Connected accounts",
    icon: Link2,
  },
]

const linkClass =
  "flex h-8 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors"

export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Account settings"
      className="flex gap-1 overflow-x-auto max-md:-mx-1 max-md:px-1 max-md:pb-1 md:flex-col"
    >
      {sections.map((section) => {
        const active = pathname.startsWith(section.href)
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              linkClass,
              active
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <section.icon className="size-4 shrink-0" />
            <span className="whitespace-nowrap">{section.label}</span>
          </Link>
        )
      })}
      <Separator className="my-2 max-md:hidden" />
      <Link
        href="/account/delete"
        aria-current={
          pathname.startsWith("/account/delete") ? "page" : undefined
        }
        className={cn(
          linkClass,
          pathname.startsWith("/account/delete")
            ? "bg-destructive/10 font-medium text-destructive"
            : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        )}
      >
        <Trash2 className="size-4 shrink-0" />
        <span className="whitespace-nowrap">Delete account</span>
      </Link>
    </nav>
  )
}
