import { Bell, History, Network, PanelRight, SquarePen } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Placeholder utilities — swap for the platform's real quick actions.
// The last entry is pinned to the bottom of the desktop rail.
export const utilities = [SquarePen, PanelRight, History, Bell, Network]

function RailButton({ icon: Icon }: { icon: typeof SquarePen }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Placeholder"
            className="rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          />
        }
      >
        <Icon />
      </TooltipTrigger>
      <TooltipContent side="left">Placeholder</TooltipContent>
    </Tooltip>
  )
}

export function AppRail() {
  return (
    <TooltipProvider delay={300}>
      <aside className="hidden w-12 shrink-0 flex-col items-center gap-1 bg-chrome py-2 md:flex">
        {utilities.slice(0, -1).map((icon, index) => (
          <RailButton key={index} icon={icon} />
        ))}
        <div className="mt-auto">
          <RailButton icon={utilities[utilities.length - 1]} />
        </div>
      </aside>
    </TooltipProvider>
  )
}
