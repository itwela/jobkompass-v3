/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent_auth from "../agent/auth.js";
import type * as agent_dispatch from "../agent/dispatch.js";
import type * as agent_fns from "../agent/fns.js";
import type * as agent_keys from "../agent/keys.js";
import type * as agent_routes from "../agent/routes.js";
import type * as auth from "../auth.js";
import type * as baseResume from "../baseResume.js";
import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as documentFolders from "../documentFolders.js";
import type * as documents from "../documents.js";
import type * as dopeAgents from "../dopeAgents.js";
import type * as emailAccounts from "../emailAccounts.js";
import type * as emailAgent_draft from "../emailAgent/draft.js";
import type * as emailAgent_followUp from "../emailAgent/followUp.js";
import type * as emailAgent_gmailClient from "../emailAgent/gmailClient.js";
import type * as emailAgent_manualLead from "../emailAgent/manualLead.js";
import type * as emailAgent_mirror from "../emailAgent/mirror.js";
import type * as emailAgent_poll from "../emailAgent/poll.js";
import type * as emailAgent_send from "../emailAgent/send.js";
import type * as emailList from "../emailList.js";
import type * as extensionApiKeys from "../extensionApiKeys.js";
import type * as extensionSaveJob from "../extensionSaveJob.js";
import type * as freeResumeStats from "../freeResumeStats.js";
import type * as http from "../http.js";
import type * as inputSanitizer from "../inputSanitizer.js";
import type * as jobLeads from "../jobLeads.js";
import type * as jobs from "../jobs.js";
import type * as plans from "../plans.js";
import type * as rateLimit from "../rateLimit.js";
import type * as rateLimitConfig from "../rateLimitConfig.js";
import type * as rateLimits from "../rateLimits.js";
import type * as resources from "../resources.js";
import type * as resumeShares from "../resumeShares.js";
import type * as subscriptions from "../subscriptions.js";
import type * as threads from "../threads.js";
import type * as usage from "../usage.js";
import type * as waitlist from "../waitlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "agent/auth": typeof agent_auth;
  "agent/dispatch": typeof agent_dispatch;
  "agent/fns": typeof agent_fns;
  "agent/keys": typeof agent_keys;
  "agent/routes": typeof agent_routes;
  auth: typeof auth;
  baseResume: typeof baseResume;
  contacts: typeof contacts;
  crons: typeof crons;
  documentFolders: typeof documentFolders;
  documents: typeof documents;
  dopeAgents: typeof dopeAgents;
  emailAccounts: typeof emailAccounts;
  "emailAgent/draft": typeof emailAgent_draft;
  "emailAgent/followUp": typeof emailAgent_followUp;
  "emailAgent/gmailClient": typeof emailAgent_gmailClient;
  "emailAgent/manualLead": typeof emailAgent_manualLead;
  "emailAgent/mirror": typeof emailAgent_mirror;
  "emailAgent/poll": typeof emailAgent_poll;
  "emailAgent/send": typeof emailAgent_send;
  emailList: typeof emailList;
  extensionApiKeys: typeof extensionApiKeys;
  extensionSaveJob: typeof extensionSaveJob;
  freeResumeStats: typeof freeResumeStats;
  http: typeof http;
  inputSanitizer: typeof inputSanitizer;
  jobLeads: typeof jobLeads;
  jobs: typeof jobs;
  plans: typeof plans;
  rateLimit: typeof rateLimit;
  rateLimitConfig: typeof rateLimitConfig;
  rateLimits: typeof rateLimits;
  resources: typeof resources;
  resumeShares: typeof resumeShares;
  subscriptions: typeof subscriptions;
  threads: typeof threads;
  usage: typeof usage;
  waitlist: typeof waitlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
