import * as React from "react"
import { cn } from "@/lib/utils"

export const typographyVariants = {
  h1: "scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl",
  h2: "scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0",
  h3: "scroll-m-20 text-2xl font-semibold tracking-tight",
  h4: "scroll-m-20 text-xl font-semibold tracking-tight",
  p: "leading-7 [&:not(:first-child)]:mt-6",
  blockquote: "mt-6 border-s-2 ps-6 italic",
  list: "my-6 ms-6 list-disc [&>li]:mt-2",
  inlineCode: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
  lead: "text-xl text-muted-foreground",
  large: "text-lg font-semibold",
  small: "text-sm font-medium leading-none",
  muted: "text-sm text-muted-foreground",
}

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  variant?: keyof typeof typographyVariants
  as?: React.ElementType
}

export function Typography({
  className,
  variant = "p",
  as,
  ...props
}: TypographyProps) {
  const Component = as || (["h1", "h2", "h3", "h4", "p", "blockquote", "ul"].includes(variant) ? variant : "span") as React.ElementType
  
  return (
    <Component
      className={cn(typographyVariants[variant], className)}
      {...props}
    />
  )
}
