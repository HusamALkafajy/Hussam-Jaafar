"use client"

import * as React from "react"
import { UploadCloud } from "lucide-react"

import { cn } from "@/lib/utils"

export interface FilePickerProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onFileSelect?: (files: FileList | null) => void
  heading?: React.ReactNode
  subheading?: React.ReactNode
  icon?: React.ReactNode
}

const FilePicker = React.forwardRef<HTMLInputElement, FilePickerProps>(
  ({ className, onFileSelect, onChange, heading, subheading, icon, ...props }, ref) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onFileSelect?.(e.target.files)
      onChange?.(e)
    }

    return (
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 p-6 text-center hover:bg-muted/80 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          className
        )}
      >
        {icon || <UploadCloud className="size-10 text-muted-foreground" />}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            {heading || "Click to upload or drag and drop"}
          </span>
          <span className="text-xs text-muted-foreground">
            {subheading || "SVG, PNG, JPG or GIF (max. 5MB)"}
          </span>
        </div>
        <input
          type="file"
          className="absolute inset-0 z-50 h-full w-full cursor-pointer opacity-0"
          ref={ref}
          onChange={handleFileChange}
          {...props}
        />
      </div>
    )
  }
)
FilePicker.displayName = "FilePicker"

export { FilePicker }
