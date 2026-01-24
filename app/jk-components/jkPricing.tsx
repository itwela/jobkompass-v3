'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { Check, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import JkPublicHeader from './jkPublicHeader'


interface PlanPricing {
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

interface Plan {
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

const plans: Plan[] = [
  {
    id: 'starter',
    name: '7-Day Starter',
    description: 'Try everything for a week - no commitment',
    features: [
      'Full access for 7 days',
      '10 AI-generated documents',
      'Unlimited edits',
      'Track up to 100 jobs',
      'Unlimited links & resources',
      'Full search functionality',
      'All premium templates',
    ],
    isOneTime: true,
    oneTimePrice: '$2.99',
    oneTimePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_starter_default',
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'For active job seekers who need consistent power',
    features: [
      '60 AI-generated documents per month',
      'Unlimited edits on generated documents',
      'Track up to 100 jobs',
      'Unlimited links & resources',
      'Full search functionality',
      'All premium templates',
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
    description: 'For serious professionals managing multiple applications',
    features: [
      'Everything in Plus',
      '180 AI-generated documents per month (vs 60)',
      'Track unlimited jobs (vs 100)',
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
  const { user, isAuthenticated } = useAuth()
  const { subscription, isLoading, planId } = useSubscription()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [isAnnual, setIsAnnual] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

  const handleSubscribe = async (plan: Plan) => {
    if (!isAuthenticated || !user) {
      window.location.href = '/auth?mode=signup'
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

    try {
      // Create Stripe checkout session
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          userId: user._id || user.subject,
          email: user.email,
          customerId: subscription?.stripeCustomerId,
        }),
      })

      const data = await res.json()

      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
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
    if (plan.id === planId || (plan.id === 'starter' && planId === 'starter')) return 'Current Plan'
    if (plan.isOneTime) return 'Start 7-Day Trial'
    if (!plan.pricing) return 'Subscribe'
    
    const selectedPricing = isAnnual ? plan.pricing.annual : plan.pricing.monthly
    return `Start ${selectedPricing.trialDays}-Day Free Trial`
  }

  const isCurrentPlan = (plan: Plan) => {
    if (plan.id === 'starter') {
      return planId === 'starter'
    }
    // Check if current plan matches (accounting for monthly/annual)
    if (plan.id === 'plus') {
      return planId === 'plus' || planId === 'plus-annual'
    }
    if (plan.id === 'pro') {
      return planId === 'pro' || planId === 'pro-annual'
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <JkPublicHeader />

      <div className="flex-1 bg-gradient-to-br from-background via-background to-muted/20 py-12 px-4">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg mb-6">
            Start with a 7-day trial for just $2.99, or choose a subscription
          </p>
          
          {/* Free Plan Mention */}
          <p className="text-sm text-muted-foreground mb-8">
            Or{' '}
            <Link
              href="/app"
              className="text-primary hover:underline font-medium"
            >
              stay on the free plan
            </Link>
            {' '}with 3 documents/month and 10 job tracking
          </p>
          
          {/* Billing Toggle - Button Style */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                !isAnnual
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isAnnual
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Annual
            </button>
            {!isAnnual ? (
              <span className="text-xs text-muted-foreground">
                Switch to annual to save 25%
              </span>
            ) : (
              <span className="text-xs text-green-600 font-medium">
                You're saving 25% with annual billing
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => {
            const isStarter = plan.id === 'starter'
            const currentPricing = plan.pricing 
              ? (isAnnual ? plan.pricing.annual : plan.pricing.monthly)
              : null
            const savings = getSavings(plan)

            const isSelected = selectedPlanId === plan.id
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => !isCurrentPlan(plan) && setSelectedPlanId(plan.id)}
                className={`relative border rounded-2xl p-8 bg-card cursor-pointer transition-all duration-200 flex flex-col ${
                  isSelected
                    ? 'border-primary shadow-lg scale-105'
                    : plan.popular
                    ? 'border-primary/50 shadow-md hover:border-primary hover:shadow-lg hover:scale-105'
                    : 'border-border hover:border-primary/50 hover:shadow-md hover:scale-[1.02]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {isAnnual && currentPricing && savings && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Save ${savings.toFixed(0)}/yr
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  {isStarter && plan.oneTimePrice ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-bold">{plan.oneTimePrice}</span>
                        <span className="text-muted-foreground">one-time</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        7-day full access
                      </p>
                    </>
                  ) : currentPricing ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-bold">{currentPricing.price}</span>
                        <span className="text-muted-foreground">
                          /{isAnnual ? 'year' : 'month'}
                        </span>
                      </div>
                      {currentPricing.trialDays > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {currentPricing.trialDays}-day free trial
                        </p>
                      )}
                    </>
                  ) : null}
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isSelected && !isCurrentPlan(plan)) {
                      setSelectedPlanId(plan.id)
                    }
                    handleSubscribe(plan)
                  }}
                  disabled={isLoading || loadingPlan === plan.id || isCurrentPlan(plan)}
                  className={`w-full ${
                    isSelected
                      ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                      : 'bg-primary hover:bg-primary text-primary-foreground opacity-100'
                  }`}
                  variant="default"
                >
                  {loadingPlan === plan.id ? (
                    'Loading...'
                  ) : (
                    getButtonText(plan)
                  )}
                </Button>
              </motion.div>
            )
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            All plans include our core features. Cancel anytime.
          </p>
          <div id="free-plan-info" className="text-xs text-muted-foreground">
            <p>
              <strong>Free Plan:</strong> 3 AI-generated documents/month, unlimited edits, track up to 10 jobs, basic templates
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
