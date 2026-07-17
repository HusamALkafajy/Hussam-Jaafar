import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const gridVariants = cva(
  "grid",
  {
    variants: {
      cols: {
        1: "grid-cols-1",
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
        6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        12: "grid-cols-4 sm:grid-cols-8 lg:grid-cols-12",
      },
      gap: {
        0: "gap-0",
        1: "gap-1",
        2: "gap-2",
        3: "gap-3",
        4: "gap-4",
        5: "gap-5",
        6: "gap-6",
        8: "gap-8",
        10: "gap-10",
        12: "gap-12",
      },
      align: {
        start: "items-start",
        center: "items-center",
        end: "items-end",
        stretch: "items-stretch",
      }
    },
    defaultVariants: {
      cols: 1,
      gap: 4,
    }
  }
)

export interface GridProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof gridVariants> {}

const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  ({ className, cols, gap, align, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(gridVariants({ cols, gap, align }), className)}
      {...props}
    />
  )
)
Grid.displayName = "Grid"

export { Grid, gridVariants }
