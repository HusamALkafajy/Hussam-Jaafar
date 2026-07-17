import * as React from "react"
import { cn } from "@/lib/utils"

const ErrorState = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center", className)}
      {...props}
    />
  )
)
ErrorState.displayName = "ErrorState"

const ErrorStateIcon = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 mb-4 text-destructive", className)}
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-6"
        aria-hidden="true"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    </div>
  )
)
ErrorStateIcon.displayName = "ErrorStateIcon"

const ErrorStateTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("mt-4 text-lg font-semibold text-foreground", className)}
      {...props}
    />
  )
)
ErrorStateTitle.displayName = "ErrorStateTitle"

const ErrorStateDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("mt-2 mb-4 text-sm text-muted-foreground max-w-sm mx-auto", className)}
      {...props}
    />
  )
)
ErrorStateDescription.displayName = "ErrorStateDescription"

const ErrorStateActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center", className)}
      {...props}
    />
  )
)
ErrorStateActions.displayName = "ErrorStateActions"

export { ErrorState, ErrorStateIcon, ErrorStateTitle, ErrorStateDescription, ErrorStateActions }
