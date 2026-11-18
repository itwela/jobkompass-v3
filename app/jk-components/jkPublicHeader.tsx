'use client'

import JkSignOutButton from "./jkSignOutButton"
import { useCallback, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { useAuthActions } from '@convex-dev/auth/react'
import { LogOut, User, DollarSign, Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { mainAssets } from '@/app/lib/constants'
import JkGetStartedButton from './jkGetStartedButton'
import JkMobileMenu from './jkMobileMenu'
import { useJobKompassTheme } from '@/providers/jkThemeProvider'

interface JkPublicHeaderProps {
  showPricing?: boolean
  showSignIn?: boolean
  /** Section links in the middle of the bar (landing page). */
  showNav?: boolean
  /** Sit transparently on top of the hero painting, as the landing design does. */
  overlay?: boolean
}

export default function JkPublicHeader({ 
  showPricing = false, 
  showSignIn = true,
  showNav = false,
  overlay = false,
}: JkPublicHeaderProps = {}) {
  const { user, isAuthenticated } = useAuth()
  const { planId } = useSubscription()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const { theme, toggleTheme } = useJobKompassTheme()

  const handleSignOut = async () => {
    await signOut()
    setUserMenuOpen(false)
    router.push('/')
  }

  const handleGoToApp = () => {
    setUserMenuOpen(false)
    router.push('/app')
  }

  return (
    <nav className={overlay ? "absolute inset-x-0 top-0 z-50 w-full" : "sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70"}>
      <div className={overlay ? "relative mx-auto flex h-[136px] max-w-[1248px] items-center justify-between gap-3 px-5 sm:px-6 lg:h-[92px]" : "mx-auto flex max-w-[1232px] items-center justify-between px-5 py-4 sm:px-8"}>
        <Link href="/" className={overlay ? "flex shrink-0 items-center gap-1.5 lg:items-end lg:gap-3" : "flex items-end gap-3"}>
          <motion.div
            className="shrink-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src={mainAssets.logo}
              alt="JobKompass Logo"
              width={30}
              height={30}
              className="object-contain"
              priority
            />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className={overlay ? "text-[19px] font-bold tracking-[-0.2px] text-hero-ink max-[359px]:text-[17px] lg:text-xl" : "text-xl font-medium tracking-tight"}
          >
            JobKompass
          </motion.span>
        </Link>
        {showNav && (
          <div className={overlay ? "absolute left-1/2 hidden -translate-x-1/2 items-center gap-[33px] text-[15px] font-medium text-hero-ink/90 lg:flex [&>a:hover]:text-hero-ink" : "hidden items-center gap-8 text-sm text-muted-foreground md:flex"}>
            <Link href="/#product" className="transition-colors hover:text-foreground">Product</Link>
            <Link href="/pricing" className="transition-colors hover:text-foreground">Pricing</Link>
            <Link href="/#cli" className="transition-colors hover:text-foreground">CLI</Link>
            <Link href="/free-resume-generator" className="transition-colors hover:text-foreground">Free resume generator</Link>
          </div>
        )}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 sm:gap-4"
        >
          {!overlay && (
          <>
          {/* Theme toggle always visible on public header */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full border border-border/60 bg-background/60 hover:bg-accent/70 transition-colors"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -15, y: -4 }}
              animate={{ opacity: 1, rotate: 0, y: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-warn" />
              ) : (
                <Moon className="h-4 w-4 text-foreground" />
              )}
            </motion.span>
          </Button>
          </>
          )}

          {isAuthenticated && user ? (
            <>
              {showPricing && !showNav && (
                <Link href="/pricing" className="max-sm:hidden">
                  <Button variant="ghost" size="sm">
                    Pricing
                  </Button>
                </Link>
              )}
              <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="truncate max-w-[120px] max-[380px]:max-w-[56px]">{user.name || user.email}</span>
                    {planId && planId !== 'free' && (
                      <span className={`px-1.5 py-0.5 rounded-lg text-xs font-medium ${
                        'bg-plan text-plan-foreground'
                      }`}>
                        {planId === 'starter' ? 'Starter' : 
                         planId === 'pro' ? 'Pro' : 
                         planId === 'plus' ? 'Plus' : planId}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-0">
                  <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <div className="text-sm font-medium truncate">{user.name || user.email}</div>
                      {user.username && (
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      )}
                    </div>
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={handleGoToApp}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors"
                    >
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Go to App</span>
                    </motion.div>
                    <Link href="/pricing">
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors"
                      >
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Pricing</span>
                      </motion.div>
                    </Link>
                    <JkSignOutButton icon onConfirm={handleSignOut} className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent" />
                  </div>
                </PopoverContent>
              </Popover>
            </>
          ) : (
            <>
              {showPricing && !showNav && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link href="/pricing">
                    <Button variant="ghost" size="sm">
                      Pricing
                    </Button>
                  </Link>
                </motion.div>
              )}
              {showSignIn && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={overlay && showNav ? "hidden lg:block" : undefined}
                >
                  <Link href="/auth">
                    <Button variant="ghost" size="sm" className={overlay ? "px-3 text-[15px] text-hero-ink hover:bg-hero-ink/10 hover:text-hero-ink" : undefined}>
                      Log in
                    </Button>
                  </Link>
                </motion.div>
              )}
              {showNav && <JkGetStartedButton size="default" surface="header" className={overlay ? "jk-fx jk-fx-cream h-9 px-4 text-[13.5px] max-[359px]:px-3 max-[359px]:text-[13px] lg:h-10 lg:px-[26px] lg:text-[15.5px]" : ""} />}
            </>
          )}
          {overlay && showNav && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              aria-controls="jk-mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="-mr-2 flex size-10 shrink-0 flex-col items-center justify-center gap-[3.5px] text-hero-ink max-[359px]:mr-0 max-[359px]:size-9 lg:hidden"
            >
              <span className={`h-[1.5px] w-4 rounded-full bg-current transition-transform ${mobileOpen ? "translate-y-[5px] rotate-45" : ""}`} />
              <span className={`h-[1.5px] w-4 rounded-full bg-current transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
              <span className={`h-[1.5px] w-4 rounded-full bg-current transition-transform ${mobileOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
            </button>
          )}
        </motion.div>
      </div>
      {overlay && showNav && <JkMobileMenu open={mobileOpen} onClose={closeMobile} isAuthenticated={Boolean(isAuthenticated && user)} />}
    </nav>
  )
}

