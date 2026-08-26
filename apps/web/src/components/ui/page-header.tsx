import * as React from "react"
import { cn } from "@/lib/utils"

const PageHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-4 pb-8 md:flex-row md:items-center md:justify-between", className)}
      {...props}
    />
  )
)
PageHeader.displayName = "PageHeader"

const PageHeaderHeading = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn("text-3xl font-bold tracking-tight text-foreground", className)}
      {...props}
    />
  )
)
PageHeaderHeading.displayName = "PageHeaderHeading"

const PageHeaderDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-muted-foreground text-lg", className)}
      {...props}
    />
  )
)
PageHeaderDescription.displayName = "PageHeaderDescription"

const PageHeaderActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
)
PageHeaderActions.displayName = "PageHeaderActions"

export { PageHeader, PageHeaderHeading, PageHeaderDescription, PageHeaderActions }
