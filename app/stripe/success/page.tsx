'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/providers/jkAuthProvider'
import { CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function StripeSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      setError('No session ID found')
      return
    }

    if (!isAuthenticated || !user) {
      router.push('/auth')
      return
    }

    // Verify the session (optional - webhook handles the actual subscription creation)
    setStatus('success')
    
    // Redirect to app after a short delay
    setTimeout(() => {
      router.push('/app')
    }, 2000)
  }, [sessionId, isAuthenticated, user, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Processing your payment...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-destructive text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold">Payment Processing Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => router.push('/pricing')}>
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.push('/app')}>
              Go to App
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md">
        <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
        <h1 className="text-2xl font-bold">Payment Successful!</h1>
        <p className="text-muted-foreground">
          Your subscription has been activated. Redirecting you to the app...
        </p>
        <Link href="/app">
          <Button>Go to App</Button>
        </Link>
      </div>
    </div>
  )
}

