'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/providers/jkAuthProvider"
import { User, Mail, AtSign } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface JkSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function JkSettings({ open, onOpenChange }: JkSettingsProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your account information and preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Information Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Account Information</h3>
            </div>

            <div className="space-y-4 pl-6">
              {/* Name */}
              {user.name && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Name
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{user.name}</span>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Email
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user.email}</span>
                </div>
              </div>

              {/* Username */}
              {user.username && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Username
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">@{user.username}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Account ID (for reference) */}
          <div className="space-y-2 pl-6">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Account ID
            </label>
            <div className="px-3 py-2 rounded-lg bg-muted/50">
              <span className="text-xs font-mono text-muted-foreground break-all">
                {user._id}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
