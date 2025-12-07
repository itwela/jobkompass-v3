'use client'

import { useState } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/providers/jkAuthProvider"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { ChevronRight, ChevronDown, MessageSquare, Trash2, Plus, LogIn, LogOut, Briefcase, Bell, Check, Clock, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthActions } from "@convex-dev/auth/react"

type NotificationStatus = "awaiting-response" | "responded" | "no-response"

type JobNotification = {
  id: string
  company: string
  role: string
  lastTouchpoint: string
  status: NotificationStatus
  read: boolean
}

const notificationStatusConfig: Record<NotificationStatus, { label: string; className: string }> = {
  "awaiting-response": {
    label: "Awaiting reply",
    className: "bg-amber-100 text-amber-900 border border-amber-200"
  },
  responded: {
    label: "Responded",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200"
  },
  "no-response": {
    label: "No response yet",
    className: "bg-rose-100 text-rose-800 border border-rose-200"
  }
}

const seedNotifications: JobNotification[] = [
  {
    id: "app-1234",
    company: "Acme Labs",
    role: "Product Manager",
    lastTouchpoint: "Followed up 2 days ago",
    status: "awaiting-response",
    read: false
  },
  {
    id: "app-5678",
    company: "Northwind Partners",
    role: "Growth Marketing Lead",
    lastTouchpoint: "Recruiter replied this morning",
    status: "responded",
    read: false
  },
  {
    id: "app-9101",
    company: "Blue Horizon",
    role: "Senior UX Designer",
    lastTouchpoint: "Initial outreach 1 week ago",
    status: "no-response",
    read: false
  }
]

