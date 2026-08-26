import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const pageLayoutVariants = cva(
  "flex min-h-screen w-full flex-col bg-background",
  {
    variants: {
      variant: {
        default: "",
        centered: "items-center justify-center",
        dashboard: "md:flex-row md:overflow-hidden",
      }
    },
    defaultVariants: {
      variant: "default",
    }
  }
)

export interface PageLayoutProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof pageLayoutVariants> {}

const PageLayout = React.forwardRef<HTMLDivElement, PageLayoutProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(pageLayoutVariants({ variant }), className)}
      {...props}
    />
  )
)
PageLayout.displayName = "PageLayout"

const PageLayoutHeader = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <header
      ref={ref}
      className={cn("sticky top-0 z-40 flex h-16 w-full items-center border-b bg-background/95 px-4 sm:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}
      {...props}
    />
  )
)
PageLayoutHeader.displayName = "PageLayoutHeader"

const PageLayoutSidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn("hidden w-64 flex-col border-e bg-card md:flex md:h-screen md:shrink-0", className)}
      {...props}
    />
  )
)
PageLayoutSidebar.displayName = "PageLayoutSidebar"

const PageLayoutMain = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      className={cn("flex-1 overflow-y-auto outline-none", className)}
      tabIndex={-1}
      {...props}
    />
  )
)
PageLayoutMain.displayName = "PageLayoutMain"

const PageLayoutFooter = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <footer
      ref={ref}
      className={cn("border-t py-6 md:py-8", className)}
      {...props}
    />
  )
)
PageLayoutFooter.displayName = "PageLayoutFooter"

export { PageLayout, PageLayoutHeader, PageLayoutSidebar, PageLayoutMain, PageLayoutFooter, pageLayoutVariants }
