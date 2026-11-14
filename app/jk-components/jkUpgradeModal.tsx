'use client'

/**
 * D15 / M17 Upgrade. Opened wherever a feature is locked (search, CLI keys, templates, AI
 * document and job limits). The headline names the feature; the left side says what the
 * offered plan adds over the current one; the right side is billing with real prices from
 * jkPricing.tsx and the trial length Stripe applies (3 days monthly, 7 days annual).
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { trackCheckoutStarted, trackUpgradeClicked } from '@/lib/analytics/client'
import { useAuth } from '@/providers/jkAuthProvider'
import { useSubscription } from '@/providers/jkSubscriptionProvider'
import { PLAN_LIMITS } from '@/hooks/useFeatureAccess'
import { plans } from './jkPricing'
import JkArt from './jkArt'
import { cn } from '@/lib/utils'
import { formatUsd, priceNumber, trialEndLabel, upgradeOffer, type JkPaidTarget } from '@/lib/upgradeOffer'

interface JkUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  /** The locked feature, e.g. "jk CLI", "Search functionality", "Mar resume template". */
  feature: string
  currentLimit?: string
  currentPlan?: string
  /** Force the plan offered (a template's minimum plan, say). Otherwise derived from the feature. */
  requiredPlan?: JkPaidTarget
}

const mono = "font-mono text-[10.5px] font-medium uppercase tracking-[2px]"

function JkBillingOption({ selected, onSelect, label, price, sub, save }: {
  selected: boolean; onSelect: () => void; label: string; price: string; sub: string; save?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex min-h-[72px] w-full items-center gap-4 rounded-[20px] border px-5 text-left transition-colors max-sm:min-h-[108px] max-sm:flex-col max-sm:items-start max-sm:gap-0 max-sm:px-4 max-sm:pt-4",
        selected ? "border-plan bg-accent" : "border-input bg-card hover:bg-accent/60",
      )}
    >
      {save && (
        <span className="absolute -top-2.5 right-6 flex h-5 items-center rounded-full bg-plan px-3 font-mono text-[9.5px] font-bold tracking-[1px] text-plan-foreground max-sm:left-4 max-sm:right-auto">SAVE 25%</span>
      )}
      <span aria-hidden className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] max-sm:absolute max-sm:right-4 max-sm:top-4",
        selected ? "border-plan" : "border-border-strong")}>
        {selected && <span className="size-2 rounded-full bg-plan" />}
      </span>
      <span className="min-w-0 flex-1 max-sm:order-first">
        <span className={cn("block text-[16.5px] font-medium leading-5", selected ? "text-foreground" : "text-muted-foreground")}>{label}</span>
        <span className="mt-1 block text-[12.5px] leading-4 text-muted-foreground sm:hidden">{sub}</span>
        {save && <span className="mt-1 hidden text-[12.5px] leading-4 text-muted-foreground sm:block">{sub}</span>}
      </span>
      <span className="flex items-baseline gap-3 max-sm:order-first max-sm:mt-1.5">
        <span className={cn("text-[24px] font-medium tracking-[-0.5px]", selected ? "text-foreground" : "text-muted-foreground")}>{price}</span>
        <span className="font-mono text-[10.5px] text-subtle-foreground"><span className="sm:hidden">/mo</span><span className="max-sm:hidden">/month</span></span>
      </span>
    </button>
  )
}

