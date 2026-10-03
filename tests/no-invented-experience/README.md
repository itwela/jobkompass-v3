# No invented experience

Regression tests for the rule: AI resume output must not add employers, titles, dates, metrics, skills or tools, schools, degrees, certifications, or accomplishments that the user's resume does not support. Rewording and reordering real content is allowed. A job description is never a source of facts about the candidate.

The checker proves invented facts are visible in each path's output shape. Prompt checks now require the fixed paths to forbid those facts. Two prompt gaps remain expected failures: reply drafts, which still do not receive the resume, and chat best practices, which still push numbers and job-description keywords.

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

Live tailor, extraction, and reply drafts call the real functions. Chat, template generation, the resume assistant, and copy-to-AI replay the real instruction text on the same model id. Those routes also need Convex auth and tool side effects, which live mode does not boot. The cover-letter live case attaches the candidate resume, matching production when the account has a saved resume.

The Vitest summary prints `expected fail` for the remaining prompt gaps (reply drafts and chat) so they stay visible while the suite is green.

## What default mode covers

- Checker unit tests, including rewrites that should pass and invented facts that should fail.
- Each AI path below, with a mocked model response that invents facts, asserted through the real parser when the path exports one (`tailorResumeContent`, `extractResumeContent`, `draftReplyMessage`).
- Prompt checks against the real source. A test whose name starts with `EXPECTED FAILURE` uses Vitest's `it.fails`: the suite stays green while that prompt still lacks a real guard. If someone adds the guard, that test starts failing and should be updated.

## Paths

| Path | Where | Model |
| --- | --- | --- |
| Email-agent resume tailoring | `lib/emailAgent/draftMessage.ts` `tailorResumeContent`, called from `convex/emailAgent/draft.ts` | `google/gemma-3-27b-it` via OpenRouter |
| Email reply / application note | `draftReplyMessage` in the same file | same |
| Resume parse | `lib/resume/extractFromPdf.ts`, used by `app/api/free-resume/generate`, `app/api/documents/generate-resume-pdf`, and template generation when the source is a PDF or paste | `openai/gpt-oss-20b`, fallback `openai/gpt-5-nano` |
| Free-generator instructions | `app/free-resume-generator/page.tsx` sends optional wording instructions separately from the resume text, and `extractResumeContent` treats them as emphasis only | (same extractor) |
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

- Reply drafts never see the resume, so the prompt cannot limit claims to it.
- Chat best practices say to quantify with numbers and to include keywords from the job description.

These paths now have passing prompt checks: email tailor, resume extraction, free-generator instructions, My Jobs tailored resume, cover letter, resume assistant, sparkle-button fills, and copy-to-AI.

## Checker limits

The checker is deterministic. It allows date-format changes, degree abbreviations (`B.S.` vs `Bachelor of Science`), skill aliases (`JS` vs `JavaScript`), and bullets whose content words already appear in the source. It is not a paraphrase model: a rewrite that swaps in new nouns can be flagged even when a person would call it harmless. Job-description text passed into the checker is ignored on purpose.
