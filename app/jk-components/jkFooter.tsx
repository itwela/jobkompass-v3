import Link from "next/link"
import Image from "next/image"
import { mainAssets } from "../lib/constants"

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

export default function JkFooter() {
  return (
    <footer className="border-t border-border bg-background px-5 py-14 sm:px-8" role="contentinfo">
      <div className="mx-auto max-w-[1232px]">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image src={mainAssets.logo} alt="JobKompass logo" width={32} height={32} className="object-contain" />
              <span className="text-xl font-medium tracking-tight text-foreground">JobKompass</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">Job tracking, tailored resumes, and interview prep in one account.</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {COLUMNS.map((c) => (
              <nav key={c.heading} aria-label={c.heading}>
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
        <p className="mt-12 border-t border-border pt-6 font-mono text-xs text-subtle-foreground">© {new Date().getFullYear()} JobKompass</p>
      </div>
    </footer>
  )
}
