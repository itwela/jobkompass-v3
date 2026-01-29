'use client'

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Plus, Settings, LogIn, LogOut, Link2, MoreVertical, Type, ChevronDown, Briefcase, MessageSquare, Home, CreditCard } from "lucide-react";
import { useState } from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/providers/jkAuthProvider";
import { useSubscription } from "@/providers/jkSubscriptionProvider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Jk_AutoFill from "./jk-AutoFill";
import JkUpgradeButton from "./jkUpgradeButton";
import { nooutline } from "@/lib/utils";
import { mainAssets } from "@/app/lib/constants";
import Image from "next/image";
import Link from "next/link";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import JkGap from "./jkGap";

interface JkConsoleHeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export default function JkConsoleHeader({ sidebarOpen, setSidebarOpen }: JkConsoleHeaderProps) {
    const { user, isAuthenticated, isLoading: authCheckLoading } = useAuth();
    const { planId, subscription, isPro, isProAnnual } = useSubscription();
    const { getUsageStats } = useFeatureAccess();
    const usage = getUsageStats();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false)
    const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn")
    const [authError, setAuthError] = useState<string | null>(null)
    const [authLoading, setAuthLoading] = useState(false)
    
    const getErrorMessage = (error: unknown): string => {
        // Handle different error types
        if (error instanceof Error) {
            const message = error.message.toLowerCase()
            
            // Check for common error patterns and provide user-friendly messages
            if (message.includes('redirect') || message.includes('null is not an object')) {
                if (signInStep === "signIn") {
                    return "The email or password you entered is incorrect. Please check your credentials and try again."
                } else {
                    return "An account with this email may already exist. Try signing in instead, or use a different email."
                }
            }
            
            if (message.includes('user not found') || message.includes('account') || message.includes('does not exist')) {
                if (signInStep === "signIn") {
                    return "No account found with this email. Please check your email or sign up to create a new account."
                }
            }
            
            if (message.includes('password') || message.includes('incorrect') || message.includes('invalid')) {
                return "The email or password you entered is incorrect. Please check your credentials and try again."
            }
            
            if (message.includes('email') && (message.includes('already') || message.includes('exists'))) {
                return "An account with this email already exists. Please sign in instead."
            }
            
            if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
                return "Network error. Please check your internet connection and try again."
            }
            
            // Return the original message if it's user-friendly, otherwise provide a generic one
            if (message.length < 100 && !message.includes('error') && !message.includes('exception')) {
                return error.message
            }
        }
        
        // Handle non-Error objects
        if (typeof error === 'object' && error !== null) {
            const errorObj = error as any
            if (errorObj.message && typeof errorObj.message === 'string') {
                return getErrorMessage(new Error(errorObj.message))
            }
            if (errorObj.error && typeof errorObj.error === 'string') {
                return getErrorMessage(new Error(errorObj.error))
            }
        }
        
        // Default messages based on step
        if (signInStep === "signIn") {
            return "Sign in failed. Please check your email and password, then try again."
        } else {
            return "Sign up failed. Please check your information and try again. If you already have an account, try signing in instead."
        }
    }
    const [retitling, setRetitling] = useState(false)
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
    const { currentMode, setCurrentMode, allModes, currentThreadId, setCurrentThreadId } = useJobKompassChatWindow()
    const { signIn, signOut } = useAuthActions()
    
    // Data for titles, conversations, and notification badges
    const threadData = useQuery(api.threads.get, currentThreadId ? { threadId: currentThreadId } : "skip")
    const threads = useQuery(api.threads.list, isAuthenticated ? {} : "skip")
    const newJobsCount = useQuery(api.jobs.countNewJobs, isAuthenticated ? {} : "skip") || 0
    const newDocumentsCount = useQuery(api.documents.countNewDocuments, isAuthenticated ? {} : "skip") || 0
    const updateTitle = useMutation(api.threads.updateTitle)
    
    // Retitle function
    const handleRetitle = async () => {
        if (!currentThreadId || !threadData?.messages) return;
        
        setRetitling(true);
        try {
            // Get last 2000 characters from messages
            const allText = threadData.messages
                .map((msg: any) => `${msg.role}: ${msg.content}`)
                .join('\n');
            const last2000Chars = allText.slice(-2000);
            
            // Call OpenAI to generate title
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        {
                            role: 'system',
                            content: 'Generate a concise, descriptive title (max 50 characters) for this conversation. Only return the title, nothing else.'
                        },
                        {
                            role: 'user',
                            content: last2000Chars
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0.7
                })
            });
            
            const data = await response.json();
            const newTitle = data.choices[0].message.content.trim();
            
            // Update thread with new title
            await updateTitle({ threadId: currentThreadId, title: newTitle });
            
        } catch (error) {
            console.error('Error retitling:', error);
        } finally {
            setRetitling(false);
        }
    };

    // Mobile navigation helpers
    const handleNewChat = () => {
        const chatMode = allModes.find(mode => mode.id === '/chat')
        if (chatMode) {
            setCurrentMode(chatMode)
        }
    }

    const handleResourcesClick = () => {
        const resourcesMode = allModes.find(mode => mode.id === '/resources')
        if (resourcesMode) {
            setCurrentMode(resourcesMode)
        }
    }

    const handleMyDocumentsClick = () => {
        const docsMode = allModes.find(mode => mode.id === '/documents')
        if (docsMode) {
            setCurrentMode(docsMode)
        }
    }

    const handleMyJobsClick = () => {
        const jobsMode = allModes.find(mode => mode.id === '/my-jobs')
        if (jobsMode) {
            setCurrentMode(jobsMode)
        }
    }

    const handleThreadClick = (threadId: any) => {
        const chatMode = allModes.find(mode => mode.id === '/chat')
        if (chatMode) {
            setCurrentMode(chatMode)
        }
        setCurrentThreadId(threadId)
    }

    const handleSettingsClick = () => {
        const settingsMode = allModes.find(mode => mode.id === '/settings')
        if (settingsMode) {
            setCurrentMode(settingsMode)
        }
    }

    const handleSignOut = async () => {
        await signOut()
        setCurrentThreadId(null)
    }

    return ( 
        <>
            {/* Desktop Header with Breadcrumb */}
            <header className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                <div className="flex items-center gap-4">
                    {/* Mode Switcher */}
                    <DropdownMenu open={isModeMenuOpen} onOpenChange={setIsModeMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button className={`flex items-center gap-2 text-base font-semibold hover:text-primary transition-colors rounded-md px-2 py-1 ${nooutline}`}>
                                {currentMode.name}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72 border-none p-0 shadow-xl">
                            <Jk_AutoFill onSelect={() => setIsModeMenuOpen(false)} />
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                
                {/* Actions dropdown - only show in chat mode with active thread */}
                {currentMode.id === '/chat' && currentThreadId && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="p-0 hover:opacity-70 transition-opacity">
                                <MoreVertical className="h-5 w-5" />
                                <span className="sr-only">More options</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                                onClick={handleRetitle}
                                disabled={retitling}
                            >
                                <Type className="h-4 w-4 mr-2" />
                                {retitling ? 'Retitling...' : 'Retitle'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </header>
            
            {/* Mobile header with menu */}
            <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
                <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[80vw] max-w-sm sm:w-72 p-0 flex flex-col overflow-hidden">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                            <Image
                                src={mainAssets.logo}
                                alt="JobKompass Logo"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                            {/* Radix Sheet close button sits in the top-right; this empty span helps visually center the logo */}
                            <span className="w-7 h-7" aria-hidden="true" />
                        </div>
                    
                        <div className="flex-1 flex flex-col px-2">
                            <div className="space-y-1">
                                <button
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-foreground"
                                    onClick={() => {
                                        handleNewChat();
                                        setSidebarOpen(false);
                                    }}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>New Chat</span>
                                </button>
                                <button
                                    onClick={() => {
                                        handleMyJobsClick();
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                        currentMode.id === '/my-jobs'
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" />
                                        <span>My Jobs</span>
                                    </span>
                                    {newJobsCount > 0 && (
                                        <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                            {newJobsCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        handleMyDocumentsClick();
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                                        currentMode.id === '/documents'
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Type className="h-4 w-4" />
                                        <span>My Documents</span>
                                    </span>
                                    {newDocumentsCount > 0 && (
                                        <span className="bg-primary text-primary-foreground text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                            {newDocumentsCount}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        const chatMode = allModes.find(mode => mode.id === '/chat');
                                        if (chatMode) setCurrentMode(chatMode);
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        currentMode.id === '/chat'
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                    <span>Chat</span>
                                </button>
                                <button
                                    onClick={() => {
                                        handleResourcesClick();
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        currentMode.id === '/resources'
                                            ? 'bg-accent text-accent-foreground'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    }`}
                                >
                                    <Link2 className="h-4 w-4" />
                                    <span>Links & Resources</span>
                                </button>
                                <div className="mt-3 border-t border-border pt-2 flex-1 flex flex-col">
                                    <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
                                        Conversations
                                    </div>
                                    {(!isAuthenticated || threads === undefined) && (
                                        <div className="px-3 py-2 rounded-lg text-sm text-muted-foreground">
                                            {isAuthenticated ? 'Loading conversations...' : 'Sign in to view conversations'}
                                        </div>
                                    )}
                                    {threads && threads.length === 0 && (
                                        <div className="px-3 py-2 rounded-lg text-sm text-muted-foreground">
                                            No conversations yet
                                        </div>
                                    )}
                                    {threads && threads.length > 0 && (
                                        <div className="space-y-1 flex-1 overflow-y-auto max-h-[67vh] no-scrollbar">
                                            {threads.map((thread: any) => (
                                                <button
                                                    key={thread._id}
                                                    onClick={() => handleThreadClick(thread._id)}
                                                    className={`w-full flex items-start gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                                                        currentThreadId === thread._id
                                                            ? 'bg-accent text-accent-foreground'
                                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                                    }`}
                                                >
                                                    <MessageSquare className="h-4 w-4 mt-0.5" />
                                                    <div className="flex-1 overflow-hidden">
                                                        <div className="truncate font-medium">{thread.title}</div>
                                                    </div>
                                                </button>
                                            ))}
                                            <div className="h-15"></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mobile User info / Sign in - inline dropdown so it receives clicks above sheet content */}
                        <div className="relative p-3 border-t border-border mt-auto sticky bottom-0 bg-background">
                            {isAuthenticated && user ? (
                                <>
                                    {userMenuOpen && (
                                        <>
                                            {/* Overlay above sheet so clicks close menu; sits above sheet z-50 */}
                                            <div
                                                className="fixed inset-0 z-[60]"
                                                onClick={() => setUserMenuOpen(false)}
                                                aria-hidden="true"
                                            />
                                            {/* Dropdown panel: above overlay, inline in sheet so it gets clicks */}
                                            <div
                                                className="absolute bottom-full left-0 right-0 z-[70] mt-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
                                                onClick={(e) => e.stopPropagation()}
                                                role="menu"
                                            >
                                                {planId && planId !== 'free' && (
                                                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground">Documents</span>
                                                                <span className="font-medium text-foreground">
                                                                    {usage.documentsUsed}/{usage.documentsLimit}
                                                                </span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary transition-all"
                                                                    style={{
                                                                        width: `${Math.min(100, (usage.documentsUsed / usage.documentsLimit) * 100)}%`,
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-muted-foreground">Jobs</span>
                                                                <span className="font-medium text-foreground">
                                                                    {usage.jobsUsed}
                                                                    {usage.jobsLimit !== null ? `/${usage.jobsLimit}` : (planId === 'pro' || planId === 'pro-annual' ? ' / ∞' : ' / Unlimited')}
                                                                </span>
                                                            </div>
                                                            {usage.jobsLimit !== null && (
                                                                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary transition-all"
                                                                        style={{
                                                                            width: `${Math.min(100, (usage.jobsUsed / usage.jobsLimit) * 100)}%`,
                                                                        }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <Link href="/" onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); }}>
                                                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border active:bg-accent">
                                                        <Home className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium text-foreground">Landing Page</span>
                                                    </div>
                                                </Link>
                                                <div
                                                    onClick={() => { handleSettingsClick(); setUserMenuOpen(false); setSidebarOpen(false); }}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border active:bg-accent"
                                                    role="menuitem"
                                                >
                                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium text-foreground">Settings</span>
                                                </div>
                                                <Link href="/pricing" onClick={() => { setUserMenuOpen(false); setSidebarOpen(false); }}>
                                                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-b border-border active:bg-accent">
                                                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium text-foreground">
                                                            {isPro || isProAnnual ? 'Manage my plan' : 'Upgrade your plan'}
                                                        </span>
                                                    </div>
                                                </Link>
                                                <div
                                                    onClick={() => { handleSignOut(); setUserMenuOpen(false); setSidebarOpen(false); }}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors active:bg-accent"
                                                    role="menuitem"
                                                >
                                                    <LogOut className="h-4 w-4 text-destructive" />
                                                    <span className="text-sm font-medium text-destructive">Sign out</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <button
                                        type="button"
                                        className="w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left flex items-center justify-between gap-2"
                                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                                    >
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">
                                                {user.name || user.email}
                                            </div>
                                            {user.username && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    @{user.username}
                                                </div>
                                            )}
                                        </div>
                                        {planId && planId !== 'free' && (
                                            <span
                                                className="px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                                                style={
                                                    subscription?.status === 'canceled'
                                                        ? { backgroundColor: 'var(--chart-4)', color: 'white' }
                                                        : planId === 'pro' || planId === 'pro-annual'
                                                        ? { backgroundColor: '#9333ea', color: 'white' }
                                                        : planId === 'plus' || planId === 'plus-annual'
                                                        ? { backgroundColor: '#3b82f6', color: 'white' }
                                                        : { backgroundColor: '#22c55e', color: 'white' }
                                                }
                                            >
                                                {subscription?.status === 'canceled' ? (
                                                    planId === 'pro' || planId === 'pro-annual'
                                                        ? 'Renew Pro'
                                                        : planId === 'plus' || planId === 'plus-annual'
                                                        ? 'Renew Plus'
                                                        : 'Renew'
                                                ) : (
                                                    planId === 'starter' ? 'Starter' :
                                                    planId === 'pro-annual' ? 'Pro Annual' :
                                                    planId === 'plus-annual' ? 'Plus Annual' :
                                                    planId === 'pro' ? 'Pro' :
                                                    planId === 'plus' ? 'Plus' : planId
                                                )}
                                            </span>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <Popover open={showSignIn} onOpenChange={setShowSignIn}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start gap-2">
                                            <LogIn className="h-4 w-4" />
                                            Sign in
                                        </Button>
                                    </PopoverTrigger>
                                <PopoverContent align="start" className="w-80 p-6 space-y-4" side="bottom">
                                    <div className="text-center space-y-1">
                                        <h3 className="text-lg font-semibold">
                                            {signInStep === "signIn" ? "Sign in to JobKompass" : "Create an account"}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {signInStep === "signIn" 
                                                ? "Welcome back! Enter your credentials to continue." 
                                                : "Get started with your career journey today."}
                                        </p>
                                    </div>
                                    
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        setAuthError(null);
                                        setAuthLoading(true);
                                        
                                        try {
                                            const formData = new FormData(e.currentTarget);
                                            console.log("Attempting sign in (mobile) with flow:", formData.get("flow"));
                                            const result = await signIn("password", formData);
                                            console.log("Sign in result (mobile):", result);
                                            setShowSignIn(false);
                                            setSidebarOpen(false);
                                        } catch (error) {
                                            console.error("Sign in error details (mobile):", error);
                                            const friendlyMessage = getErrorMessage(error);
                                            setAuthError(friendlyMessage);
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
                                            <div className="p-4 text-sm bg-destructive/10 border border-destructive/30 rounded-lg text-destructive space-y-2">
                                                <div className="font-medium">⚠️ {signInStep === "signIn" ? "Sign in failed" : "Sign up failed"}</div>
                                                <div>{authError}</div>
                                                {signInStep === "signIn" && (
                                                    <div className="text-xs text-destructive/80 mt-2">
                                                        Don't have an account?{" "}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSignInStep("signUp")
                                                                setAuthError(null)
                                                            }}
                                                            className="underline font-medium hover:text-destructive"
                                                        >
                                                            Sign up here
                                                        </button>
                                                    </div>
                                                )}
                                                {signInStep === "signUp" && (
                                                    <div className="text-xs text-destructive/80 mt-2">
                                                        Already have an account?{" "}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSignInStep("signIn")
                                                                setAuthError(null)
                                                            }}
                                                            className="underline font-medium hover:text-destructive"
                                                        >
                                                            Sign in here
                                                        </button>
                                                    </div>
                                                )}
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
                    </SheetContent>
                </Sheet>
                
                <h1 className="text-lg font-semibold">JobKompass</h1>
                
                <div className="flex items-center gap-2">
                    <JkUpgradeButton />
                    {isAuthenticated && (
                        <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => {
                                const settingsMode = allModes.find(m => m.id === '/settings')
                                if (settingsMode) {
                                    setCurrentMode(settingsMode)
                                }
                            }}
                        >
                            <Settings className="h-5 w-5" />
                            <span className="sr-only">Settings</span>
                        </Button>
                    )}
                </div>
            </header>
        </>
    )
}

