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
import { mainAssets } from '@/app/constants'
import JkGetStartedButton from './jkGetStartedButton'

interface JkPublicHeaderProps {
  showPricing?: boolean
  showSignIn?: boolean
}

export default function JkPublicHeader({ 
  showPricing = false, 
  showSignIn = true 
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
          <Image
            src={mainAssets.logo}
            alt="JobKompass Logo"
            width={30}
            height={30}
            className="object-contain"
            priority
          />
          <span className="text-xl font-semibold tracking-tight">JobKompass</span>
        </Link>
        <div className="flex items-center gap-4">
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
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
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
              {showPricing && (
                <Link href="/pricing">
                  <Button variant="ghost" size="sm">
                    Pricing
                  </Button>
                </Link>
              )}
              {showSignIn && (
                <Link href="/auth">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
              )}
              <JkGetStartedButton />
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

