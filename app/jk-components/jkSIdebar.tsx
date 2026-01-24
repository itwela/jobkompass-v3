'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useAuth } from "@/providers/jkAuthProvider"
import { useSubscription } from "@/providers/jkSubscriptionProvider"
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider"
import { ChevronRight, ChevronDown, MessageSquare, Trash2, Plus, LogIn, LogOut, Settings, Search } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuthActions } from "@convex-dev/auth/react"
import { mainAssets } from "@/app/constants"
import Image from "next/image"
import Link from "next/link"
import JkGap from './jkGap'
import JkSearchModal from './jkSearchModal'

export default function JkSidebar() {
  const { user, isAuthenticated } = useAuth()
  const { planId } = useSubscription()
  const { currentThreadId, setCurrentThreadId, setCurrentMode, allModes, currentMode } = useJobKompassChatWindow()
  const [isThreadsExpanded, setIsThreadsExpanded] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [threadToDelete, setThreadToDelete] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const threads = useQuery(api.threads.list, isAuthenticated ? {} : "skip")
  const deleteThread = useMutation(api.threads.remove)
  const { signOut } = useAuthActions()

  // Listen for custom event to navigate to sign-in page
  useEffect(() => {
    const handleOpenSignIn = () => {
      window.location.href = '/auth'
    }
    window.addEventListener('jk:openSignIn', handleOpenSignIn)
    return () => {
      window.removeEventListener('jk:openSignIn', handleOpenSignIn)
    }
  }, [])

  const handleThreadClick = (threadId: any) => {
    setCurrentThreadId(threadId)
    // Switch to chat mode
    const chatMode = allModes.find(mode => mode.id === '/chat')
    if (chatMode) {
      setCurrentMode(chatMode)
    }
  }

  const handleNewChat = () => {
    // Clear current thread to show new chat interface
    setCurrentThreadId(null)
    // Always switch to chat mode to show the new chat interface
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
      // Clear current thread and switch to chat mode to show intro screen
      setCurrentThreadId(null)
      const chatMode = allModes.find(mode => mode.id === '/chat')
      if (chatMode) {
        setCurrentMode(chatMode)
      }
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

  const handleMyDocumentsClick = () => {
    const myDocumentsMode = allModes.find(mode => mode.id === '/documents')
    if (myDocumentsMode) {
      setCurrentMode(myDocumentsMode)
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

  const handleSettingsClick = () => {
    const settingsMode = allModes.find(mode => mode.id === '/settings')
    if (settingsMode) {
      setCurrentMode(settingsMode)
    }
  }

  return (
    <div className="w-[25dvw] !relative h-full bg-background border-r border-border flex flex-col overflow-hidden">

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="pl-5 pr-2 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Image src={mainAssets.logo} alt="JobKompass Logo" width={26} height={26} className="object-contain" />
            <span className="text-base font-semibold">JobKompass</span>
          </div>
          <div className="flex h-max gap-2">
            <button
              onClick={() => setSearchModalOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={handleNewChat}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

          {/* Navigation Sections - Everything else */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <div className="p-2 pb-0.5 space-y-1">
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

              {/* My Documents Section */}
              <button
                onClick={handleMyDocumentsClick}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${currentMode.id === '/resume'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground/80 hover:text-foreground hover:bg-accent'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span>My Documents</span>
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
            </div>
          </div>

          {/* Navigation Sections - Chat */}
          <div className="px-2 pt-0.5 space-y-1">

            <button
              onClick={handleChatToggle}
              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            >
              <span>Chat</span>
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isThreadsExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          </div>
          <div className="overflow-y-auto no-scrollbar">
            
          
            <div className="flex-1 min-h-0 !overflow-y-scroll no-scrollbar">
              <div className="px-2 pb-8">
                {/* Chat Section with expandable threads */}

                <AnimatePresence>
                  {isThreadsExpanded && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, maxHeight: 0 }}
                        animate={{ opacity: 1, maxHeight: '70vh' }}
                        exit={{ opacity: 0, maxHeight: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 space-y-1 max-h-[70vh] overflow-y-auto no-scrollbar">
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
                    </>
                  )}
                </AnimatePresence>
                  <JkGap size="small" />


              </div>
            </div>
          
          </div>

          {/* // REVIEW */}

        </div>

      </div>


      {/* User info / Sign in at bottom */}
      <div className="p-3 border-t border-border w-full flex-shrink-0">
        {isAuthenticated && user ? (
          <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
            <PopoverTrigger asChild>
              <button className="w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium truncate">{user.name || user.email}</div>
                  {planId && planId !== 'free' && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      planId.includes('pro') 
                        ? 'bg-primary text-primary-foreground' 
                        : planId.includes('plus')
                        ? 'bg-blue-500 text-white'
                        : 'bg-green-500 text-white'
                    }`}>
                      {planId === 'starter' ? 'Starter' : 
                       planId.includes('pro') ? 'Pro' : 
                       planId.includes('plus') ? 'Plus' : planId}
                    </span>
                  )}
                </div>
                {user.username && (
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-85 p-0 border-none shadow-lg" side="top">
              <div className="bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  onClick={() => {
                    handleSettingsClick()
                    setUserMenuOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Settings</span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 }}
                  onClick={() => {
                    handleSignOut()
                    setUserMenuOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors"
                >
                  <LogOut className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">Sign out</span>
                </motion.div>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <Link href="/auth" className="w-full">
            <Button variant="outline" className="w-full justify-start gap-2">
              <LogIn className="h-4 w-4" />
              Sign in
            </Button>
          </Link>
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

      {/* Search Modal */}
      <JkSearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </div>
  )
}