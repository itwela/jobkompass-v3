"use client"

import { Toaster } from "@/components/ui/toaster"

export function JkToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  )
}
