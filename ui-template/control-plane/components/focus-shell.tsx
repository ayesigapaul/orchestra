import Link from "next/link"
import { Command } from "lucide-react"

// Minimal chrome for focused flows: auth, onboarding, invitations,
// organization selection, and error pages. No app navigation.
export function FocusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-chrome text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        {/* Logo placeholder */}
        <Link
          href="/"
          title="Home"
          className="flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Command className="size-5" />
        </Link>
        <a
          href="#"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Need help?
        </a>
      </header>

      <main className="flex flex-1 animate-in items-center justify-center p-4 py-10 duration-500 fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none md:p-6">
        {children}
      </main>

      <footer className="flex h-12 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 text-xs text-muted-foreground">
        <span>© 2026</span>
        <a href="#" className="transition-colors hover:text-foreground">
          Privacy
        </a>
        <a href="#" className="transition-colors hover:text-foreground">
          Terms
        </a>
        <a href="#" className="transition-colors hover:text-foreground">
          Status
        </a>
      </footer>
    </div>
  )
}
