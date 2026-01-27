import { ZodType } from "zod";
import { z } from "zod";
import type { ClientOptions as OpenAIClientOptions } from "openai";

const AvailableModelSchema = z.enum([
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4o-2024-08-06",
    "claude-3-5-sonnet-latest",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-sonnet-20240620",
    "o1-mini",
    "o1-preview",
    // "local-model",
]);
export type AvailableModel = z.infer<typeof AvailableModelSchema>;
type ClientOptions = OpenAIClientOptions;
type LogLine = {
    id?: string;
    category?: string;
    message: string;
    level?: 0 | 1 | 2;
    timestamp?: string;
    auxiliary?: {
      [key: string]: {
        value: string;
        type: "object" | "string" | "html" | "integer" | "float" | "boolean";
      };
    };
};

interface LLMTool {
    type: "function";
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatMessageContent;
}

export type ChatMessageContent =
  | string
  | (ChatMessageImageContent | ChatMessageTextContent)[];

export interface ChatMessageImageContent {
  type: "image_url";
  image_url: { url: string };
  text?: string;
}

export interface ChatMessageTextContent {
  type: string;
  text: string;
}

export const modelsWithVision: AvailableModel[] = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20240620",
  "claude-3-5-sonnet-20241022",
  "gpt-4o-2024-08-06",
];

export const AnnotatedScreenshotText =
  "This is a screenshot of the current page state with the elements annotated on it. Each element id is annotated with a number to the top left of it. Duplicate annotations at the same location are under each other vertically.";

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  image?: {
    buffer: Buffer;
    description?: string;
  };
  response_model?: {
    name: string;
    schema: ZodType;
  };
  tools?: LLMTool[];
  tool_choice?: "auto" | "none" | "required";
  maxTokens?: number;
  requestId: string;
}

export type LLMResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls: {
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export interface CreateChatCompletionOptions {
  options: ChatCompletionOptions;
  logger: (message: LogLine) => void;
  retries?: number;
}

export abstract class LLMClient {
  public type!: "openai" | "anthropic" | string;
  public modelName: AvailableModel;
  public hasVision: boolean;
  public clientOptions!: ClientOptions;
  public userProvidedInstructions?: string;

  constructor(modelName: AvailableModel, userProvidedInstructions?: string) {
    this.modelName = modelName;
    this.hasVision = modelsWithVision.includes(modelName);
    this.userProvidedInstructions = userProvidedInstructions;
  }

  abstract createChatCompletion<T = LLMResponse>(
    options: CreateChatCompletionOptions,
  ): Promise<T>;
}