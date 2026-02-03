# JobKompass Personalization Feature — Master Prompt

Use this prompt with an AI assistant to one-shot build the personalization/performance feature. The assistant should implement it in `app/jk-components/jk-chatwindow-components/jkChatWindow-PerformanceMode.tsx` (replace the placeholder).

---

## Your Task

Build the **Personalization** (Performance) feature in JobKompass. The goal is an **AI-generated summary of how the user's job hunt is going**, using **their actual tracked stats**. Keep it **simple and actionable** with strong UI (cards, **clean charts**, etc.) and optional chat integration. Implement it in the existing Performance mode slot (sidebar → "Performance", route `/performance`). **Use clean, minimal charts** for all stats visualizations—avoid cluttered or noisy designs.

---

## Project Context

**JobKompass** is a career management app: job tracking, resume/cover letter management, AI chat, and resource saving. Stack: **Next.js 16**, **React 19**, **Convex** (backend), **Tailwind CSS**, **Framer Motion**, **shadcn/ui** (`components/ui/`), **lucide-react**.

---

## Where to Build

**File:** `app/jk-components/jk-chatwindow-components/jkChatWindow-PerformanceMode.tsx`

- Replace the current placeholder ("Coming soon").
- Follow the same layout as My Jobs, Documents, Resources:
  - Outer: `className="flex flex-col h-full overflow-y-auto chat-scroll bg-gradient-to-br from-background via-background to-muted/20"`
  - Inner: `className="max-w-7xl mx-auto w-full px-6 py-8"`
- Check auth: if `!isAuthenticated`, show a sign-in prompt (see Resources/My Jobs for pattern).
- Use `useAuth()` from `@/providers/jkAuthProvider`.

---

## Data Sources (Actual Stats to Use)

### 1. Jobs Provider — `useJobs()` from `@/providers/jkJobsProvider`

- `allJobs`: all jobs for the user
- `statusCounts`: `Record<string, number>` — counts per status
- `statusOptions`: `{ value, label, colorClass }[]`
- Job statuses: **Interested**, **Applied**, **Interviewing**, **Rejected**, **Offered**, **Ghosted**
- Job fields: `company`, `title`, `status`, `resumeUsed`, `coverLetterUsed`, `dateApplied`, `createdAt`, etc.

### 2. Resume Provider — `useJobKompassResume()` from `@/providers/jkResumeProvider`

- `resumeStats`: `Record<string, { totalJobs, offered, rejected, ghosted, applied, interviewing }>` per resume
- `coverLetterStats`: same shape per cover letter
- `resumes`, `coverLetters`: arrays of documents

### 3. Usage — `useFeatureAccess()` from `@/hooks/useFeatureAccess`

- `getUsageStats()` returns (or `useQuery(api.usage.getUserUsage)`):
  - `documentsGeneratedThisMonth`
  - `jobsCount`
  - `monthStart`

---

## Feature Requirements

### Core

1. **Stats dashboard with clean charts** — show aggregated metrics using **clean, minimal chart designs**:
   - Total jobs by status (Applied, Interviewing, Offered, Rejected, Ghosted) — use simple bar charts, donut charts, or progress bars; keep labels clear and spacing generous
   - Per-resume performance (which resumes get the most interviews/offers) — clean horizontal bars or minimal cards
   - Application volume over time (optional; infer from job `createdAt` or `dateApplied`) — simple line or area chart if included
   - **Chart philosophy:** minimal axes, clear typography, plenty of whitespace, no chart junk. Prefer CSS/Tailwind-based charts (flex, gradients) or a lightweight library if needed; avoid heavy, busy charting libraries.

2. **AI-generated summary** — 2–4 sentences that:
   - Use the real stats above
   - Are personalized and conversational
   - Are **actionable** (e.g., "Try tailoring your Software Engineer resume more," "You have 3 interviews this week—prioritize prep," "Response rate is 15%—consider stronger cover letters")

3. **Simple and scannable** — cards, clear hierarchy, subtle animations (Framer Motion). Match existing UI patterns (BlurFade, motion.div, Button, etc.).

### Optional but Encouraged

- **Chat / ask about my stats** — e.g. a small input that sends a message to the existing chat API with stats context, or opens Chat mode with a pre-filled prompt.
- **Insight cards** — e.g. "Your best-performing resume," "Interview rate," "Top companies by response."

---

## How to Generate the AI Summary

