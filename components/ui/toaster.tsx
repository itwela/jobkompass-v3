"use client"

import { Toaster as Sonner } from "sonner"
import { useJobKompassTheme } from "@/providers/jkThemeProvider"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ position = "top-right", ...props }: ToasterProps) => {
  const { theme } = useJobKompassTheme()

  return (
    <Sonner
      theme={theme}
      position={position}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
