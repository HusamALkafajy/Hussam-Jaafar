import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sectionVariants = cva(
  "w-full py-12 md:py-16 lg:py-24",
  {
    variants: {
      variant: {
        default: "bg-background",
        muted: "bg-muted",
        primary: "bg-primary text-primary-foreground",
        glass: "bg-background/40 backdrop-blur-md",
      },
      spacing: {
        none: "py-0",
        sm: "py-6 md:py-8 lg:py-12",
        default: "py-12 md:py-16 lg:py-24",
        lg: "py-24 md:py-32 lg:py-48",
      }
    },
    defaultVariants: {
      variant: "default",
      spacing: "default",
    }
  }
)

export interface SectionProps extends React.HTMLAttributes<HTMLElement>, VariantProps<typeof sectionVariants> {}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  ({ className, variant, spacing, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(sectionVariants({ variant, spacing }), className)}
      {...props}
    />
  )
)
Section.displayName = "Section"

export { Section, sectionVariants }
