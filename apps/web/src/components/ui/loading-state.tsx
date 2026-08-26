import * as React from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const LoadingState = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center justify-center p-8 text-center min-h-[200px] w-full", className)}
      {...props}
    >
      <Spinner className="size-8 text-muted-foreground mb-4" />
      {children && (
        <div className="text-sm text-muted-foreground max-w-sm">{children}</div>
      )}
    </div>
  )
)
LoadingState.displayName = "LoadingState"

export { LoadingState }
