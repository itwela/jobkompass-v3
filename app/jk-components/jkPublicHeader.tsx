'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { useAuthActions } from '@convex-dev/auth/react'
import { Settings, LogOut, User, DollarSign, Moon, Sun } from 'lucide-react'
import { motion } from 'framer-motion'
import { mainAssets } from '@/app/lib/constants'
import JkGetStartedButton from './jkGetStartedButton'
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
      <div className={overlay ? "relative mx-auto flex h-[76px] max-w-[1248px] items-center justify-between gap-3 px-5 sm:px-6 lg:h-[92px]" : "mx-auto flex max-w-[1232px] items-center justify-between px-5 py-4 sm:px-8"}>
        <Link href="/" className="flex items-end gap-3">
          <motion.div
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
            className={overlay ? "text-xl font-bold tracking-[-0.2px] text-on-fill" : "text-xl font-medium tracking-tight"}
          >
            JobKompass
          </motion.span>
        </Link>
        {showNav && (
          <div className={overlay ? "absolute left-1/2 hidden -translate-x-1/2 items-center gap-[33px] text-[15px] font-medium text-on-fill/90 lg:flex [&>a:hover]:text-on-fill" : "hidden items-center gap-8 text-sm text-muted-foreground md:flex"}>
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
              {showPricing && (
                <Link href="/pricing">
                  <Button variant="ghost" size="sm">
                    Pricing
                  </Button>
                </Link>
              )}
              <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="truncate max-w-[120px]">{user.name || user.email}</span>
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
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      onClick={handleSignOut}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-accent cursor-pointer transition-colors border-t border-border"
                    >
                      <LogOut className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">Sign out</span>
                    </motion.div>
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
                >
                  <Link href="/auth">
                    <Button variant="ghost" size="sm" className={overlay ? "px-3 text-[15px] text-on-fill hover:bg-on-fill/10 hover:text-on-fill" : undefined}>
                      Log in
                    </Button>
                  </Link>
                </motion.div>
              )}
              {showNav && <JkGetStartedButton size="default" surface="header" className={overlay ? "jk-fx jk-fx-cream h-10 px-[26px] text-[15.5px]" : ""} />}
            </>
          )}
        </motion.div>
      </div>
    </nav>
  )
}

