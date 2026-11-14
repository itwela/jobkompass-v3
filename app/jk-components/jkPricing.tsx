'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import JkPricingView from './jk-pricing/jkPricingView'
import { trackCheckoutStarted, trackPlanUpgrade } from '@/lib/analytics/client'


export interface PlanPricing {
  monthly: {
    price: string
    priceId: string
    trialDays: number
  }
  annual: {
    price: string
    priceId: string
    trialDays: number
  }
}

export interface Plan {
  id: string
  name: string
  description: string
  features: string[]
  popular?: boolean
  pricing?: PlanPricing // For paid plans
  isOneTime?: boolean // For starter plan
  oneTimePrice?: string
  oneTimePriceId?: string
}

export const plans: Plan[] = [
  {
    id: 'starter',
    name: '7-Day Starter',
    description: 'A week of full access, no commitment',
    features: [
      'Full access for 7 days',
      '10 AI documents',
      'Track up to 100 jobs',
      'Jake and Joseph templates',
    ],
    isOneTime: true,
    oneTimePrice: '$2.99',
    oneTimePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_starter_default',
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'For active job seekers',
    features: [
      '60 AI documents per month',
      'Track up to 100 jobs',
      'Jake and Joseph templates',
      'Chrome extension',
    ],
    pricing: {
      monthly: {
        price: '$9.99',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID || 'price_plus_default',
        trialDays: 3,
      },
      annual: {
        price: '$89.99',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PLUS_ANNUAL_PRICE_ID || 'price_plus_annual_default',
        trialDays: 7,
      },
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For managing many applications',
    features: [
      'Everything in Plus',
      '180 AI documents per month',
      'Unlimited jobs',
      'Mar template',
      'jk CLI and agent access',
      'Priority support',
    ],
    popular: true,
    pricing: {
      monthly: {
        price: '$19.99',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro_default',
        trialDays: 3,
      },
      annual: {
        price: '$179.99',
        priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE_ID || 'price_pro_annual_default',
        trialDays: 7,
      },
    },
  },
]

export default function JkPricing() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { subscription, isLoading, planId } = useSubscription()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [isAnnual, setIsAnnual] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const handleSubscribe = async (plan: Plan) => {
    if (!isAuthenticated || !user) {
      trackPlanUpgrade({
        surface: 'pricing',
        planId: plan.id,
        isAnnual,
        isOneTime: Boolean(plan.isOneTime),
        authenticated: false,
      })
      router.push('/auth?mode=signup')
      return
    }

    setLoadingPlan(plan.id)

    let priceId: string

    if (plan.isOneTime && plan.oneTimePriceId) {
      priceId = plan.oneTimePriceId
    } else if (plan.pricing) {
      const selectedPricing = isAnnual ? plan.pricing.annual : plan.pricing.monthly
      priceId = selectedPricing.priceId
    } else {
      setLoadingPlan(null)
      return
    }

    trackPlanUpgrade({
      surface: 'pricing',
      planId: plan.id,
      isAnnual,
      isOneTime: Boolean(plan.isOneTime),
      authenticated: true,
    })

    try {
      // Create Stripe checkout session
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: (user as any).convex_user_id || user._id || user.subject,
          email: user.email,
          customerId: subscription?.stripeCustomerId,
        }),
      })

      const data = await res.json()

      if (data.checkoutUrl) {
        trackCheckoutStarted({
          planId: plan.id,
          isAnnual,
          isOneTime: Boolean(plan.isOneTime),
        })
        window.location.href = data.checkoutUrl
      } else {
        console.error('No checkout URL returned')
        alert('Failed to create checkout session. Please try again.')
        setLoadingPlan(null)
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Something went wrong. Please try again.')
      setLoadingPlan(null)
    }
  }

  const getButtonText = (plan: Plan) => {
    // Check if this is the current plan and subscription is canceled
    if (isCurrentPlan(plan) && subscription?.status === 'canceled') {
      return 'Renew Today'
    }
    if (isCurrentPlan(plan)) return 'Current Plan'
    if (plan.isOneTime) return 'Start'
    if (!plan.pricing) return 'Subscribe'
    
    const selectedPricing = isAnnual ? plan.pricing.annual : plan.pricing.monthly
    return `Start ${selectedPricing.trialDays}-Day Free Trial`
  }

  const isCurrentPlan = (plan: Plan) => {
    if (plan.id === 'starter') {
      return planId === 'starter'
    }
    // Check if current plan matches the exact billing period (monthly vs annual)
    if (plan.id === 'plus') {
      // If viewing annual, only match if planId is plus-annual
      // If viewing monthly, only match if planId is plus
      return isAnnual ? planId === 'plus-annual' : planId === 'plus'
    }
    if (plan.id === 'pro') {
      // If viewing annual, only match if planId is pro-annual
      // If viewing monthly, only match if planId is pro
      return isAnnual ? planId === 'pro-annual' : planId === 'pro'
    }
    return plan.id === planId
  }

  const getSavings = (plan: Plan) => {
    if (!plan.pricing) return null
    const monthlyTotal = parseFloat(plan.pricing.monthly.price.replace('$', '')) * 12
    const annualPrice = parseFloat(plan.pricing.annual.price.replace('$', ''))
    const savings = monthlyTotal - annualPrice
    return savings > 0 ? savings : null
  }

  // Sentence-case labels to match the design ("Start 3-day free trial", "Current plan").
  const actionLabel = (plan: Plan) => {
    if (plan.id === 'free') return isAuthenticated ? 'Go to the app' : 'Get started'
    const t = getButtonText(plan)
    return t === 'Current Plan' ? 'Current plan' : t.replace(/^Start (\d+)-Day Free Trial$/, 'Start $1-day free trial')
  }
  const actionDisabled = (plan: Plan) =>
    plan.id !== 'free' && (loadingPlan === plan.id || (isCurrentPlan(plan) && subscription?.status !== 'canceled'))
  const onSelect = (plan: Plan) => {
    if (plan.id === 'free') { router.push(isAuthenticated ? '/app' : '/auth?mode=signup'); return }
    void handleSubscribe(plan)
  }

  return (
    <JkPricingView
      isAnnual={isAnnual}
      onAnnualChange={setIsAnnual}
      actionLabel={actionLabel}
      actionDisabled={actionDisabled}
      loadingPlanId={loadingPlan}
      onSelect={onSelect}
    />
  )
}
