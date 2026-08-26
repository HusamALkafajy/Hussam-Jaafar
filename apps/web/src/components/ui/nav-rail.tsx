import * as React from "react"
import { cn } from "@/lib/utils"

const NavRail = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn("flex flex-col items-center gap-4 py-4 w-16 h-full border-e bg-card", className)}
      {...props}
    />
  )
)
NavRail.displayName = "NavRail"

const NavRailItem = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean; icon: React.ReactNode; label?: string }>(
  ({ className, active, icon, label, ...props }, ref) => (
    <a
      ref={ref}
      title={label}
      className={cn(
        "group flex flex-col items-center justify-center size-10 rounded-lg transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-muted text-foreground" : "text-muted-foreground",
        className
      )}
      {...props}
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      <span className="sr-only">{label}</span>
    </a>
  )
)
NavRailItem.displayName = "NavRailItem"

export { NavRail, NavRailItem }
