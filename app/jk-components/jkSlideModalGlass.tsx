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
    gradient: 'from-warn/10 to-warn/10  ',
    border: 'border-warn/30 ',
    iconBg: 'bg-warn/10 ',
    iconColor: 'text-warn-ink ',
    textPrimary: 'text-warn-ink ',
    textSecondary: 'text-warn-ink ',
    buttonBg: 'bg-warn',
    buttonHover: 'hover:bg-warn',
    hoverBg: 'hover:bg-warn/50 ',
  },
  blue: {
    gradient: 'from-brand/10 to-brand/10  ',
    border: 'border-brand/30 ',
    iconBg: 'bg-brand/10 ',
    iconColor: 'text-brand ',
    textPrimary: 'text-brand ',
    textSecondary: 'text-brand ',
    buttonBg: 'bg-brand',
    buttonHover: 'hover:bg-brand',
    hoverBg: 'hover:bg-brand/50 ',
  },
  red: {
    gradient: 'from-destructive/10 to-destructive/10  ',
    border: 'border-destructive/30 ',
    iconBg: 'bg-destructive/10 ',
    iconColor: 'text-destructive ',
    textPrimary: 'text-destructive ',
    textSecondary: 'text-destructive ',
    buttonBg: 'bg-destructive',
    buttonHover: 'hover:bg-destructive',
    hoverBg: 'hover:bg-destructive/50 ',
  },
  green: {
    gradient: 'from-ok/10 to-ok/10  ',
    border: 'border-ok/30 ',
    iconBg: 'bg-ok/10 ',
    iconColor: 'text-ok ',
    textPrimary: 'text-ok ',
    textSecondary: 'text-ok ',
    buttonBg: 'bg-ok',
    buttonHover: 'hover:bg-ok',
    hoverBg: 'hover:bg-ok/50 ',
  },
  purple: {
    gradient: 'from-bar-1/10 to-bar-1/10  ',
    border: 'border-bar-1/30 ',
    iconBg: 'bg-bar-1/10 ',
    iconColor: 'text-bar-1 ',
    textPrimary: 'text-bar-1 ',
    textSecondary: 'text-bar-1 ',
    buttonBg: 'bg-bar-1',
    buttonHover: 'hover:bg-bar-1',
    hoverBg: 'hover:bg-bar-1/50 ',
  },
  neutral: {
    gradient: 'from-muted to-muted  ',
    border: 'border-border ',
    iconBg: 'bg-muted ',
    iconColor: 'text-muted-foreground ',
    textPrimary: 'text-foreground ',
    textSecondary: 'text-foreground ',
    buttonBg: 'bg-border-strong',
    buttonHover: 'hover:bg-foreground',
    hoverBg: 'hover:bg-accent/50 ',
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
                    className={`w-full ${styles.buttonBg} ${styles.buttonHover} text-on-fill gap-2`}
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

