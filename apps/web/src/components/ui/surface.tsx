import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const surfaceVariants = cva(
  "rounded-xl border",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        muted: "bg-muted text-foreground border-transparent",
        glass: "bg-background/40 backdrop-blur-md border-border/40",
      }
    },
    defaultVariants: {
      variant: "default",
    }
  }
)

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof surfaceVariants> {}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(surfaceVariants({ variant }), className)}
      {...props}
    />
  )
)
Surface.displayName = "Surface"

export { Surface, surfaceVariants }
