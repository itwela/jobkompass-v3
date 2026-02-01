/**
 * AI models used across the app (e.g. free resume generator, future features).
 * Keep in sync with API routes that call OpenRouter (e.g. OPENROUTER_MODEL_* in free-resume generator route).
 */

export interface AIModelInfo {
  /** OpenRouter model id (e.g. arcee-ai/trinity-mini:free) */
  id: string;
  /** Display name */
  name: string;
  /** Provider / vendor name */
  provider: string;
  /** Optional logo URL (favicon or icon). If missing, UI can use initials. */
  logoUrl?: string;
  /** Optional short description */
  description?: string;
}

/** All known AI models we use. Add new entries when adding new models. */
export const AI_MODELS: AIModelInfo[] = [
  {
    id: 'arcee-ai/trinity-mini:free',
    name: 'Trinity Mini',
    provider: 'Arcee AI',
    logoUrl: 'https://openrouter.ai/favicon.ico',
    description: '26B-parameter sparse MoE, 131k context',
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B',
    provider: 'Google',
    logoUrl: 'https://www.google.com/favicon.ico',
    description: '27B parameter instruction-tuned model',
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    logoUrl: 'https://openai.com/favicon.ico',
    description: 'Advanced reasoning and tool use',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    logoUrl: 'https://openai.com/favicon.ico',
    description: 'Fast, affordable model for document generation',
  },
];

/** OpenRouter model ids used by the free resume generator (primary + fallback). */
export const FREE_RESUME_MODEL_IDS = [
  'arcee-ai/trinity-mini:free',
  'google/gemma-3-27b-it:free',
] as const;

/** Models used for the free resume generator (for badges / "powered by" UI). */
export function getModelsForFreeResume(): AIModelInfo[] {
  return AI_MODELS.filter((m) => FREE_RESUME_MODEL_IDS.includes(m.id as (typeof FREE_RESUME_MODEL_IDS)[number]));
}

/** Model used for JobKompass chat (main app chat). */
export const CHAT_MODEL_ID = 'gpt-5-mini';

/** Model used for template generation (resume/cover letter from My Jobs). */
export const TEMPLATE_GENERATION_MODEL_ID = 'gpt-4o-mini';

/** Get the model info for the chat. */
export function getModelForChat(): AIModelInfo | undefined {
  return AI_MODELS.find((m) => m.id === CHAT_MODEL_ID);
}

/** Get the model info for template generation (My Jobs → generate document). */
export function getModelForTemplateGeneration(): AIModelInfo | undefined {
  return AI_MODELS.find((m) => m.id === TEMPLATE_GENERATION_MODEL_ID);
}
