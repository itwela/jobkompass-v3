# Free Resume Generator — Lead Magnet Setup

## Overview

The Free Resume Generator is a lead magnet that lets users paste their resume text, sign up to the email list (or verify if already signed up), and receive a professionally formatted PDF resume.

## Environment Variables

Add to your `.env` or `.env.local`:

```bash
# OpenRouter API (for AI resume extraction)
# Get your key at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...

# LaTeX service URL (same as main app - for PDF compilation)
LATEX_SERVICE_URL=https://your-latex-service.run.app

# Optional: for OpenRouter HTTP-Referer header
NEXT_PUBLIC_APP_URL=https://jobkompass.com
```

## Convex Setup

1. Run `npx convex dev` to push the new schema (adds `emailList` table).
2. The `emailList` table replaces the waitlist concept with submission types:
   - `free-resume` — signups from the Free Resume Generator
   - `waitlist` — signups from the main waitlist / landing page

## Features

- **Split layout**: Paste resume on left, PDF preview on right
- **Email gate**: Users must sign up or verify email before generating (once per session)
- **No duplicate signups**: Checked by email + submission type
- **"I already signed up"**: Verify with email to skip re-signup
- **Model**: `openai/gpt-oss-120b:free` via OpenRouter
- **Flow**: Paste text → AI extracts → LaTeX compiles → PDF returned
- **SEO**: Metadata, structured data, canonical URL

## LaTeX Service

The generator API sends both `latex` and `latexContent` to the compile endpoint for compatibility. If your LaTeX service expects only one, ensure it matches.

## Stats Tracking

The free resume generator records usage in Convex for analytics and portfolio numbers.

**Table:** `freeResumeGenerations` (one row per successful generation)

**Recorded fields:**
- `inputType`: `"text"` or `"pdf"`
- `textCharacterCount`: Characters processed (0 for PDF)
- `pdfSizeBytes`: PDF file size in bytes (for PDF inputs)
- `templateId`: Template used
- `createdAt`: Timestamp

**Query stats:** Run `freeResumeStats.getStats` from the Convex dashboard or in your app. Returns:

- `totalGenerations` — Total successful generations
- `totalTextInputGenerations` — Pasted text count
- `totalPdfProcessed` — PDF upload count
- `totalTextCharactersProcessed` — Sum of all text chars
- `totalPdfBytesProcessed` — Sum of PDF sizes
- `generationsLast7Days` / `generationsLast30Days`
- `firstGenerationAt` / `lastGenerationAt`

## Migration from Waitlist

The landing page and `/waitlist` page now use `emailList` with `submissionType: "waitlist"`. Existing `waitlist` table entries are not migrated automatically. To migrate, run a one-time script that reads from `waitlist` and inserts into `emailList` with `submissionType: "waitlist"`.
