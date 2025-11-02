'use client'

import JkInputSection from "./jkInputSection";
import JkChatWindow from "./jkChatWindow";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Plus, Settings, LogIn, Link2 } from "lucide-react";
import { useState } from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/providers/jkAuthProvider";

export default function JkConsole() {
    const { user, isAuthenticated, isLoading: authCheckLoading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [showSignIn, setShowSignIn] = useState(false)
    const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn")
    const [authError, setAuthError] = useState<string | null>(null)
    const [authLoading, setAuthLoading] = useState(false)
    const { currentMode, setCurrentMode, allModes } = useJobKompassChatWindow()
    const { signIn } = useAuthActions()

    // Debug log for auth state
    console.log("Console - Auth state:", { user, isAuthenticated, authCheckLoading });

    return (
        <div className="flex h-screen w-full bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-border bg-sidebar">
                {/* Sidebar header */}
                <div className="flex items-center justify-between p-3">
                    <Popover open={showSignIn} onOpenChange={setShowSignIn}>
                        <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                                    JK
                                </div>
                                <span className="text-sm font-semibold tracking-tight">JobKompass</span>
                            </button>
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
                                    console.log("Attempting sign in with flow:", formData.get("flow"));
                                    const result = await signIn("password", formData);
                                    console.log("Sign in result:", result);
                                    setShowSignIn(false);
                                } catch (error) {
                                    console.error("Sign in error details:", error);
                                    setAuthError(error instanceof Error ? error.message : "Sign in failed. Please check your credentials and try again.");
                                } finally {
                                    setAuthLoading(false);
                                }
                            }} className="space-y-3">
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
                    
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <Plus className="h-4 w-4" />
                            <span className="sr-only">New chat</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                            <Settings className="h-4 w-4" />
                            <span className="sr-only">Settings</span>
                        </Button>
                    </div>
                </div>
                
                {/* Conversation list */}
                <div className="flex-1 overflow-y-auto chat-scroll p-2">
                    <div className="space-y-1">
                        <button
                            onClick={() => {
                                const resourcesMode = allModes.find(m => m.id === '/resources')
                                if (resourcesMode) setCurrentMode(resourcesMode)
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
                        {/* Placeholder for conversation items */}
                        <div className="px-3 py-2 rounded-lg text-sm text-muted-foreground">
                            No conversations yet
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Desktop Header with Breadcrumb */}
                <header className="hidden lg:flex items-center px-6 py-4 border-b border-border bg-background">
                    <div className="text-base font-semibold">{currentMode.name}</div>
                </header>
                
                {/* Mobile header with menu */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle sidebar</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0">
                            <div className="p-4 border-b border-border">
                                <Popover open={showSignIn} onOpenChange={setShowSignIn}>
                                    <PopoverTrigger asChild>
                                        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors w-full">
                                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                                                JK
                                            </div>
                                            <span className="text-sm font-semibold tracking-tight">JobKompass</span>
                                        </button>
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
                                                setAuthError(error instanceof Error ? error.message : "Sign in failed. Please check your credentials and try again.");
                                            } finally {
                                                setAuthLoading(false);
                                            }
                                        }} className="space-y-3">
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
                            </div>
                            <div className="flex items-center justify-between px-4 pb-4">
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                    <Plus className="h-4 w-4" />
                                    <span className="sr-only">New chat</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                                    <Settings className="h-4 w-4" />
                                    <span className="sr-only">Settings</span>
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto chat-scroll p-2">
                                <div className="space-y-1">
                                    <button
                                        onClick={() => {
                                            const resourcesMode = allModes.find(m => m.id === '/resources')
                                            if (resourcesMode) {
                                                setCurrentMode(resourcesMode)
                                                setSidebarOpen(false)
                                            }
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
                                    <div className="px-3 py-2 rounded-lg text-sm text-muted-foreground">
                                        No conversations yet
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                    
                    <h1 className="text-lg font-semibold">JobKompass</h1>
                    
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Button>
                </header>

                {/* Chat Window */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <JkChatWindow />
                </div>

                {/* Input Section */}
                <div className="border-t border-border bg-background px-6 py-6">
                    <div className="max-w-3xl mx-auto w-full">
                        <JkInputSection />
                    </div>
                </div>
            </main>
        </div>
    )
}
