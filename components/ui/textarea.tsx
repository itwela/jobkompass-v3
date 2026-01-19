'use client'

import * as React from "react"
import { useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { sanitizeByType, type InputType as SanitizerInputType } from "@/lib/inputSanitizer"

type TextareaSize = "sm" | "md" | "lg"

interface TextareaProps extends React.ComponentProps<"textarea"> {
  size?: TextareaSize
  showBorder?: boolean
  sanitize?: boolean | SanitizerInputType // If true, uses 'textarea' type. If string, uses that type
  sanitizeOnChange?: boolean // If true, sanitizes on every change. If false, only on blur
}

const sizeClasses: Record<TextareaSize, string> = {
  sm: "text-sm px-2 py-2 min-h-12",
  md: "text-sm px-3 py-2 min-h-16",
  lg: "text-base px-4 py-3 min-h-24"
}

function Textarea({ 
  className, 
  size = "md", 
  showBorder = false,
  sanitize = true, // Default to true for security
  sanitizeOnChange = false, // Default to false to avoid interrupting typing
  onChange,
  onBlur,
  value,
  ...props 
}: TextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sanitizeType: SanitizerInputType = typeof sanitize === 'string' 
    ? sanitize 
    : sanitize 
      ? 'textarea'
      : 'text'

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (sanitize && sanitizeOnChange) {
      const sanitized = sanitizeByType(e.target.value, sanitizeType)
      // Create a synthetic event with sanitized value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: sanitized,
        },
      } as React.ChangeEvent<HTMLTextAreaElement>
      onChange?.(syntheticEvent)
    } else {
      onChange?.(e)
    }
  }, [sanitize, sanitizeOnChange, sanitizeType, onChange])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (sanitize && textareaRef.current) {
      const currentValue = textareaRef.current.value
      const sanitized = sanitizeByType(currentValue, sanitizeType)
      if (currentValue !== sanitized) {
        textareaRef.current.value = sanitized
        // Trigger change event with sanitized value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: sanitized,
          },
        } as React.ChangeEvent<HTMLTextAreaElement>
        onChange?.(syntheticEvent)
      }
    }
    onBlur?.(e)
  }, [sanitize, sanitizeType, onChange, onBlur])

  // Sync external value changes
  useEffect(() => {
    if (textareaRef.current && value !== undefined && sanitize) {
      const sanitized = sanitizeByType(String(value), sanitizeType)
      if (textareaRef.current.value !== sanitized) {
        textareaRef.current.value = sanitized
      }
    }
  }, [value, sanitize, sanitizeType])

  return (
    <textarea
      ref={textareaRef}
      data-slot="textarea"
      data-size={size}
      className={cn(
        "placeholder:text-muted-foreground no-scrollbar dark:aria-invalid:ring-destructive/40 aria-invalid:ring-destructive/20 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content w-full rounded-md bg-transparent transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses[size],
        showBorder && "border border-input focus-visible:border-ring",
        // Removed focus-visible:ring and focus-visible:border
        className
      )}
      onChange={handleChange}
      onBlur={handleBlur}
      value={value}
      {...props}
    />
  )
}

export { Textarea }
