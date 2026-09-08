import {
  Command,
  Copy,
  Inbox,
  ListChecks,
  Menu,
  Plus,
  Search,
} from "lucide-react"

import { utilities } from "@/components/app-rail"
import { SidebarNav } from "@/components/app-sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// Placeholder counters — swap the icons/labels for the platform's real ones.
const counters = [
  { label: "Placeholder", icon: Inbox },
  { label: "Placeholder", icon: Copy },
  { label: "Placeholder", icon: ListChecks },
]

export function AppHeader() {
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-chrome px-3 sm:gap-3">
      <div className="flex items-center gap-1">
        {/* Mobile navigation drawer */}
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                className="rounded-lg text-foreground md:hidden"
              />
            }
          >
            <Menu />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 gap-0 rounded-e-2xl bg-chrome pb-2 text-foreground"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {/* Logo placeholder, mirroring the header */}
            <div className="flex h-14 shrink-0 items-center px-3.5">
              <a
                href="#"
                title="Home"
                className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-sidebar-accent"
              >
                <Command className="size-5" />
              </a>
            </div>
            <SidebarNav
              footer={
                <div className="mt-1 flex items-center gap-1 border-t border-sidebar-border px-1 pt-2">
                  {utilities.map((Icon, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="icon"
                      aria-label="Placeholder"
                      className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    >
                      <Icon />
                    </Button>
                  ))}
                </div>
              }
            />
          </SheetContent>
        </Sheet>

        {/* Logo placeholder */}
        <a
          href="#"
          title="Home"
          className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Command className="size-5" />
        </a>
      </div>

      {/* Search — a button styled as a field, like GitLab's command palette trigger */}
      <button
        type="button"
        className="flex h-8 w-96 max-w-[46vw] items-center gap-2 rounded-lg bg-chrome-field px-2.5 text-sm text-muted-foreground ring-1 ring-chrome-field-ring transition-colors ring-inset hover:ring-foreground/25 max-sm:hidden"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search or go to...</span>
        <Kbd className="ms-auto bg-transparent text-muted-foreground ring-1 ring-foreground/20">
          /
        </Kbd>
      </button>

      <div className="col-start-3 flex items-center justify-end gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
          className="rounded-lg text-muted-foreground sm:hidden"
        >
          <Search />
        </Button>
        <div className="hidden items-center gap-1 sm:flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Create new"
            className="rounded-lg text-foreground ring-1 ring-foreground/20 ring-inset"
          >
            <Plus />
          </Button>
          <Separator orientation="vertical" className="mx-1.5 h-5" />
          {counters.map((counter, index) => {
            const Icon = counter.icon
            return (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                aria-label={counter.label}
                className="gap-1.5 px-2 font-normal text-muted-foreground"
              >
                <Icon data-icon="inline-start" />0
              </Button>
            )
          })}
        </div>
        <Avatar className="ms-1.5 size-7">
          <AvatarImage src="https://github.com/shadcn.png" alt="Ayesiga Paul" />
          <AvatarFallback>AP</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
