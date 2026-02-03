'use client'

import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useState } from 'react'
import { useAuth } from '@/providers/jkAuthProvider'
import JkUpgradeModal from '@/app/jk-components/jkUpgradeModal'

interface FeatureLimits {
  documentsPerMonth: number
  jobsLimit: number | null // null means unlimited
}

const PLAN_LIMITS: Record<string, FeatureLimits> = {
  free: {
    documentsPerMonth: 3,
    jobsLimit: 10,
  },
  starter: {
    documentsPerMonth: 10, // One-time, but we'll track monthly
    jobsLimit: 100,
  },
  plus: {
    documentsPerMonth: 60,
    jobsLimit: 100,
  },
  'plus-annual': {
    documentsPerMonth: 60,
    jobsLimit: 100,
  },
  pro: {
    documentsPerMonth: 180,
    jobsLimit: null, // Unlimited
  },
  'pro-annual': {
    documentsPerMonth: 180,
    jobsLimit: null, // Unlimited
  },
}

export function useFeatureAccess() {
  const { planId, isFree, isStarter, isPlus, isPro } = useSubscription()
  const { isAuthenticated } = useAuth()
  const usage = useQuery(api.usage.getUserUsage, isAuthenticated ? {} : "skip")
  const [upgradeModal, setUpgradeModal] = useState<{
    isOpen: boolean
    feature: string
    currentLimit: string
    currentPlan?: string
  }>({
    isOpen: false,
    feature: '',
    currentLimit: '',
  })

  // Normalize planId (handles "Pro", "PRO", etc. from Stripe)
  const currentPlan = (planId || 'free').toLowerCase()
  const limits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.free

  // Check if user can generate documents
  const canGenerateDocument = () => {
    try {
      if (!usage) return true // Allow if loading

      const used = usage.documentsGeneratedThisMonth || 0
      const limit = limits.documentsPerMonth

      if (used >= limit) {
        setUpgradeModal({
          isOpen: true,
          feature: 'AI-generated documents',
          currentLimit: `${limit} documents/month`,
          currentPlan: currentPlan,
        })
        return false
      }

      return true
    } catch (error) {
      // Silently catch errors to prevent dev console spam
      console.error('Error checking document generation limit:', error)
      return true // Allow on error to prevent blocking users
    }
  }

  // Check if user can add jobs
  const canAddJob = () => {
    try {
      if (!usage) return true // Allow if loading

      const currentJobs = usage.jobsCount || 0
      const limit = limits.jobsLimit

      if (limit !== null && currentJobs >= limit) {
        setUpgradeModal({
          isOpen: true,
          feature: 'Job tracking',
          currentLimit: `${limit} jobs`,
          currentPlan: currentPlan,
        })
        return false
      }

      return true
    } catch (error) {
      // Silently catch errors to prevent dev console spam
      console.error('Error checking job limit:', error)
      return true // Allow on error to prevent blocking users
    }
  }

  // Get current usage stats
  const getUsageStats = () => {
    try {
      if (!usage) {
        return {
          documentsUsed: 0,
          documentsLimit: limits.documentsPerMonth,
          jobsUsed: 0,
          jobsLimit: limits.jobsLimit,
        }
      }

      return {
        documentsUsed: usage.documentsGeneratedThisMonth || 0,
        documentsLimit: limits.documentsPerMonth,
        jobsUsed: usage.jobsCount || 0,
        jobsLimit: limits.jobsLimit,
      }
    } catch (error) {
      // Silently catch errors to prevent dev console spam
      console.error('Error getting usage stats:', error)
      return {
        documentsUsed: 0,
        documentsLimit: limits.documentsPerMonth,
        jobsUsed: 0,
        jobsLimit: limits.jobsLimit,
      }
    }
  }

  return {
    canGenerateDocument,
    canAddJob,
    getUsageStats,
    upgradeModal,
    setUpgradeModal,
    limits,
    usage,
  }
}

