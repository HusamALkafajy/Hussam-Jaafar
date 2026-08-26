"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface SearchFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          type="search"
          className={cn("ps-9", className)}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
SearchField.displayName = "SearchField"

export { SearchField }
