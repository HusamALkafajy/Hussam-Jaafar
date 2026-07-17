import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const SidebarNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn("flex flex-col gap-1 w-full", className)}
      {...props}
    />
  )
)
SidebarNav.displayName = "SidebarNav"

const SidebarNavGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 mb-4 last:mb-0", className)} {...props} />
  )
)
SidebarNavGroup.displayName = "SidebarNavGroup"

const SidebarNavLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1", className)} {...props} />
  )
)
SidebarNavLabel.displayName = "SidebarNavLabel"

const SidebarNavItem = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean; icon?: React.ReactNode }>(
  ({ className, active, icon, children, ...props }, ref) => (
    <a
      ref={ref}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-muted text-foreground" : "text-muted-foreground",
        className
      )}
      {...props}
    >
      {icon && <span className="flex size-4 items-center justify-center">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
    </a>
  )
)
SidebarNavItem.displayName = "SidebarNavItem"

export { SidebarNav, SidebarNavGroup, SidebarNavLabel, SidebarNavItem }
