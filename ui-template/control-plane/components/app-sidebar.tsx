"use client"

import { useState } from "react"
import {
  BarChart3,
  Database,
  FileText,
  Folder,
  Globe,
  HelpCircle,
  Home,
  LayoutGrid,
  PanelLeft,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Placeholder navigation slots — swap these for the platform's real sections.
const placeholders: { icon: LucideIcon; labelWidth: string }[] = [
  { icon: LayoutGrid, labelWidth: "w-24" },
  { icon: Folder, labelWidth: "w-20" },
  { icon: Users, labelWidth: "w-16" },
  { icon: FileText, labelWidth: "w-28" },
  { icon: BarChart3, labelWidth: "w-20" },
  { icon: Globe, labelWidth: "w-24" },
  { icon: Database, labelWidth: "w-16" },
  { icon: Shield, labelWidth: "w-20" },
  { icon: Settings, labelWidth: "w-24" },
]

const itemClass =
  "flex h-8 shrink-0 items-center gap-3 rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

function NavItem({
  icon: Icon,
  label,
  labelWidth,
  active,
  collapsed,
}: {
  icon: LucideIcon
  label?: string
  labelWidth?: string
  active?: boolean
  collapsed: boolean
}) {
  const link = (
    <a
      href="#"
      aria-label={label ?? "Placeholder"}
      className={cn(
        itemClass,
        collapsed ? "w-8 justify-center" : "px-2.5 text-sm",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed &&
        (label ? (
          <span className="truncate">{label}</span>
        ) : (
          <Skeleton className={cn("h-3 animate-none", labelWidth)} />
        ))}
    </a>
  )

  if (!collapsed) {
    return link
  }

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{label ?? "Placeholder"}</TooltipContent>
    </Tooltip>
  )
}

// Shared between the desktop rail (both states) and the mobile drawer.
// `footer` renders extra controls after Help in the bottom cluster.
export function SidebarNav({
  collapsed = false,
  footer,
}: {
  collapsed?: boolean
  footer?: React.ReactNode
}) {
  return (
    <>
      <div
        className={cn(
          "px-4 pt-3 pb-2 text-sm font-semibold text-foreground",
          collapsed && "sr-only"
        )}
      >
        Your work
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-0.5 overflow-y-auto",
          collapsed ? "items-center pt-2" : "px-2"
        )}
      >
        <NavItem icon={Home} label="Home" active collapsed={collapsed} />
        {placeholders.map((item, index) => (
          <NavItem
            key={index}
            icon={item.icon}
            labelWidth={item.labelWidth}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div
        className={cn(
          "flex flex-col gap-0.5 pt-2",
          collapsed ? "items-center" : "px-2"
        )}
      >
        <NavItem icon={HelpCircle} label="Help" collapsed={collapsed} />
        {footer}
      </div>
    </>
  )
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(true)

  const toggle = (
    <button
      type="button"
      onClick={() => setCollapsed((value) => !value)}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        itemClass,
        collapsed ? "w-8 justify-center" : "px-2.5 text-sm"
      )}
    >
      <PanelLeft className={cn("size-4 shrink-0", collapsed && "rotate-180")} />
      {!collapsed && <span>Collapse sidebar</span>}
    </button>
  )

  return (
    <TooltipProvider delay={300}>
      <aside
        data-collapsed={collapsed}
        className={cn(
          "hidden shrink-0 flex-col bg-chrome pb-2 transition-[width] duration-200 md:flex",
          collapsed ? "w-12" : "w-60"
        )}
      >
        <SidebarNav
          collapsed={collapsed}
          footer={
            collapsed ? (
              <Tooltip>
                <TooltipTrigger render={toggle} />
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              </Tooltip>
            ) : (
              toggle
            )
          }
        />
      </aside>
    </TooltipProvider>
  )
}