export default function JkSidebar() {
  const { user, isAuthenticated } = useAuth()
  const { currentThreadId, setCurrentThreadId, setCurrentMode, allModes, currentMode } = useJobKompassChatWindow()
  const [isThreadsExpanded, setIsThreadsExpanded] = useState(true)
  const [showSignIn, setShowSignIn] = useState(false)
  const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn")
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<any>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notifications, setNotifications] = useState<JobNotification[]>(() => seedNotifications)

  const threads = useQuery(api.threads.list, isAuthenticated ? {} : "skip")
  const deleteThread = useMutation(api.threads.remove)
  const { signIn, signOut } = useAuthActions()

  const unreadNotifications = notifications.filter(notification => !notification.read).length

  const handleNotificationsOpenChange = (open: boolean) => {
    setNotificationsOpen(open)
    if (open) {
      setNotifications(prev =>
        prev.map(notification => ({
          ...notification,
          read: true
        }))
      )
    }
  }

  const handleNotificationStatusChange = (id: string, status: NotificationStatus) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? {
            ...notification,
            status,
            read: true
          }
          : notification
      )
    )
  }

  const handleNotificationDismiss = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }

  const handleThreadClick = (threadId: any) => {
    setCurrentThreadId(threadId)
    // Switch to chat mode
    const chatMode = allModes.find(mode => mode.id === '/chat')
    if (chatMode) {
      setCurrentMode(chatMode)
    }
  }

  const handleNewChat = () => {
    setCurrentThreadId(null)
    const chatMode = allModes.find(mode => mode.id === '/chat')
    if (chatMode) {
      setCurrentMode(chatMode)
    }
  }

  const handleDeleteClick = (threadId: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setThreadToDelete(threadId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!threadToDelete) return

    await deleteThread({ threadId: threadToDelete })
    if (currentThreadId === threadToDelete) {
      setCurrentThreadId(null)
    }
    setDeleteDialogOpen(false)
    setThreadToDelete(null)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffInHours < 168) { // Less than a week
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  const handleResourcesClick = () => {
    const resourcesMode = allModes.find(mode => mode.id === '/resources')
    if (resourcesMode) {
      setCurrentMode(resourcesMode)
    }
  }

  const handleMyJobsClick = () => {
    const myJobsMode = allModes.find(mode => mode.id === '/my-jobs')
    if (myJobsMode) {
      setCurrentMode(myJobsMode)
    }
  }

  const handleMyResumesClick = () => {
    const myResumesMode = allModes.find(mode => mode.id === '/resume')
    if (myResumesMode) {
      setCurrentMode(myResumesMode)
    }
  }

  const handleChatToggle = () => {
    const chatMode = allModes.find(mode => mode.id === '/chat')
    if (chatMode) {
      setCurrentMode(chatMode)
    }
    setIsThreadsExpanded((prev) => {
      if (currentMode.id !== '/chat') {
        return prev || true
      }
      return !prev
    })
  }

  const handleSignOut = async () => {
    await signOut()
    setCurrentThreadId(null) // Clear current thread on sign out
  }

  return (
    <div className="w-[25dvw] h-full bg-background border-r border-border flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="text-base font-semibold">JobKompass</div>
        <div className="flex h-max gap-2">
          <Popover open={notificationsOpen} onOpenChange={handleNotificationsOpenChange}>
            <PopoverTrigger className='!p-0 !m-0' asChild>
              <button
                className="!p-0 !m-0 relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Application follow-ups"
              >
                <Bell className="h-5 w-5 !p-0 !m-0" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground leading-none">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[340px] p-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div>
                  <p className="text-sm font-semibold">Application updates</p>
                  <p className="text-xs text-muted-foreground">
                    Track follow-ups and note who you heard back from.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{notifications.length} total</span>
                </div>
              </div>
              <div className="mt-3 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    All caught up! Add applications to see them here.
                  </div>
                ) : (
                  notifications.map(notification => {
                    const status = notificationStatusConfig[notification.status]
                    return (
                      <div
                        key={notification.id}
                        className="rounded-lg border border-border/60 bg-background p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold leading-tight">
                              {notification.company}
                            </p>
                            <p className="text-xs text-muted-foreground">{notification.role}</p>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {notification.lastTouchpoint}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={notification.status === "responded" ? "default" : "secondary"}
                            className="h-7 px-2 text-xs"
                            onClick={() => handleNotificationStatusChange(notification.id, "responded")}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Heard back
                          </Button>
                          <Button
                            size="sm"
                            variant={notification.status === "awaiting-response" ? "default" : "outline"}
                            className="h-7 px-2 text-xs"
                            onClick={() => handleNotificationStatusChange(notification.id, "awaiting-response")}
                          >
                            <Clock className="mr-1 h-3 w-3" />
                            Still waiting
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleNotificationDismiss(notification.id)}
                            title="Remove reminder"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          <button
            onClick={handleNewChat}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="New Chat"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {/* Links & Resources Section */}
          <button
            onClick={handleResourcesClick}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentMode.id === '/resources'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground/80 hover:text-foreground hover:bg-accent'
              }`}
          >
            <span>Links & Resources</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* My Resumes Section */}
          <button
            onClick={handleMyResumesClick}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentMode.id === '/resume'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground/80 hover:text-foreground hover:bg-accent'
              }`}
          >
            <div className="flex items-center gap-2">
              <span>My Resumes</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* My Jobs Section */}
          <button
            onClick={handleMyJobsClick}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentMode.id === '/my-jobs'
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground/80 hover:text-foreground hover:bg-accent'
              }`}
          >
            <div className="flex items-center gap-2">
              <span>My Jobs</span>
            </div>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          {/* Chat Section with expandable threads */}
          <button
            onClick={handleChatToggle}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          >
            <span>Chat</span>
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform ${isThreadsExpanded ? 'rotate-90' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isThreadsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-1 space-y-1">
                  {!isAuthenticated ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Sign in to view chat history
                    </div>
                  ) : threads === undefined ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      Loading...
                    </div>
                  ) : threads.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      No conversations yet
                    </div>
                  ) : (
                    <AnimatePresence>
                      {threads.map((thread, index) => (
                        <motion.div
                          key={thread._id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.25, delay: index * 0.05 }}
                          className={`w-full group flex items-start gap-2 px-3 py-2.5 text-sm rounded-lg transition-colors ${currentThreadId === thread._id
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/50'
                            }`}
                        >
                          <button
                            onClick={() => handleThreadClick(thread._id)}
                            className="flex-1 flex w-[70%] items-start gap-2.5 text-left"
                          >
                            <MessageSquare className="h-4 w-4 mt-1 flex-shrink-0" />
                            <div className="flex-1 text-left overflow-hidden space-y-1">
                              <div className="truncate font-medium leading-snug">{thread.title}</div>
                              <div className="text-xs text-muted-foreground leading-none">
                                {formatDate(thread.lastMessageAt)}
                              </div>
                            </div>
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(thread._id, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded flex-shrink-0"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* User info / Sign in at bottom */}
      <div className="p-3 border-t border-border">
        {isAuthenticated && user ? (
          <div className="space-y-2">
            <div className="px-3 py-2 rounded-lg bg-muted/50">
              <div className="text-sm font-medium truncate">{user.name || user.email}</div>
              {user.username && (
                <div className="text-xs text-muted-foreground">@{user.username}</div>
              )}
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        ) : (
          <Popover open={showSignIn} onOpenChange={setShowSignIn}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2">
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-6 space-y-4" side="top">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold">
                  {signInStep === "signIn" ? "Sign in to JobKompass" : "Create an account"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {signInStep === "signIn"
                    ? "Welcome back!"
                    : "Get started with your career journey."}
                </p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                setAuthLoading(true);

                try {
                  const formData = new FormData(e.currentTarget);
                  await signIn("password", formData);
                  setShowSignIn(false);
                } catch (error) {
                  setAuthError(error instanceof Error ? error.message : "Sign in failed");
                } finally {
                  setAuthLoading(false);
                }
              }} className="space-y-3">
                {signInStep === "signUp" && (
                  <>
                    <div>
                      <Input
                        name="name"
                        type="text"
                        placeholder="Full Name (optional)"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to use your email name</p>
                    </div>
                    <div>
                      <Input
                        name="username"
                        type="text"
                        placeholder="Username (optional)"
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to auto-generate from email</p>
                    </div>
                  </>
                )}
                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  className="w-full"
                />
                <Input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  className="w-full"
                />
                <input name="flow" type="hidden" value={signInStep} />

                {authError && (
                  <div className="p-3 text-sm bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                    {authError}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={authLoading}>
                  <LogIn className="mr-2 h-4 w-4" />
                  {authLoading ? "Please wait..." : signInStep === "signIn" ? "Sign in" : "Sign up"}
                </Button>
              </form>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setSignInStep(signInStep === "signIn" ? "signUp" : "signIn")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {signInStep === "signIn" ? "Don't have an account? " : "Already have an account? "}
                  <span className="text-primary font-medium">
                    {signInStep === "signIn" ? "Sign up" : "Sign in"}
                  </span>
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete this conversation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setThreadToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}