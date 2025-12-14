import * as React from "react"

import { cn } from "@/lib/utils"

type TextareaSize = "sm" | "md" | "lg"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  size?: TextareaSize
  showBorder?: boolean
}

const sizeClasses: Record<TextareaSize, string> = {
  sm: "text-sm px-2 py-2 min-h-12",
  md: "text-sm px-3 py-2 min-h-16",
  lg: "text-base px-4 py-3 min-h-24"
}

function Textarea({ className, size = "md", showBorder = false, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      data-size={size}
      className={cn(
        "placeholder:text-muted-foreground no-scrollbar dark:aria-invalid:ring-destructive/40 aria-invalid:ring-destructive/20 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content w-full rounded-md bg-transparent transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses[size],
        showBorder && "border border-input focus-visible:border-ring",
        // Removed focus-visible:ring and focus-visible:border
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
