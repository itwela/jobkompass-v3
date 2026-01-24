'use client'

import { Button } from '@/components/ui/button'
import { Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface JkUpgradePromptProps {
  feature?: string
  requiredPlan?: 'plus' | 'pro'
}

export default function JkUpgradePrompt({ 
  feature = 'this feature',
  requiredPlan = 'pro'
}: JkUpgradePromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 rounded-xl border border-border bg-muted/30"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">Upgrade to {requiredPlan === 'pro' ? 'Pro' : 'Plus'}</h3>
      <p className="text-muted-foreground text-center mb-6 max-w-md">
        {feature} is available in the {requiredPlan === 'pro' ? 'Pro' : 'Plus'} plan. 
        Upgrade now to unlock all premium features.
      </p>
      
      <div className="flex items-center gap-3">
        <Link href="/pricing">
          <Button className="gap-2">
            <Zap className="h-4 w-4" />
            View Plans
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