**Use the free AI model** — Call OpenRouter with one of the free models from `lib/aiModels.ts`:
- `FREE_RESUME_MODEL_IDS`: `arcee-ai/trinity-mini:free` (primary), `google/gemma-3-27b-it:free` (fallback)
- See `lib/resume/extractFromPdf.ts` for the OpenRouter fetch pattern: `https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Fallback to the second model if the first returns 502/429/503

**Option A (recommended):** Add a Next.js API route that:
- Accepts the user's stats as input (or fetches them server-side via Convex)
- Calls **OpenRouter** with the free model (see above) and a system prompt like:  
  "You are a career coach. Given these job hunt stats: [JSON stats], write a 2–4 sentence, personalized, actionable summary. Be encouraging but honest. Suggest 1–2 concrete next steps."
- Returns the summary text; cache it or regenerate on each visit as you prefer.

**Option B:** Use the existing chat API (`/api/chat/route.ts`) with a special "performance summary" prompt and inject stats into the message or context—but **ensure it uses the free OpenRouter model** for this feature, not the paid chat model.

**Stats payload shape** (for the AI):

```ts
{
  totalJobs: number,
  statusCounts: { Applied: number, Interviewing: number, Offered: number, Rejected: number, Ghosted: number, Interested: number },
  resumeStats: { [resumeName]: { totalJobs, offered, rejected, ghosted, applied, interviewing } },
  coverLetterStats: { [clName]: { totalJobs, offered, rejected, ghosted, applied, interviewing } },
  documentsGeneratedThisMonth?: number,
  jobsCount?: number
}
```

---

## UI Patterns to Follow

- **Charts:** Keep them **clean and minimal**—simple bars, donuts, or progress indicators. Use CSS/Tailwind (flex, gradients, rounded corners) when possible; avoid chart junk (excessive gridlines, busy legends). One accent color per chart; match status colors (green=offered, purple=interviewing, red=rejected, etc.).
- **Cards:** `rounded-xl border border-border bg-card p-4` or `bg-card/50`
- **Buttons:** `Button` from `@/components/ui/button`
- **Icons:** lucide-react (`TrendingUp`, `Briefcase`, `FileText`, `BarChart2`, `Sparkles`, etc.)
- **Animations:** `motion.div` with `initial`, `animate`, `transition`; consider `BlurFade` from `@/components/ui/blur-fade` for list items
- **Status badges:** match My Jobs (e.g. `bg-green-100 text-green-800`, `bg-purple-100 text-purple-800`)
- **Empty states:** centered layout with icon, heading, and CTA (e.g. "Add jobs to see your performance")
- **Loading:** `Loader2` with `animate-spin` or skeleton placeholders

---

## Files to Reference

- `app/jk-components/jk-chatwindow-components/jkChatWindow-MyJobsMode.tsx` — auth, layout, structure
- `app/jk-components/jk-chatwindow-components/jkChatWindow-ResourcesMode.tsx` — scroll container, header, empty state
- `app/jk-components/jk-chatwindow-components/jkChatWindow-DocumentsForm.tsx` — stats display (offered/interviewing/rejected badges)
- `providers/jkJobsProvider.tsx` — jobs data and status counts
- `providers/jkResumeProvider.tsx` — resumeStats, coverLetterStats
- `hooks/useFeatureAccess.ts` — getUsageStats
- `lib/aiModels.ts` — FREE_RESUME_MODEL_IDS, getModelsForFreeResume
- `lib/resume/extractFromPdf.ts` — OpenRouter fetch pattern, OPENROUTER_MODEL_PRIMARY, OPENROUTER_MODEL_FALLBACK
- `app/api/chat/route.ts` — chat API pattern
- `convex/usage.ts` — getUserUsage query

---

## Constraints

- Use existing providers; don't add new Convex tables unless necessary.
- Keep the Performance mode accessible from the sidebar (already wired: `id: '/performance'`).
- Ensure the summary is generated server-side or via a secure API so stats aren't exposed in client prompts unintentionally.
- Match the app's existing design system (Tailwind, shadcn, muted-foreground, primary, etc.).

---

## Success Criteria

1. Performance mode shows real user stats (jobs by status, resume/cover letter performance) with **clean, minimal charts**.
2. An AI-generated, actionable summary is displayed using those stats (via the **free OpenRouter model**).
3. UI is clean, card-based, chart-forward, and consistent with My Jobs/Documents/Resources.
4. Empty and loading states are handled.
5. Authenticated users only; unauthenticated users see a sign-in prompt.
