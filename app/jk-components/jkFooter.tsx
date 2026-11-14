import Link from "next/link"
import Image from "next/image"
import { mainAssets } from "../lib/constants"
import JkThemeSwitch from "./jkThemeSwitch"

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "My Jobs", href: "/app?mode=my-jobs" },
      { label: "My Documents", href: "/app?mode=documents" },
      { label: "Interview Prep", href: "/app?mode=interview-prep" },
      { label: "CLI", href: "/#cli" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Free resume generator", href: "/free-resume-generator" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
]

// Phone and tablet columns from the M00 frame.
const PHONE_COLUMNS: typeof COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "My Jobs", href: "/app?mode=my-jobs" },
      { label: "My Documents", href: "/app?mode=documents" },
      { label: "Interview Prep", href: "/app?mode=interview-prep" },
      { label: "Chrome extension", href: "/#product" },
      { label: "CLI", href: "/#cli" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Free resume generator", href: "/free-resume-generator" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
]

export default function JkFooter() {
  return (
    <footer data-enter className="bg-background px-5 pb-[30px] pt-5 sm:px-8 lg:border-t lg:border-border lg:py-14" role="contentinfo">
      <div className="mx-auto max-w-[1232px]">
        <div className="grid gap-[22px] lg:grid-cols-[1.4fr_2fr] lg:gap-10">
          <div>
            <div className="flex items-center gap-1.5 lg:gap-3">
              <Image src={mainAssets.logo} alt="JobKompass logo" width={32} height={32} className="size-7 shrink-0 object-contain lg:size-8" />
              <span className="text-[17px] font-bold tracking-[-0.2px] text-foreground lg:text-xl lg:font-medium lg:tracking-tight">JobKompass</span>
            </div>
            <p className="mt-2.5 max-w-[260px] text-[13px] leading-[19px] text-muted-foreground lg:mt-4 lg:max-w-xs lg:text-sm lg:leading-relaxed">Job tracking, tailored resumes, and interview prep in one account.</p>
          </div>
          <div className="grid grid-cols-2 gap-5 lg:hidden">
            {PHONE_COLUMNS.map((c, i) => (
              <nav key={c.heading} aria-label={c.heading} style={{ "--i": i + 1 } as React.CSSProperties} className="jk-enter">
                <p className="font-mono text-[9.5px] font-medium uppercase tracking-[1.4px] text-subtle-foreground">{c.heading}</p>
                <ul className="mt-2 space-y-[7px] text-[13.5px] leading-[19px]">
                  {c.links.map((l) => (
                    <li key={l.label}><Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="hidden grid-cols-3 gap-8 lg:grid">
            {COLUMNS.map((c, i) => (
              <nav key={c.heading} aria-label={c.heading} style={{ "--i": i + 1 } as React.CSSProperties} className="jk-enter">
                <p className="jk-eyebrow text-subtle-foreground">{c.heading}</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l.label}><Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">{l.label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-[34px] flex items-center justify-between gap-4 border-t border-border pt-[13px] lg:mt-12 lg:pt-5">
          <p className="font-mono text-[9.5px] uppercase tracking-[1.2px] text-subtle-foreground lg:text-xs lg:normal-case lg:tracking-normal">© {new Date().getFullYear()} JobKompass</p>
          <JkThemeSwitch />
        </div>
      </div>
    </footer>
  )
}
