'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface JkUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string
  currentLimit: string
  currentPlan?: string
}

export default function JkUpgradeModal({
  isOpen,
  onClose,
  feature,
  currentLimit,
  currentPlan,
}: JkUpgradeModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/0 backdrop-blur-sm"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Upgrade Required</h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Description */}
                  <p className="text-center text-muted-foreground mb-6">
                    <span className="font-semibold text-foreground">{feature}</span> requires an upgrade to use.
                  </p>

                  {/* Current Plan Info */}
                  {currentPlan && (
                    <div className="bg-muted/30 rounded-xl p-4 mb-6 border border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Current Plan</span>
                        <span className="text-sm font-medium text-foreground capitalize">{currentPlan}</span>
                      </div>
                      {currentLimit && (
                        <div className="mt-2 pt-2 border-t border-border">
                          <span className="text-xs text-muted-foreground">{currentLimit}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CTA Button */}
                  <Link href="/pricing" onClick={onClose}>
                    <Button className="w-full">
                      View Plans
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>

                  {/* Footer text */}
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    Upgrade anytime, cancel anytime
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

