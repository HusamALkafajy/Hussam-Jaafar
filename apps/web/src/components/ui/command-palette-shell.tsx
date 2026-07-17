import * as React from "react"
import { cn } from "@/lib/utils"

const CommandPaletteShell = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-2xl ring-1 ring-border",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
)
CommandPaletteShell.displayName = "CommandPaletteShell"

const CommandPaletteHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center border-b px-3 py-2", className)}
      {...props}
    />
  )
)
CommandPaletteHeader.displayName = "CommandPaletteHeader"

const CommandPaletteBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto overflow-x-hidden p-2", className)}
      {...props}
    />
  )
)
CommandPaletteBody.displayName = "CommandPaletteBody"

const CommandPaletteFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
)
CommandPaletteFooter.displayName = "CommandPaletteFooter"

export { CommandPaletteShell, CommandPaletteHeader, CommandPaletteBody, CommandPaletteFooter }
