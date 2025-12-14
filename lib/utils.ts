import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const nooutline = "!focus:outline-none !focus-visible:ring-0 !focus-visible:ring-offset-0 !focus-visible:ring-primary/0 !outline-none !focus-visible:border-0 !border-none"
