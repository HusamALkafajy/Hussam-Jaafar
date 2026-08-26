import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const iconWrapperVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-md",
  {
    variants: {
      size: {
        default: "size-8 [&_svg]:size-4",
        sm: "size-6 [&_svg]:size-3",
        lg: "size-10 [&_svg]:size-5",
        xl: "size-12 [&_svg]:size-6",
      },
      variant: {
        default: "bg-primary/10 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        destructive: "bg-destructive/10 text-destructive",
        outline: "border border-input bg-background",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

export interface IconWrapperProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof iconWrapperVariants> {}

export function IconWrapper({
  className,
  size,
  variant,
  ...props
}: IconWrapperProps) {
  return (
    <div
      className={cn(iconWrapperVariants({ size, variant }), className)}
      {...props}
    />
  )
}