export default function JkUpgradeModal({ isOpen, onClose, feature, currentPlan, requiredPlan }: JkUpgradeModalProps) {
  const { user } = useAuth()
  const { planId, subscription } = useSubscription()
  const [annual, setAnnual] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const offer = useMemo(
    () => upgradeOffer(feature || '', currentPlan ?? planId, PLAN_LIMITS, requiredPlan),
    [feature, currentPlan, planId, requiredPlan],
  )
  const plan = plans.find((p) => p.id === offer.target)
  const monthly = plan?.pricing?.monthly
  const yearly = plan?.pricing?.annual
  const pick = annual ? yearly : monthly
  const trialDays = pick?.trialDays ?? 0
  const trialEnd = trialEndLabel(trialDays)

  useEffect(() => { if (isOpen) { setErr(null); setAnnual(true) } }, [isOpen])
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const startTrial = async () => {
    if (!plan || !pick) return
    if (!user) { window.location.href = '/auth?mode=signup'; return }
    setBusy(true); setErr(null)
    trackUpgradeClicked({ surface: 'upgrade_modal', authenticated: true, plan_id: plan.id })
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: pick.priceId,
          userId: (user as any).convex_user_id || user._id || (user as any).subject,
          email: user.email,
          customerId: subscription?.stripeCustomerId,
        }),
      })
      const data = await res.json()
      if (!data.checkoutUrl) throw new Error('Checkout did not open. Try again.')
      trackCheckoutStarted({ planId: plan.id, isAnnual: annual, isOneTime: false })
      window.location.href = data.checkoutUrl
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Checkout did not open. Try again.')
      setBusy(false)
    }
  }

  const enter = (i: number) => ({ "--i": i } as React.CSSProperties)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/75 backdrop-blur-[2px]"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6" onClick={onClose}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="jk-upgrade-title"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              data-enter
              className="jk-stagger relative grid h-full w-full overflow-y-auto bg-card sm:h-auto sm:max-h-[calc(100dvh-48px)] sm:max-w-[1040px] sm:rounded-[32px] sm:border sm:border-input md:grid-cols-2"
            >
              <button type="button" onClick={onClose} aria-label="Close"
                className="absolute right-5 top-5 z-10 flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-sm:size-[34px] max-sm:bg-background/80 sm:right-6 sm:top-6">
                <X className="size-5" strokeWidth={1.8} />
              </button>

              {/* Left: the ship, the feature, what the plan adds */}
              <div className="flex flex-col pb-8 md:border-r md:border-border md:px-10 md:pb-12 md:pt-3">
                <div className="relative -mx-0 h-[250px] w-full max-sm:h-[250px] md:mx-auto md:h-[262px] md:w-[300px]">
                  <JkArt name="ship4" variant="spot" live className="max-sm:hidden" />
                  <div className="absolute inset-0 sm:hidden"><JkArt name="ship4" variant="section" fade="bottom" live /></div>
                </div>
                <div className="px-5 md:px-0">
                  <p className={cn(mono, "jk-enter flex items-center gap-3 text-muted-foreground")} style={enter(1)}>
                    <span aria-hidden className="h-[14px] w-[3px] rounded-full bg-plan" />{offer.target ? "Upgrade required" : "Plan limit"}
                  </p>
                  <h2 id="jk-upgrade-title" className="jk-enter mt-3 max-w-[300px] text-[34px] font-medium leading-[40px] tracking-[-0.8px] text-foreground md:max-w-[340px] md:text-[36px] md:leading-[42px]" style={enter(2)}>
                    {offer.headline}
                  </h2>
                  {offer.target ? (
                    <>
                      <p className="jk-enter mt-2 text-[14.5px] text-muted-foreground" style={enter(3)}>
                        You are on {offer.currentName}. {plan?.name} adds:
                      </p>
                      <ul className="jk-enter mt-4 flex flex-col gap-3" style={enter(4)}>
                        {offer.adds.map((a) => (
                          <li key={a} className="flex items-start gap-3 text-[14.5px] leading-5 text-foreground">
                            <Check className="mt-0.5 size-4 shrink-0 text-plan" strokeWidth={2} />{a}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="jk-enter mt-3 text-[14.5px] leading-[22px] text-muted-foreground" style={enter(3)}>
                      Pro is the top plan. Your monthly AI documents reset at the start of your next billing period.
                    </p>
                  )}
                </div>
              </div>

              {/* Right: billing */}
              {offer.target && plan && monthly && yearly ? (
                <div className="flex flex-col px-5 pb-8 md:px-11 md:pb-9 md:pt-12">
                  <div className="jk-enter mb-4 flex items-center justify-between max-md:hidden" style={enter(2)}>
                    <p className="flex items-center gap-3 text-[17px] font-medium text-foreground">
                      <span aria-hidden className="h-[14px] w-[3px] rounded-full bg-plan" />{plan.name}
                    </p>
                    <span className={cn(mono, "mr-12 text-[10px] text-muted-foreground")}>Billing</span>
                  </div>
                  <div role="radiogroup" aria-label="Billing" className="jk-enter grid grid-cols-2 gap-3 md:grid-cols-1" style={enter(3)}>
                    <JkBillingOption selected={annual} onSelect={() => setAnnual(true)} save label="Annual"
                      price={formatUsd(priceNumber(yearly.price) / 12)} sub={`${yearly.price} billed once a year`} />
                    <JkBillingOption selected={!annual} onSelect={() => setAnnual(false)} label="Monthly"
                      price={monthly.price} sub="Billed monthly" />
                  </div>

                  <dl className="jk-enter mt-7 hidden border-y border-input py-4 text-[14px] md:block" style={enter(4)}>
                    <div className="flex items-center justify-between py-1.5"><dt className="text-muted-foreground">Due today</dt><dd className="font-mono text-[14px] text-foreground">$0.00</dd></div>
                    <div className="flex items-center justify-between py-1.5"><dt className="text-muted-foreground">After the {trialDays}-day free trial, on {trialEnd}</dt><dd className="font-mono text-[14px] text-foreground">{pick!.price}</dd></div>
                  </dl>

                  <Button variant="plan" disabled={busy} onClick={startTrial} className="jk-enter mt-5 h-14 w-full text-[16.5px] md:mt-8" style={enter(5)}>
                    {busy ? "Opening checkout…" : `Start ${trialDays}-day free trial`}
                  </Button>
                  {err && <p role="alert" className="mt-3 text-center text-[13px] text-destructive">{err}</p>}
                  <p className="jk-enter mt-4 text-center text-[13px] leading-5 text-muted-foreground md:hidden" style={enter(6)}>
                    $0.00 today. Then {pick!.price} {annual ? "a year" : "a month"} from {trialEnd}.<br /><span className="text-subtle-foreground">Cancel anytime in Settings.</span>
                  </p>
                  <p className="jk-enter mt-6 hidden text-center text-[13px] text-muted-foreground md:block" style={enter(6)}>
                    Cancel anytime in Settings. Unlimited edits on every plan.
                  </p>
                  <Link href="/pricing" onClick={onClose}
                    className="jk-enter mx-auto mt-6 border-b border-foreground/60 pb-0.5 text-[14px] font-medium text-foreground md:mt-auto md:pt-10" style={enter(7)}>
                    Compare all plans
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col justify-center gap-4 px-5 pb-10 md:px-11">
                  <Button className="h-12" onClick={onClose}>Got it</Button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
