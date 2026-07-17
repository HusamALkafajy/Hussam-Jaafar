import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const panelVariants = cva(
  "flex flex-col bg-card text-card-foreground",
  {
    variants: {
      variant: {
        default: "border-e last:border-e-0",
        elevated: "shadow-md rounded-xl border",
        ghost: "bg-transparent",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        default: "p-4 sm:p-6",
        lg: "p-6 sm:p-8",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
    }
  }
)

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof panelVariants> {
  as?: React.ElementType
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant, padding, as: Component = "div", ...props }, ref) => (
    <Component
      ref={ref}
      className={cn(panelVariants({ variant, padding }), className)}
      {...props}
    />
  )
)
Panel.displayName = "Panel"

export { Panel, panelVariants }
