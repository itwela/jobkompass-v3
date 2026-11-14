'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthActions } from "@convex-dev/auth/react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import JkAuthShell, { JkAuthHeading } from "@/app/jk-components/jk-auth/jkAuthShell"
import { JkField, JkFormError, jkFieldCls } from "@/app/jk-components/jkField"
import { cn } from "@/lib/utils"

/** Forgot password: email a code, then set a new password with it. Built from the sign-in parts (no frame of its own). */
export default function ResetPasswordPage() {
  const { signIn } = useAuthActions()
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const requestCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const form = new FormData(e.currentTarget)
    try {
      await signIn("password", form)
      setEmail(String(form.get("email")))
    } catch {
      setError("Could not send a code to that email. Check it is the one you signed up with.")
    } finally {
      setBusy(false)
    }
  }

  const setPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn("password", new FormData(e.currentTarget))
      router.replace('/app')
    } catch {
      setError("That code did not work. Check the email again, or send a new code.")
      setBusy(false)
    }
  }

  const button = "mt-8 h-[54px] w-full text-[16.5px] lg:mt-9 lg:h-12 lg:text-[15.5px]"

  return (
    <JkAuthShell band="tall" className="lg:pt-[142px]">
      {email === null ? (
        <>
          <JkAuthHeading eyebrow="Reset password" title="Forgot your password?" sub="We will email you a code to set a new one." />
          <form onSubmit={requestCode} className="mt-[21px] lg:mt-[33px]">
            <JkField label="Email" id="email">
              <Input id="email" name="email" type="email" required autoComplete="email" className={cn(jkFieldCls, "h-12 lg:h-11")} />
            </JkField>
            <input name="flow" type="hidden" value="reset" />
            {error && <div className="mt-5"><JkFormError>{error}</JkFormError></div>}
            <Button type="submit" disabled={busy} className={button}>{busy ? "Sending…" : "Send code"}</Button>
          </form>
        </>
      ) : (
        <>
          <JkAuthHeading eyebrow="Reset password" title="Check your email" sub={`Enter the 8-digit code sent to ${email}.`} />
          <form onSubmit={setPassword} className="mt-[21px] flex flex-col gap-[14px] lg:mt-[33px] lg:gap-[18px]">
            <JkField label="Code" id="code">
              <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" maxLength={8} className={cn(jkFieldCls, "h-12 font-mono tracking-[0.3em] lg:h-11")} />
            </JkField>
            <JkField label="New password" id="newPassword">
              <Input id="newPassword" name="newPassword" type="password" required minLength={8} sanitize={false} autoComplete="new-password" className={cn(jkFieldCls, "h-12 lg:h-11")} />
            </JkField>
            <input name="email" type="hidden" value={email} />
            <input name="flow" type="hidden" value="reset-verification" />
            {error && <JkFormError>{error}</JkFormError>}
            <Button type="submit" disabled={busy} className={cn(button, "mt-[18px] lg:mt-[18px]")}>{busy ? "Saving…" : "Set new password"}</Button>
          </form>
          <button type="button" onClick={() => { setEmail(null); setError(null) }} className="mt-[23px] w-full text-center text-[14px] text-muted-foreground transition-colors hover:text-foreground lg:text-left">
            Send a new code
          </button>
        </>
      )}
      <p className="mt-[23px] text-center text-[14px] leading-[17px] text-muted-foreground lg:text-left">
        Remembered it?
        <Link href="/auth" className="ml-1 transition-colors hover:text-foreground lg:ml-[7px] lg:font-medium lg:text-plan-text">Sign in</Link>
      </p>
    </JkAuthShell>
  )
}
