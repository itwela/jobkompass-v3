'use client'

import * as React from "react"
import { useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { sanitizeByType, type InputType as SanitizerInputType } from "@/lib/inputSanitizer"

type InputSize = "sm" | "md" | "lg"

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize | undefined
  sanitize?: boolean | SanitizerInputType // If true, uses 'text' type. If string, uses that type
  sanitizeOnChange?: boolean // If true, sanitizes on every change. If false, only on blur
}

const sizeClasses: Record<InputSize, string> = {
  sm: "h-8 text-sm px-2 py-1",
  md: "h-9 text-sm px-3 py-2",
  lg: "h-11 text-base px-4 py-2"
}

function Input({ 
  className, 
  type, 
  size = "md", 
  sanitize = true, // Default to true for security
  sanitizeOnChange = false, // Default to false to avoid interrupting typing
  onChange,
  onBlur,
  value,
  ...props 
}: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const sanitizeType: SanitizerInputType = typeof sanitize === 'string' 
    ? sanitize 
    : sanitize 
      ? (type === 'email' ? 'email' : type === 'url' ? 'url' : 'text')
      : 'text'

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (sanitize && sanitizeOnChange) {
      const sanitized = sanitizeByType(e.target.value, sanitizeType)
      // Create a synthetic event with sanitized value
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: sanitized,
        },
      } as React.ChangeEvent<HTMLInputElement>
      onChange?.(syntheticEvent)
    } else {
      onChange?.(e)
    }
  }, [sanitize, sanitizeOnChange, sanitizeType, onChange])

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    if (sanitize && inputRef.current) {
      const currentValue = inputRef.current.value
      const sanitized = sanitizeByType(currentValue, sanitizeType)
      if (currentValue !== sanitized) {
        inputRef.current.value = sanitized
        // Trigger change event with sanitized value
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: sanitized,
          },
        } as React.ChangeEvent<HTMLInputElement>
        onChange?.(syntheticEvent)
      }
    }
    onBlur?.(e)
  }, [sanitize, sanitizeType, onChange, onBlur])

  // No manual DOM sync needed - React handles controlled component value binding.
  // The previous useEffect was sanitizing on every value change, which reset cursor position.

  return (
    <input
      ref={inputRef}
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        sizeClasses[size],
        // focus and invalid states
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      onChange={handleChange}
      onBlur={handleBlur}
      value={value}
      {...props}
    />
  )
}

export { Input }
