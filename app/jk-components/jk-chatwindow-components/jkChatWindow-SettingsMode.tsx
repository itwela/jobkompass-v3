'use client'

import { useState, useEffect } from "react"
import { useAuth } from "@/providers/jkAuthProvider"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { User, Mail, AtSign, CreditCard, Save, FileText, X, Plus, Edit2, Check } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/lib/toast"

export default function JkCW_SettingsMode() {
  const { user, isAuthenticated } = useAuth()
  const updateProfile = useMutation(api.auth.updateUserProfile)
  const updateResumePreferences = useMutation(api.auth.updateResumePreferences)
  const resumePreferences = useQuery(api.auth.getResumePreferences)
  
  const [name, setName] = useState(user?.name || "")
  const [email, setEmail] = useState(user?.email || "")
  const [preferences, setPreferences] = useState<string[]>([])
  const [newPreference, setNewPreference] = useState("")
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Update local state when user data changes
  useEffect(() => {
    if (user) {
      setName(user.name || "")
      setEmail(user.email || "")
    }
  }, [user])

  // Update preferences when they load
  useEffect(() => {
    if (resumePreferences) {
      setPreferences(resumePreferences)
    }
  }, [resumePreferences])

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

  const handleAddPreference = async () => {
    const trimmedPref = newPreference.trim()
    if (!trimmedPref) return
    
    if (preferences.includes(trimmedPref)) {
      toast.error('Duplicate Preference', {
        description: 'This preference already exists',
        duration: 2000,
      })
      return
    }
    
    const newPrefs = [...preferences, trimmedPref]
    setPreferences(newPrefs)
    setNewPreference("")
    
    // Auto-save
    try {
      await updateResumePreferences({ preferences: newPrefs })
      toast.success('Preference Added', {
        description: 'Your preference has been saved',
        duration: 2000,
      })
    } catch (error) {
      toast.error('Save Failed', {
        description: 'Failed to save preference',
        duration: 3000,
      })
      // Revert on error
      setPreferences(preferences)
    }
  }

  const handleRemovePreference = async (index: number) => {
    const newPrefs = preferences.filter((_, i) => i !== index)
    setPreferences(newPrefs)
    
    // Auto-save
    try {
      await updateResumePreferences({ preferences: newPrefs })
      toast.success('Preference Removed', {
        description: 'Your preference has been removed',
        duration: 2000,
      })
    } catch (error) {
      toast.error('Save Failed', {
        description: 'Failed to remove preference',
        duration: 3000,
      })
      // Revert on error
      setPreferences(preferences)
    }
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setEditingText(preferences[index])
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingText("")
  }

  const handleSaveEdit = async (index: number) => {
    const trimmedText = editingText.trim()
    if (!trimmedText) return
    
    if (trimmedText === preferences[index]) {
      setEditingIndex(null)
      return
    }
    
    if (preferences.includes(trimmedText) && preferences[index] !== trimmedText) {
      toast.error('Duplicate Preference', {
        description: 'This preference already exists',
        duration: 2000,
      })
      return
    }
    
    const newPrefs = [...preferences]
    newPrefs[index] = trimmedText
    setPreferences(newPrefs)
    setEditingIndex(null)
    setEditingText("")
    
    // Auto-save
    try {
      await updateResumePreferences({ preferences: newPrefs })
      toast.success('Preference Updated', {
        description: 'Your preference has been updated',
        duration: 2000,
      })
    } catch (error) {
      toast.error('Save Failed', {
        description: 'Failed to update preference',
        duration: 3000,
      })
      // Revert on error
      setPreferences(preferences)
    }
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

          {/* Resume Preferences Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Resume Preferences</h2>
            </div>
            <div className="pl-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Add preferences that the AI will automatically consider when generating your resumes. Each preference will be applied without asking you.
              </p>
              
              {/* Preferences List */}
              {preferences.length > 0 && (
                <div className="space-y-2">
                  {preferences.map((pref, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border group hover:border-primary/50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      
                      {editingIndex === index ? (
                        // Edit mode
                        <>
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="flex-1 min-h-[60px] resize-none text-sm"
                            autoFocus
                          />
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleSaveEdit(index)}
                              className="p-1 hover:bg-green-100 rounded transition-colors"
                              title="Save"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Cancel"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        </>
                      ) : (
                        // View mode
                        <>
                          <p className="flex-1 text-sm">{pref}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => handleStartEdit(index)}
                              className="p-1 hover:bg-blue-100 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => handleRemovePreference(index)}
                              className="p-1 hover:bg-red-100 rounded transition-colors"
                              title="Delete"
                            >
                              <X className="h-4 w-4 text-red-600" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Preference */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Add New Preference
                </label>
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={newPreference}
                    onChange={(e) => setNewPreference(e.target.value)}
                    placeholder="e.g., Always use a clean, minimalist format with clear section headings"
                    className="w-full min-h-[80px] resize-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleAddPreference()
                      }
                    }}
                  />
                  <Button
                    onClick={handleAddPreference}
                    disabled={!newPreference.trim()}
                    variant="outline"
                    size="sm"
                    className="w-fit"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Preference
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Press Cmd/Ctrl+Enter to add quickly
                  </p>
                </div>
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
