'use client'

import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import Link from 'next/link'

export default function JkUpgradeButton() {
  const { isFree, hasActiveSubscription } = useSubscription()
  
  // Only show if user has no active subscription
  if (!isFree || hasActiveSubscription) {
    return null
  }

  return (
    <Link href="/pricing">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">Upgrade</span>
      </Button>
    </Link>
  )
}

