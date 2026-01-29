'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from "@/providers/jkAuthProvider"
import { useAuthActions } from "@convex-dev/auth/react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogIn, ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import { mainAssets } from "@/app/lib/constants"
import JkPublicHeader from "@/app/jk-components/jkPublicHeader"
import JkPricingModal from "@/app/jk-components/jkPricingModal"
import { PRICING_REDIRECT_THRESHOLD } from "@/app/lib/timePeriods"
import { useSubscription } from "@/providers/jkSubscriptionProvider"

export default function AuthPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { signIn } = useAuthActions()
  const { isFree, isLoading: subscriptionLoading, subscription } = useSubscription()
  const router = useRouter()
  
  // Check if user should see pricing prompts (free plan or cancelled subscription)
  const shouldShowPricing = isFree || subscription?.status === 'cancelled'
  const searchParams = useSearchParams()
  const [signInStep, setSignInStep] = useState<"signIn" | "signUp">(
    searchParams.get('mode') === 'signup' ? 'signUp' : 'signIn'
  )
  // Sync signInStep to URL so /auth?mode=signup always shows signup (e.g. from pricing)
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setSignInStep('signUp')
    }
  }, [searchParams])
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [wasSignUp, setWasSignUp] = useState(false)
  const hasRedirectedRef = useRef(false)
  const updateLastSignIn = useMutation(api.auth.updateLastSignIn)

  // Redirect if already authenticated
  useEffect(() => {
    // Wait for both auth and subscription to load before checking redirect
    if (!isLoading && !subscriptionLoading && isAuthenticated && user && !hasRedirectedRef.current) {
      const checkRedirect = async () => {
        hasRedirectedRef.current = true // Prevent multiple redirects
        
        // Get the lastSignInAt before we update it
        const previousLastSignInAt = (user as any)?.lastSignInAt
        
        // Check if first sign-up (no previous lastSignInAt)
        if (wasSignUp && !previousLastSignInAt) {
          // First sign-up: show pricing modal if on free plan or cancelled subscription
          if (shouldShowPricing) {
            setShowPricingModal(true)
          }
          // Update lastSignInAt in background
          try {
            await updateLastSignIn()
          } catch (err) {
            console.error('Failed to update lastSignInAt:', err)
          }
          // If not free plan and not cancelled, go directly to app
          if (!shouldShowPricing) {
            router.replace('/app')
            return
          }
          return // Don't redirect yet, let modal show if free plan or cancelled
        } else if (previousLastSignInAt) {
          // Check if enough time has passed
          const timeSinceLastSignIn = Date.now() - previousLastSignInAt
          if (timeSinceLastSignIn >= PRICING_REDIRECT_THRESHOLD) {
            // Update lastSignInAt in background
            try {
              await updateLastSignIn()
            } catch (err) {
              console.error('Failed to update lastSignInAt:', err)
            }
            // Haven't signed in for threshold time: redirect to pricing if on free plan or cancelled
            if (shouldShowPricing) {
              router.replace('/pricing')
              return
            }
            // If not free plan and not cancelled, go to app
            router.replace('/app')
            return
          }
        }
        
        // Update lastSignInAt
        try {
          await updateLastSignIn()
        } catch (err) {
          console.error('Failed to update lastSignInAt:', err)
        }
        
        // Otherwise go to app
        router.replace('/app')
      }
      
      checkRedirect()
    }
  }, [isAuthenticated, isLoading, subscriptionLoading, router, user, wasSignUp, updateLastSignIn, shouldShowPricing])

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const isSignUp = signInStep === "signUp"
      setWasSignUp(isSignUp)
      
      await signIn("password", formData)
      // Redirect will happen via useEffect when isAuthenticated changes
    } catch (error) {
      console.error('Authentication error:', error)
      const friendlyMessage = getErrorMessage(error)
      setAuthError(friendlyMessage)
    } finally {
      setAuthLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (isAuthenticated) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JkPublicHeader showPricing={true} />

      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-border">
            
            <div className="flex items-center justify-between pt-4">

              <Link href="/app" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="h-4 w-4" />
                Back to app
              </Link>
              <div className="flex items-center gap-3 mb-4">
                <Image src={mainAssets.logo} alt="JobKompass Logo" width={32} height={32} className="object-contain" />
              </div>
            
            </div>

            <div className="text-center space-y-1">
              <h1 className="text-2xl font-semibold">
                {signInStep === "signIn" ? "Sign in to JobKompass" : "Create an account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {signInStep === "signIn"
                  ? "Welcome back!"
                  : "Get started with your career journey."}
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {signInStep === "signUp" && (
                <>
                  <div>
                    <Input
                      name="name"
                      type="text"
                      placeholder="Full Name"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Input
                      name="username"
                      type="text"
                      placeholder="Username"
                      className="w-full"
                    />
                  </div>
                </>
              )}
              <div>
                <Input
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  className="w-full"
                />
              </div>
              <div>
                <Input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  className="w-full"
                />
              </div>
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

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setSignInStep(signInStep === "signIn" ? "signUp" : "signIn")
                  setAuthError(null)
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {signInStep === "signIn" ? "Don't have an account? " : "Already have an account? "}
                <span className="text-primary font-medium">
                  {signInStep === "signIn" ? "Sign up" : "Sign in"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      </div>
      
      <JkPricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
    </div>
  )
}

