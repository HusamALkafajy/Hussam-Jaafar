import * as React from "react"
import { cn } from "@/lib/utils"

export interface FormSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ className, title, description, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-6 py-6 border-b last:border-b-0 border-border", className)}
        {...props}
      >
        {(title || description) && (
          <div className="flex flex-col gap-1.5">
            {title && (
              <h3 className="text-lg font-medium leading-none tracking-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-6">{children}</div>
      </div>
    )
  }
)
FormSection.displayName = "FormSection"

export { FormSection }
