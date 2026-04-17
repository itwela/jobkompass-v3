/**
 * AI models used across the app (e.g. free resume generator, future features).
 * Keep in sync with API routes that call OpenRouter (e.g. OPENROUTER_MODEL_* in free-resume generator route).
 */

export interface AIModelInfo {
  /** OpenRouter model id (e.g. openai/gpt-oss-20b) */
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
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B',
    provider: 'OpenAI',
    logoUrl: 'https://openai.com/favicon.ico',
    description: 'Open-weight MoE with reasoning + structured output; ~$0.03–0.05/M in on OpenRouter',
  },
  {
    id: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    logoUrl: 'https://openai.com/favicon.ico',
    description: 'Lowest-cost GPT-5 class; strong fallback for extraction',
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

/**
 * Default OpenRouter models for resume text/PDF extraction (paid; avoids free-tier rate limits).
 * Primary: cheapest reasoning-oriented option (Harmony / reasoning tokens). Fallback: GPT-5 Nano.
 * Override with OPENROUTER_RESUME_MODEL_PRIMARY and OPENROUTER_RESUME_MODEL_FALLBACK.
 */
export const DEFAULT_RESUME_EXTRACTION_MODEL_IDS = [
  'openai/gpt-oss-20b',
  'openai/gpt-5-nano',
] as const;

/** @deprecated Alias for badges/UI; same as paid extraction stack now. */
export const FREE_RESUME_MODEL_IDS = DEFAULT_RESUME_EXTRACTION_MODEL_IDS;

/** Models used for the free resume generator (for badges / "powered by" UI). */
export function getModelsForFreeResume(): AIModelInfo[] {
  return AI_MODELS.filter((m) =>
    DEFAULT_RESUME_EXTRACTION_MODEL_IDS.includes(m.id as (typeof DEFAULT_RESUME_EXTRACTION_MODEL_IDS)[number]),
  );
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
