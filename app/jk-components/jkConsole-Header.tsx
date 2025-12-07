'use client'

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Plus, Settings, LogIn, Link2, MoreVertical, Type, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useJobKompassChatWindow } from "@/providers/jkChatWindowProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuth } from "@/providers/jkAuthProvider";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Jk_AutoFill from "./jk-AutoFill";

interface JkConsoleHeaderProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export default function JkConsoleHeader({ sidebarOpen, setSidebarOpen }: JkConsoleHeaderProps) {
    const { user, isAuthenticated, isLoading: authCheckLoading } = useAuth();
    const [showSignIn, setShowSignIn] = useState(false)
    const [signInStep, setSignInStep] = useState<"signIn" | "signUp">("signIn")
    const [authError, setAuthError] = useState<string | null>(null)
    const [authLoading, setAuthLoading] = useState(false)
    const [retitling, setRetitling] = useState(false)
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false)
    const { currentMode, setCurrentMode, allModes, currentThreadId } = useJobKompassChatWindow()
    const { signIn } = useAuthActions()
    
    const threadData = useQuery(api.threads.get, currentThreadId ? { threadId: currentThreadId } : "skip")
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

    return (
        <>
            {/* Desktop Header with Breadcrumb */}
            <header className="hidden lg:flex items-center justify-between px-6 py-4 border-b border-border bg-background">
                <div className="flex items-center gap-4">
                    {/* Mode Switcher */}
                    <DropdownMenu open={isModeMenuOpen} onOpenChange={setIsModeMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-2 text-base font-semibold hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 rounded-md px-2 py-1">
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
                                <Type className="h-4 w-4" />
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
                            <span className="sr-only">Toggle sidebar</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-64 p-0 flex flex-col">
                        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                        <div className="p-4 border-b border-border">
                            <h2 className="text-lg font-semibold tracking-tight">JobKompass</h2>
                        </div>
                        <div className="flex items-center justify-between px-4 pb-4 pt-2">
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

                        {/* Mobile User info / Sign in */}
                        <div className="p-3 border-t border-border">
                            {isAuthenticated && user ? (
                                <div className="px-3 py-2 rounded-lg bg-muted/50">
                                    <div className="text-sm font-medium truncate">{user.email}</div>
                                    <div className="text-xs text-muted-foreground">Signed in</div>
                                </div>
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
                                            setAuthError(error instanceof Error ? error.message : "Sign in failed. Please check your credentials and try again.");
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
                    </SheetContent>
                </Sheet>
                
                <h1 className="text-lg font-semibold">JobKompass</h1>
                
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                </Button>
            </header>
        </>
    )
}

