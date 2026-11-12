'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/jkAuthProvider'
import { trackCtaClicked } from '@/lib/analytics/client'

interface JkGetStartedButtonProps {
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'plan' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
  surface?: 'hero' | 'header'
  label?: string
}

export default function JkGetStartedButton({ 
  size = 'sm',
  variant = 'default',
  className = '',
  surface = 'header',
  label = 'Get started',
}: JkGetStartedButtonProps) {
  const { isAuthenticated } = useAuth()
  
  return (
    <Link
      href={isAuthenticated ? "/app" : "/auth"}
      onClick={() => {
        if (!isAuthenticated) trackCtaClicked({ cta: 'signup', surface })
      }}
    >
      <Button size={size} variant={variant} className={className}>
        {label}
      </Button>
    </Link>
  )
}

