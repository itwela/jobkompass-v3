'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from "@/providers/jkAuthProvider"
import { useAuthActions } from "@convex-dev/auth/react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import JkAuthShell, { JkAuthHeading } from "@/app/jk-components/jk-auth/jkAuthShell"
import { JkField, JkFormError, jkFieldCls } from "@/app/jk-components/jkField"
import { PRICING_REDIRECT_THRESHOLD } from "@/app/lib/timePeriods"
import { trackSignup } from "@/lib/analytics/client"
import { useSubscription } from "@/providers/jkSubscriptionProvider"
import { cn } from "@/lib/utils"
import GoogleG from "@/app/jk-icons/googleG"

type Step = "signIn" | "signUp"

/** A friendly sentence for whatever Convex Auth threw. */
function authErrorMessage(error: unknown, step: Step): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : ""
  const m = raw.toLowerCase()
  if (m.includes("already exists") || (m.includes("email") && m.includes("already"))) return "An account with this email already exists. Sign in instead."
  if (m.includes("network") || m.includes("fetch") || m.includes("connection")) return "Could not reach JobKompass. Check your connection and try again."
  if (step === "signIn") return "That email and password do not match an account."
  if (m.includes("password")) return "Use a password of at least 8 characters."
  return "Could not create the account. If you already have one, sign in instead."
}

