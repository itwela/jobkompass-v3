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
import { Settings, LogOut, User, DollarSign } from 'lucide-react'
import { motion } from 'framer-motion'
import { mainAssets } from '@/app/lib/constants'
import JkGetStartedButton from './jkGetStartedButton'

interface JkPublicHeaderProps {
  showPricing?: boolean
  showSignIn?: boolean
  showFreeResumeParser?: boolean
}

export default function JkPublicHeader({ 
  showPricing = false, 
  showSignIn = true,
  showFreeResumeParser = true
}: JkPublicHeaderProps = {}) {
  const { user, isAuthenticated } = useAuth()
  const { planId } = useSubscription()
  const { signOut } = useAuthActions()
  const router = useRouter()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

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
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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
            className="text-xl font-semibold tracking-tight"
          >
            JobKompass
          </motion.span>
        </Link>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-2 sm:gap-4"
        >
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
                        planId === 'pro' 
                          ? 'bg-primary text-primary-foreground' 
                          : planId === 'plus'
                          ? 'bg-blue-500 text-white'
                          : 'bg-green-500 text-white'
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
              {showFreeResumeParser && (
                <Link href="/free-resume-parser">
                  <Button variant="ghost" size="sm">
                    Free Resume Generator
                  </Button>
                </Link>
              )}
              {showPricing && (
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
                    <Button variant="ghost" size="sm">
                      Sign in
                    </Button>
                  </Link>
                </motion.div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </nav>
  )
}

