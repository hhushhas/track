/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as assistant from "../assistant.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as demoSeed from "../demoSeed.js";
import type * as exports from "../exports.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_observability from "../lib/observability.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as records from "../records.js";
import type * as search from "../search.js";
import type * as typingIndicators from "../typingIndicators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  assistant: typeof assistant;
  audit: typeof audit;
  auth: typeof auth;
  crons: typeof crons;
  demoSeed: typeof demoSeed;
  exports: typeof exports;
  groups: typeof groups;
  http: typeof http;
  invitations: typeof invitations;
  "lib/ai": typeof lib_ai;
  "lib/audit": typeof lib_audit;
  "lib/observability": typeof lib_observability;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimit": typeof lib_rateLimit;
  messages: typeof messages;
  notifications: typeof notifications;
  projects: typeof projects;
  pushNotifications: typeof pushNotifications;
  records: typeof records;
  search: typeof search;
  typingIndicators: typeof typingIndicators;
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
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
