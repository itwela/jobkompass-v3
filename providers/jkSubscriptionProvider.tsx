'use client'

import { createContext, useContext, ReactNode, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'

interface SubscriptionContextType {
  subscription: any | null
  isLoading: boolean
  isFree: boolean
  isStarter: boolean
  isPlus: boolean
  isPro: boolean
  isPlusAnnual: boolean
  isProAnnual: boolean
  hasActiveSubscription: boolean
  isTrialing: boolean
  planId: string | null
  // Price IDs for checkout
  priceIds: {
    starter: string
    plus: string
    pro: string
    plusAnnual: string
    proAnnual: string
  }
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null)

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const subscription = useQuery(api.subscriptions.getUserSubscription)
  const ensureConvexUserId = useMutation(api.auth.ensureConvexUserId)
  
  const planId = subscription?.planId || null
  const status = subscription?.status || null
  
  // Ensure convex_user_id is set for the user (runs once on mount)
  // This ensures new signups and existing users have convex_user_id set
  useEffect(() => {
    ensureConvexUserId().catch(console.error)
  }, [ensureConvexUserId])
  
  const value: SubscriptionContextType = {
    subscription,
    isLoading: subscription === undefined,
    isFree: !subscription || planId === 'free',
    isStarter: planId === 'starter' && (status === 'active' || status === 'trialing'),
    isPlus: (planId === 'plus' || planId === 'plus-annual') && (status === 'active' || status === 'trialing'),
    isPro: (planId === 'pro' || planId === 'pro-annual') && (status === 'active' || status === 'trialing'),
    isPlusAnnual: planId === 'plus-annual' && (status === 'active' || status === 'trialing'),
    isProAnnual: planId === 'pro-annual' && (status === 'active' || status === 'trialing'),
    hasActiveSubscription: status === 'active' || status === 'trialing',
    isTrialing: status === 'trialing',
    planId,
    priceIds: {
      starter: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_starter_default',
      plus: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID || 'price_plus_default',
      pro: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro_default',
      plusAnnual: process.env.NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID || 'price_plus_annual_default',
      proAnnual: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual_default',
    },
  }

  
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider')
  }
  return ctx
}

