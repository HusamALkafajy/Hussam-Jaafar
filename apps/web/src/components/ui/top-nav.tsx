import * as React from "react"
import { cn } from "@/lib/utils"

const TopNav = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <nav
      ref={ref}
      className={cn("flex items-center gap-4 h-14 w-full border-b bg-background px-4 sm:px-6", className)}
      {...props}
    />
  )
)
TopNav.displayName = "TopNav"

const TopNavStart = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
  )
)
TopNavStart.displayName = "TopNavStart"

const TopNavCenter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-1 items-center justify-center gap-4 px-4", className)} {...props} />
  )
)
TopNavCenter.displayName = "TopNavCenter"

const TopNavEnd = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 justify-end", className)} {...props} />
  )
)
TopNavEnd.displayName = "TopNavEnd"

export { TopNav, TopNavStart, TopNavCenter, TopNavEnd }
