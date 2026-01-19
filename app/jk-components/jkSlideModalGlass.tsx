'use client'

import React, { useState, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Minimize2, Maximize2, LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type ModalVariant = 'amber' | 'blue' | 'red' | 'green' | 'purple' | 'neutral'

interface VariantStyles {
  gradient: string
  border: string
  iconBg: string
  iconColor: string
  textPrimary: string
  textSecondary: string
  buttonBg: string
  buttonHover: string
  hoverBg: string
}

const variantStylesMap: Record<ModalVariant, VariantStyles> = {
  amber: {
    gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/90 dark:to-orange-950/90',
    border: 'border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-100 dark:bg-amber-900',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textPrimary: 'text-amber-900 dark:text-amber-100',
    textSecondary: 'text-amber-800 dark:text-amber-200',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
    hoverBg: 'hover:bg-amber-200/50 dark:hover:bg-amber-800/50',
  },
  blue: {
    gradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/90 dark:to-cyan-950/90',
    border: 'border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-100 dark:bg-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textPrimary: 'text-blue-900 dark:text-blue-100',
    textSecondary: 'text-blue-800 dark:text-blue-200',
    buttonBg: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
    hoverBg: 'hover:bg-blue-200/50 dark:hover:bg-blue-800/50',
  },
  red: {
    gradient: 'from-red-50 to-rose-50 dark:from-red-950/90 dark:to-rose-950/90',
    border: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-100 dark:bg-red-900',
    iconColor: 'text-red-600 dark:text-red-400',
    textPrimary: 'text-red-900 dark:text-red-100',
    textSecondary: 'text-red-800 dark:text-red-200',
    buttonBg: 'bg-red-600',
    buttonHover: 'hover:bg-red-700',
    hoverBg: 'hover:bg-red-200/50 dark:hover:bg-red-800/50',
  },
  green: {
    gradient: 'from-green-50 to-emerald-50 dark:from-green-950/90 dark:to-emerald-950/90',
    border: 'border-green-200 dark:border-green-800',
    iconBg: 'bg-green-100 dark:bg-green-900',
    iconColor: 'text-green-600 dark:text-green-400',
    textPrimary: 'text-green-900 dark:text-green-100',
    textSecondary: 'text-green-800 dark:text-green-200',
    buttonBg: 'bg-green-600',
    buttonHover: 'hover:bg-green-700',
    hoverBg: 'hover:bg-green-200/50 dark:hover:bg-green-800/50',
  },
  purple: {
    gradient: 'from-purple-50 to-violet-50 dark:from-purple-950/90 dark:to-violet-950/90',
    border: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-100 dark:bg-purple-900',
    iconColor: 'text-purple-600 dark:text-purple-400',
    textPrimary: 'text-purple-900 dark:text-purple-100',
    textSecondary: 'text-purple-800 dark:text-purple-200',
    buttonBg: 'bg-purple-600',
    buttonHover: 'hover:bg-purple-700',
    hoverBg: 'hover:bg-purple-200/50 dark:hover:bg-purple-800/50',
  },
  neutral: {
    gradient: 'from-zinc-50 to-slate-50 dark:from-zinc-950/90 dark:to-slate-950/90',
    border: 'border-zinc-200 dark:border-zinc-800',
    iconBg: 'bg-zinc-100 dark:bg-zinc-900',
    iconColor: 'text-zinc-600 dark:text-zinc-400',
    textPrimary: 'text-zinc-900 dark:text-zinc-100',
    textSecondary: 'text-zinc-800 dark:text-zinc-200',
    buttonBg: 'bg-zinc-600',
    buttonHover: 'hover:bg-zinc-700',
    hoverBg: 'hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50',
  },
}

interface JkSlideModalGlassProps {
  /** Control visibility of the modal */
  isOpen: boolean
  /** Title shown in the modal header */
  title: string
  /** Short text shown when minimized */
  minimizedText?: string
  /** Description/body text */
  description?: string
  /** Icon component to display */
  icon?: LucideIcon
  /** Color variant for the modal */
  variant?: ModalVariant
  /** Primary action button text */
  actionText?: string
  /** Primary action button icon */
  actionIcon?: LucideIcon
  /** Callback when primary action is clicked */
  onAction?: () => void
  /** Whether to allow minimizing */
  canMinimize?: boolean
  /** Initial minimized state */
  defaultMinimized?: boolean
  /** Custom content to render instead of description */
  children?: ReactNode
  /** Custom class name for the wrapper */
  className?: string
  /** Position when expanded - default is center */
  position?: 'center' | 'top'
}

export default function JkSlideModalGlass({
  isOpen,
  title,
  minimizedText,
  description,
  icon: Icon,
  variant = 'amber',
  actionText,
  actionIcon: ActionIcon,
  onAction,
  canMinimize = true,
  defaultMinimized = false,
  children,
  className = '',
  position = 'center',
}: JkSlideModalGlassProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized)
  const styles = variantStylesMap[variant]

  const positionClasses = position === 'center' 
    ? (isMinimized ? 'top-4' : 'top-1/2 -translate-y-1/2')
    : 'top-4'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`
            absolute z-50 left-1/2 -translate-x-1/2
            ${positionClasses}
            ${className}
          `}
        >
          <motion.div 
            layout
            className={`
              bg-gradient-to-br ${styles.gradient}
              border ${styles.border}
              rounded-xl shadow-2xl backdrop-blur-sm
              ${isMinimized ? 'px-4 py-2' : 'p-6 max-w-md'}
            `}
          >
            {isMinimized ? (
              <div className="flex items-center gap-3">
                {Icon && <Icon className={`h-4 w-4 ${styles.iconColor}`} />}
                <span className={`text-sm font-medium ${styles.textSecondary}`}>
                  {minimizedText || title}
                </span>
                {canMinimize && (
                  <button
                    onClick={() => setIsMinimized(false)}
                    className={`p-1 ${styles.hoverBg} rounded-md transition-colors`}
                  >
                    <Maximize2 className={`h-4 w-4 ${styles.iconColor}`} />
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {Icon && (
                      <div className={`p-2 ${styles.iconBg} rounded-lg`}>
                        <Icon className={`h-5 w-5 ${styles.iconColor}`} />
                      </div>
                    )}
                    <h3 className={`font-semibold ${styles.textPrimary}`}>
                      {title}
                    </h3>
                  </div>
                  {canMinimize && (
                    <button
                      onClick={() => setIsMinimized(true)}
                      className={`p-1.5 ${styles.hoverBg} rounded-md transition-colors`}
                      title="Minimize"
                    >
                      <Minimize2 className={`h-4 w-4 ${styles.iconColor}`} />
                    </button>
                  )}
                </div>
                
                {children ? (
                  children
                ) : (
                  description && (
                    <p className={`text-sm ${styles.textSecondary} mb-4 leading-relaxed`}>
                      {description}
                    </p>
                  )
                )}
                
                {actionText && onAction && (
                  <Button
                    onClick={onAction}
                    className={`w-full ${styles.buttonBg} ${styles.buttonHover} text-white gap-2`}
                  >
                    {ActionIcon && <ActionIcon className="h-4 w-4" />}
                    {actionText}
                  </Button>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Export variant type for external use
export type { ModalVariant, JkSlideModalGlassProps }

