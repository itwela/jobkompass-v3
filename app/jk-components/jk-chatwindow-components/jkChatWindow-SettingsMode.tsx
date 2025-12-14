'use client'

import { useState, useEffect } from "react"
import { useAuth } from "@/providers/jkAuthProvider"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { User, Mail, AtSign, CreditCard, Save } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function JkCW_SettingsMode() {
  const { user, isAuthenticated } = useAuth()
  const updateProfile = useMutation(api.auth.updateUserProfile)
  
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Update local state when user data changes
  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setEmail(user.email || "")
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    
    setIsSaving(true)
    setSaveMessage(null)
    
    try {
      await updateProfile({
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      })
      setSaveMessage({ type: 'success', text: 'Profile updated successfully' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      setSaveMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update profile' 
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleManageBilling = () => {
    console.log('Manage billing clicked')
  }

  const hasChanges = name !== (user?.name || "") || email !== (user?.email || "")

  if (!isAuthenticated || !user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Please sign in to view your settings</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto w-full px-6 py-8">
        {/* Header */}
        <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account information and preferences
          </p>
        </div>

        <Separator />

        {/* User Information Section */}
        <div className="space-y-6">
          <div className="space-y-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {/* <User className="h-4 w-4 text-muted-foreground" /> */}
              {/* <h2 className="text-lg font-semibold">Account Information</h2> */}
            </div>

            <div className="space-y-4 pl-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Name
                </label>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Email
                </label>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Username - read only */}
              {user.username && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Username
                  </label>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                    <AtSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">@{user.username}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                </div>
              )}

              {/* Save button and message */}
              <div className="space-y-2 pt-2">
                {saveMessage && (
                  <div className={`text-sm px-3 py-2 rounded-lg ${
                    saveMessage.type === 'success' 
                      ? 'bg-green-50 text-green-800 border border-green-200' 
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                    {saveMessage.text}
                  </div>
                )}
                <Button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Billing Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Billing</h2>
            </div>
            <div className="pl-6">
              <Button
                variant="outline"
                onClick={handleManageBilling}
                className="gap-2"
              >
                <CreditCard className="h-4 w-4" />
                Manage Billing
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
