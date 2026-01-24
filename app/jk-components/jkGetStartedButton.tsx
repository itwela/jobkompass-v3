'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/providers/jkAuthProvider'

interface JkGetStartedButtonProps {
  size?: 'sm' | 'default' | 'lg' | 'icon'
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  className?: string
}

export default function JkGetStartedButton({ 
  size = 'sm',
  variant = 'default',
  className = ''
}: JkGetStartedButtonProps) {
  const { isAuthenticated } = useAuth()
  
  return (
    <Link href={isAuthenticated ? "/app" : "/auth"}>
      <Button size={size} variant={variant} className={className}>
        Get started
      </Button>
    </Link>
  )
}

