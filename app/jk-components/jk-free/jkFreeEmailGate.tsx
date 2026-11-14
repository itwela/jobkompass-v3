'use client'

import Link from "next/link";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import JkArt from "../jkArt";
import { JkTick } from "../jkBars";

export type GateMode = "signup" | "verify" | "limit";

interface JkFreeEmailGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: GateMode;
  onMode: (m: GateMode) => void;
  name: string;
  onName: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  verifyEmail: string;
  onVerifyEmail: (v: string) => void;
  onSignup: (e: React.FormEvent) => void;
  onVerify: (e: React.FormEvent) => void;
}

// D24 / D25 / D26 (desktop modal) and M25 (phone bottom sheet).
const COPY: Record<GateMode, { eyebrow: string; title: string; body: string }> = {
  signup: { eyebrow: "Last step", title: "Your resume is one step away", body: "Add your email and we'll make it. Now and then we send a job search tip. Nothing else." },
  verify: { eyebrow: "Welcome back", title: "Use the email you signed up with", body: "We'll find you on the list and make your resume." },
  limit: { eyebrow: "Free limit", title: "That's your two free resumes", body: "Make an account to keep going: a tailored resume for every job, cover letters, and one place to track every application. Plans start at $2.99 for a week." },
};

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<"input">) {
  return (
    <div>
      <label htmlFor={id} className="text-[13.5px] font-medium text-foreground">{label}</label>
      <input
        id={id}
        required
        {...props}
        className="mt-2 block h-[50px] w-full rounded-2xl border border-input bg-background px-[18px] text-[16px] text-foreground caret-plan outline-none transition-colors placeholder:text-subtle-foreground focus:border-border-strong md:h-12 md:text-[15px]"
      />
    </div>
  );
}

function Primary({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button {...props} className="jk-fx jk-fx-cream relative block h-[50px] w-full overflow-hidden rounded-full bg-primary text-[15.5px] font-medium text-primary-foreground">
      <span className="relative z-[2]">{children}</span>
    </button>
  );
}

function SwitchLine({ lead, action, onClick, href }: { lead: string; action: string; onClick?: () => void; href?: string }) {
  const cls = "font-medium text-foreground underline-offset-4 hover:underline";
  return (
    <p className="mt-[22px] text-center text-[13.5px] text-subtle-foreground">
      {lead}{" "}
      {href ? <Link href={href} className={cls}>{action}</Link> : <button type="button" onClick={onClick} className={cls}>{action}</button>}
    </p>
  );
}

export default function JkFreeEmailGate(p: JkFreeEmailGateProps) {
  const c = COPY[p.mode];
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "block gap-0 overflow-hidden border-input bg-card p-0 shadow-[0_30px_80px_rgb(0_0_0/0.5)] sm:max-w-[480px] sm:rounded-[28px]",
          // Phone: a sheet pinned to the bottom edge (M25).
          "max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-[28px] max-sm:border-x-0 max-sm:border-b-0 max-sm:pb-[max(env(safe-area-inset-bottom),24px)] max-sm:data-[state=open]:slide-in-from-bottom-10",
        )}
      >
        <span aria-hidden className="absolute left-1/2 top-2.5 z-10 h-1 w-10 -translate-x-1/2 rounded-full bg-border-strong sm:hidden" />
        <DialogClose className="absolute right-5 top-5 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground max-sm:hidden" aria-label="Close">
          <X className="size-4" />
        </DialogClose>

        {/* The whole night boat, fading into the card on every side. */}
        <div className="relative h-[196px] sm:h-[236px]">
          <JkArt name="ship2" position="50% 54%" live />
        </div>

        <div className="relative -mt-2 px-5 pb-2 sm:-mt-3 sm:px-8 sm:pb-[30px]">
          <p className="jk-eyebrow flex items-center gap-2.5 text-muted-foreground">
            <JkTick tone={p.mode === "limit" ? "plan" : 4} />
            <span>{c.eyebrow}</span>
          </p>
          <DialogTitle className="mt-[11px] text-[26px] font-medium leading-[1.2] tracking-[-0.6px] text-foreground sm:text-[28px]">{c.title}</DialogTitle>
          <DialogDescription className="mt-2 text-[14.5px] leading-[22px] text-muted-foreground sm:text-[15px]">{c.body}</DialogDescription>

          {p.mode === "signup" && (
            <form onSubmit={p.onSignup} className="mt-6">
              <div className="space-y-4">
                <Field id="gate-name" label="Name" autoComplete="name" placeholder="Your name" value={p.name} onChange={(e) => p.onName(e.target.value)} />
                <Field id="gate-email" label="Email" type="email" autoComplete="email" placeholder="you@email.com" value={p.email} onChange={(e) => p.onEmail(e.target.value)} />
              </div>
              <div className="mt-6"><Primary type="submit">Make my resume</Primary></div>
              <SwitchLine lead="Already on the list?" action="Use your email" onClick={() => p.onMode("verify")} />
            </form>
          )}

          {p.mode === "verify" && (
            <form onSubmit={p.onVerify} className="mt-6">
              <Field id="verify-email" label="Email" type="email" autoComplete="email" placeholder="you@email.com" value={p.verifyEmail} onChange={(e) => p.onVerifyEmail(e.target.value)} />
              <div className="mt-6"><Primary type="submit">Make my resume</Primary></div>
              <SwitchLine lead="New here?" action="Sign up" onClick={() => p.onMode("signup")} />
            </form>
          )}

          {p.mode === "limit" && (
            <div className="mt-8">
              <Link href="/auth" className="block"><Primary type="button">Get started</Primary></Link>
              <SwitchLine lead="Want the details?" action="See pricing" href="/pricing" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
