// Display helpers for My Jobs (table, grouped cards, rail, phone list). Pure, unit tested.

/** Annual pay in dollars read from a free-text compensation, or null when it has no number. */
export function annualPay(compensation: string | null | undefined): number | null {
  if (!compensation) return null;
  const s = compensation.toLowerCase().replace(/,/g, "");
  const nums = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(k|m)?(?![a-z])/g)]
    .map((m) => parseFloat(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1))
    .filter((n) => n > 0);
  if (nums.length === 0) return null;
  const top = Math.max(...nums);
  if (/\/\s*h(ou)?r|per\s+hour|hourly|an hour/.test(s) || top < 500) return top * 2080;
  if (/\/\s*mo|per\s+month|monthly/.test(s)) return top * 12;
  return top < 1000 ? null : top;
}

/** Pay band shown as $–$$$$ (1–4), or 0 when unknown. Bands: <$90k, <$140k, <$200k, $200k+. */
export function compTier(compensation: string | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const pay = annualPay(compensation);
  if (pay === null) return 0;
  if (pay < 90_000) return 1;
  if (pay < 140_000) return 2;
  if (pay < 200_000) return 3;
  return 4;
}

/** YYYY-MM-DD for a stored applied date (ISO, "Nov 5, 2026", …), the raw text when unparseable, null when empty. */
export function appliedDate(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Job boards and ATS hosts: their favicon is the board's, not the employer's.
const BOARD_HOSTS = [
  "greenhouse.io", "lever.co", "ashbyhq.com", "workday", "myworkdayjobs.com", "linkedin.com", "indeed.com",
  "glassdoor.com", "wellfound.com", "angel.co", "ycombinator.com", "smartrecruiters.com", "jobvite.com",
  "icims.com", "bamboohr.com", "workable.com", "rippling.com", "dover.com", "teamtailor.com", "breezy.hr",
  "recruitee.com", "personio", "join.com", "builtin.com", "dice.com", "ziprecruiter.com", "monster.com",
  "google.com", "notion.site", "jobs.gem.com", "gem.com",
];

/** Best guess at the employer's domain for its logo: the posting's own host, else "<company>.com". */
export function companyDomain(link: string | null | undefined, company: string | null | undefined): string | null {
  try {
    if (link) {
      const host = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.toLowerCase();
      if (host.includes(".") && !BOARD_HOSTS.some((b) => host.includes(b))) {
        const parts = host.split(".");
        return parts.slice(-2).join(".");
      }
    }
  } catch { /* fall through to the name */ }
  const slug = (company ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(inc|llc|ltd|corp|co)\b\.?/g, "").replace(/[^a-z0-9]/g, "");
  return slug ? `${slug}.com` : null;
}

/** Next index for J/K navigation, clamped to the list. */
export function stepIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + delta));
}
