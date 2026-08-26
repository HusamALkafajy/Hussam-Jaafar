import * as React from "react"
import { cn } from "@/lib/utils"

const SearchInputContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center w-full max-w-sm rounded-lg border bg-background px-3 py-1 shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
        className
      )}
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
        className="size-4 shrink-0 text-muted-foreground me-2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      {children}
    </div>
  )
)
SearchInputContainer.displayName = "SearchInputContainer"

export { SearchInputContainer }