export default function AuthPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { signIn } = useAuthActions()
  const { isFree, isLoading: subscriptionLoading, subscription } = useSubscription()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldShowPricing = isFree || subscription?.status === 'cancelled'

  const [step, setStep] = useState<Step>(searchParams.get('mode') === 'signup' ? 'signUp' : 'signIn')
  useEffect(() => {
    if (searchParams.get('mode') === 'signup') setStep('signUp')
  }, [searchParams])

  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const hasRedirectedRef = useRef(false)
  const updateLastSignIn = useMutation(api.auth.updateLastSignIn)

  // Where a signed-in person goes next. A first-ever sign-in (new password
  // account or new Google account) goes to onboarding instead of the pricing modal.
  useEffect(() => {
    if (isLoading || subscriptionLoading || !isAuthenticated || !user || hasRedirectedRef.current) return
    hasRedirectedRef.current = true
    const previousLastSignInAt = (user as { lastSignInAt?: number | null }).lastSignInAt
    const next = searchParams.get('next')
    void (async () => {
      try { await updateLastSignIn() } catch (err) { console.error('Failed to update lastSignInAt:', err) }
      if (!previousLastSignInAt) return router.replace('/onboarding')
      if (next && next.startsWith('/') && !next.startsWith('//')) return router.replace(next)
      if (Date.now() - previousLastSignInAt >= PRICING_REDIRECT_THRESHOLD && shouldShowPricing) return router.replace('/pricing')
      router.replace('/app')
    })()
  }, [isAuthenticated, isLoading, subscriptionLoading, router, user, updateLastSignIn, shouldShowPricing, searchParams])

  const switchTo = (s: Step) => {
    setStep(s)
    setAuthError(null)
    const params = new URLSearchParams(searchParams.toString())
    if (s === 'signUp') params.set('mode', 'signup'); else params.delete('mode')
    router.replace(`/auth${params.toString() ? `?${params}` : ''}`, { scroll: false })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)
    try {
      await signIn("password", new FormData(e.currentTarget))
      if (step === "signUp") trackSignup()
    } catch (error) {
      setAuthError(authErrorMessage(error, step))
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogle = async () => {
    setAuthError(null)
    setGoogleLoading(true)
    try {
      await signIn("google", { redirectTo: `${window.location.origin}/auth` })
    } catch {
      setAuthError("Google sign-in is not available right now. Use your email and password.")
      setGoogleLoading(false)
    }
  }

  if (isLoading || isAuthenticated) {
    return <div className="min-h-dvh bg-background" />
  }

  const isSignUp = step === "signUp"
  const primaryCls = "h-[54px] w-full text-[16.5px] lg:h-12 lg:text-[15.5px]"

  return (
    <JkAuthShell enterKey={step} band={isSignUp ? "short" : "tall"} className={isSignUp ? "lg:pb-[138px]" : "lg:pt-[142px]"}>
      <div>
      {isSignUp ? (
        <JkAuthHeading eyebrow="Create account" title="Start your search" sub="The free plan covers 3 AI documents a month and 10 jobs." subClassName="max-w-[260px] sm:max-w-none" />
      ) : (
        <JkAuthHeading eyebrow="Sign in" title="Welcome aboard" sub="Pick up your search where you left it." subClassName="hidden lg:block" />
      )}
      </div>

      {!isSignUp && (
        <>
          <Button type="button" variant="secondary" onClick={handleGoogle} disabled={googleLoading} style={{ "--i": 3 } as React.CSSProperties} className="jk-enter mt-[17px] h-[52px] w-full border-input bg-card text-[15.5px] hover:bg-accent lg:mt-[33px] lg:h-12 lg:text-[15px]">
            <GoogleG className="size-[18px] shrink-0" />
            {googleLoading ? "Opening Google…" : "Continue with Google"}
          </Button>
          <div aria-hidden style={{ "--i": 4 } as React.CSSProperties} className="jk-enter mt-[26px] hidden items-center gap-[23px] lg:flex">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] leading-[13px] tracking-[0.12em] text-subtle-foreground">OR</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className={cn(isSignUp ? "mt-[21px] lg:mt-[37px]" : "mt-[22px] lg:mt-[21px]")}>
        <div className={cn("flex flex-col", isSignUp ? "gap-4 lg:gap-[18px]" : "gap-[14px] lg:gap-[18px]")}>
          {isSignUp && (
            <div className="grid grid-cols-2 gap-3">
              <JkField label="Full name" id="name" className="jk-enter" style={{ "--i": 5 } as React.CSSProperties}>
                <Input id="name" name="name" autoComplete="name" className={cn(jkFieldCls, "h-11")} />
              </JkField>
              <JkField label="Username" id="username" className="jk-enter" style={{ "--i": 5.5 } as React.CSSProperties}>
                <Input id="username" name="username" autoComplete="username" className={cn(jkFieldCls, "h-11")} />
              </JkField>
            </div>
          )}
          <JkField label="Email" id="email" className="jk-enter" style={{ "--i": 6 } as React.CSSProperties}>
            <Input id="email" name="email" type="email" required autoComplete="email" className={cn(jkFieldCls, isSignUp ? "h-11" : "h-12 lg:h-11")} />
          </JkField>
          <JkField
            label="Password"
            id="password"
            className="jk-enter"
            style={{ "--i": 7 } as React.CSSProperties}
            aside={!isSignUp && <Link href="/auth/reset" className="text-[12px] leading-[14px] text-muted-foreground transition-colors hover:text-foreground">Forgot password?</Link>}
          >
            <Input id="password" name="password" type="password" required minLength={8} sanitize={false} autoComplete={isSignUp ? "new-password" : "current-password"} className={cn(jkFieldCls, isSignUp ? "h-11" : "h-12 lg:h-11")} />
          </JkField>
        </div>
        <input name="flow" type="hidden" value={step} />

        {authError && <div className="mt-5"><JkFormError>{authError}</JkFormError></div>}

        <Button type="submit" disabled={authLoading} style={{ "--i": 8 } as React.CSSProperties} className={cn("jk-enter", primaryCls, isSignUp ? "mt-9 lg:mt-[38px]" : "mt-8 lg:mt-9")}>
          {authLoading ? "One moment…" : isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p style={{ "--i": 9 } as React.CSSProperties} className={cn("jk-enter text-center text-[14px] leading-[17px] text-muted-foreground lg:text-left", isSignUp ? "mt-[19px] lg:mt-[22px]" : "mt-[23px]")}>
        {isSignUp ? "Already have an account?" : "New here?"}
        <button type="button" onClick={() => switchTo(isSignUp ? "signIn" : "signUp")} className={cn("ml-1 font-normal transition-colors hover:text-foreground lg:font-medium lg:text-plan-text lg:hover:text-plan", isSignUp ? "lg:ml-[18px]" : "lg:ml-[7px]")}>
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
    </JkAuthShell>
  )
}
