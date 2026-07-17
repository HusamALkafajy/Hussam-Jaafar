import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const stackVariants = cva(
  "flex",
  {
    variants: {
      direction: {
        col: "flex-col",
        row: "flex-row",
        "col-reverse": "flex-col-reverse",
        "row-reverse": "flex-row-reverse",
      },
      align: {
        start: "items-start",
        center: "items-center",
        end: "items-end",
        stretch: "items-stretch",
        baseline: "items-baseline",
      },
      justify: {
        start: "justify-start",
        center: "justify-center",
        end: "justify-end",
        between: "justify-between",
        around: "justify-around",
        evenly: "justify-evenly",
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
        16: "gap-16",
      }
    },
    defaultVariants: {
      direction: "col",
      gap: 4,
    }
  }
)

export interface StackProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof stackVariants> {}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, direction, align, justify, gap, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(stackVariants({ direction, align, justify, gap }), className)}
      {...props}
    />
  )
)
Stack.displayName = "Stack"

export { Stack, stackVariants }
