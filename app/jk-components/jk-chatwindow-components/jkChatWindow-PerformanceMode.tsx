'use client'

import { TrendingUp } from 'lucide-react'

export default function JkCW_PerformanceMode() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
          <TrendingUp className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Coming soon
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Get ready for analytics and performance—resume response rates, application tracking, and more. We&apos;re building it.
          </p>
        </div>
      </div>
    </div>
  )
}
