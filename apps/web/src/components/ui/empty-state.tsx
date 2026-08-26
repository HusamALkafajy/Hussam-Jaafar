import * as React from "react"
import { cn } from "@/lib/utils"

const EmptyState = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50", className)}
      {...props}
    />
  )
)
EmptyState.displayName = "EmptyState"

const EmptyStateIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto flex size-12 items-center justify-center rounded-full bg-muted/50 mb-4 text-muted-foreground", className)}
      {...props}
    />
  )
)
EmptyStateIcon.displayName = "EmptyStateIcon"

const EmptyStateTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("mt-4 text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
)
EmptyStateTitle.displayName = "EmptyStateTitle"

const EmptyStateDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("mt-2 mb-4 text-sm text-muted-foreground max-w-sm mx-auto", className)}
      {...props}
    />
  )
)
EmptyStateDescription.displayName = "EmptyStateDescription"

const EmptyStateActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center", className)}
      {...props}
    />
  )
)
EmptyStateActions.displayName = "EmptyStateActions"

export { EmptyState, EmptyStateIcon, EmptyStateTitle, EmptyStateDescription, EmptyStateActions }
