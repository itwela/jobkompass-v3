# No invented experience

Regression tests for the rule: AI resume output must not add employers, titles, dates, metrics, skills or tools, schools, degrees, certifications, or accomplishments that the user's resume does not support. Rewording and reordering real content is allowed. A job description is never a source of facts about the candidate.

These tests do not change production behavior. They do not block a model from inventing facts. They record where the current prompts allow it, and they prove a checker can see invented facts in each path's output shape.

## Commands

From the repo root:

```bash
npm run test:no-invented-experience
```

Default mode. No API keys. Runs the checker unit tests, mocked path tests, and prompt checks. Live tests are skipped.

```bash
npm run test:no-invented-experience:live
```

Same files, with `RUN_LIVE_EVALS=1`. This calls the real models. It needs:

| Path | Env var |
| --- | --- |
| Email tailor, reply draft, resume extraction | `OPENROUTER_API_KEY` |
| Template resume, template cover letter, chat, resume assistant, copy-to-AI replay | `OPENAI_API_KEY` or `NEXT_PUBLIC_OPENAI_API_KEY` |

Live tailor, extraction, and reply drafts call the real functions. Chat, template generation, the resume assistant, and copy-to-AI replay the real instruction text on the same model id. Those routes also need Convex auth and tool side effects, which live mode does not boot. The cover-letter live case does not attach a resume, matching production.

Live mode was not run in the environment that added these tests. No provider keys were available, so those paths are unverified against a real model. The Vitest summary prints `expected fail` for the prompt gaps so they stay visible while the suite is green.

## What default mode covers

- Checker unit tests, including rewrites that should pass and invented facts that should fail.
- Each AI path below, with a mocked model response that invents facts, asserted through the real parser when the path exports one (`tailorResumeContent`, `extractResumeContent`, `draftReplyMessage`).
- Prompt checks against the real source. A test whose name starts with `EXPECTED FAILURE` uses Vitest's `it.fails`: the suite stays green while the prompt still lacks a real guard. If someone adds the guard, that test starts failing and should be updated.

## Paths

| Path | Where | Model |
| --- | --- | --- |
| Email-agent resume tailoring | `lib/emailAgent/draftMessage.ts` `tailorResumeContent`, called from `convex/emailAgent/draft.ts` | `google/gemma-3-27b-it` via OpenRouter |
| Email reply / application note | `draftReplyMessage` in the same file | same |
| Resume parse | `lib/resume/extractFromPdf.ts`, used by `app/api/free-resume/generate`, `app/api/documents/generate-resume-pdf`, and template generation when the source is a PDF or paste | `openai/gpt-oss-20b`, fallback `openai/gpt-5-nano` |
| Free-generator instruction append | `app/free-resume-generator/page.tsx` concatenates the optional AI instructions onto the resume text before extraction | (same extractor) |
| Tailored resume from My Jobs | `app/api/template/generate/route.ts` | `gpt-4o-mini` |
| Cover letter from My Jobs | same route, `createCoverLetterJakeTemplate` | `gpt-4o-mini` |
| Main chat | `app/api/chat/route.ts`, instructions in `app/ai/constants/file.ts`, tool in `app/ai/tools/file.ts` | `gpt-5-mini` |
| Resume assistant | `app/api/resume/assist/route.ts`, applied by `jkChatWindow-ResumeEditor.tsx` | `gpt-5-mini` |
| Sparkle-button field fills | prompts in `jkChatWindow-ResumeEditor.tsx`, sent to the assistant | `gpt-5-mini` |
| Copy to ChatGPT/Claude/etc. | `lib/copyToAiPrompts.ts` | external chat, not called by the server |

Not model calls, listed so they are not missed: `convex/agent/fns.ts` `resumesGenerate` / `resumesUpdateContent` / `coverLettersGenerate` render JSON the caller already supplied. `lib/resume/contentFromPastedText.ts` is a non-AI parser. `convex/dopeAgents.ts` has a resume agent with empty instructions and is not wired to these flows.

Out of scope: job-posting parsers, email classification, performance summaries, chat retitles. They do not rewrite the candidate's resume.

## Expected failures (default suite, still green)

The names in the Vitest output are the record. Short version:

- Email tailor forbids new bullets, companies, titles, dates, and skills. It does not forbid new metrics, schools, degrees, certifications, or facts taken from the job.
- Reply drafts never see the resume.
- Extraction says to infer missing fields and does not forbid invented employers, skills, metrics, schools, or certifications.
- The free generator appends AI instructions onto the resume text, so those instructions can be parsed as candidate facts.
- Template resumes are told to weave job-posting keywords into bullets, skills, and the summary.
- Cover letters are written from the job and the account name, not from a resume.
- Chat best practices say to quantify with numbers and to include keywords from the job description.
- The resume assistant's example updates include "Drove 20% growth" and a new CI/CD bullet.
- The editor's sparkle buttons ask for a reputable company, a strong title, and measurable impact.
- Copy-to-AI says "Based on everything you know about me" and does not attach a resume.

## Checker limits

The checker is deterministic. It allows date-format changes, degree abbreviations (`B.S.` vs `Bachelor of Science`), skill aliases (`JS` vs `JavaScript`), and bullets whose content words already appear in the source. It is not a paraphrase model: a rewrite that swaps in new nouns can be flagged even when a person would call it harmless. Job-description text passed into the checker is ignored on purpose.
