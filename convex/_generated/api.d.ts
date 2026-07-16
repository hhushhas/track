/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as assistant from "../assistant.js";
import type * as assistantNode from "../assistantNode.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as foundation from "../foundation.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_actorContext from "../lib/actorContext.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_assistantAttachments from "../lib/assistantAttachments.js";
import type * as lib_attachmentTextExtraction from "../lib/attachmentTextExtraction.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_box from "../lib/box.js";
import type * as lib_memoryPolicy from "../lib/memoryPolicy.js";
import type * as lib_observability from "../lib/observability.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_projectChannelPolicy from "../lib/projectChannelPolicy.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as memory from "../memory.js";
import type * as memoryActions from "../memoryActions.js";
import type * as messages from "../messages.js";
import type * as mobile from "../mobile.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as releaseConfig from "../releaseConfig.js";
import type * as reports from "../reports.js";
import type * as schema_companyTables from "../schema/companyTables.js";
import type * as schema_foundationValidators from "../schema/foundationValidators.js";
import type * as schema_taskTables from "../schema/taskTables.js";
import type * as schema_threadTables from "../schema/threadTables.js";
import type * as search from "../search.js";
import type * as typingIndicators from "../typingIndicators.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  assistant: typeof assistant;
  assistantNode: typeof assistantNode;
  audit: typeof audit;
  auth: typeof auth;
  crons: typeof crons;
  foundation: typeof foundation;
  groups: typeof groups;
  http: typeof http;
  invitations: typeof invitations;
  "lib/actorContext": typeof lib_actorContext;
  "lib/ai": typeof lib_ai;
  "lib/assistantAttachments": typeof lib_assistantAttachments;
  "lib/attachmentTextExtraction": typeof lib_attachmentTextExtraction;
  "lib/audit": typeof lib_audit;
  "lib/box": typeof lib_box;
  "lib/memoryPolicy": typeof lib_memoryPolicy;
  "lib/observability": typeof lib_observability;
  "lib/permissions": typeof lib_permissions;
  "lib/projectChannelPolicy": typeof lib_projectChannelPolicy;
  "lib/rateLimit": typeof lib_rateLimit;
  memory: typeof memory;
  memoryActions: typeof memoryActions;
  messages: typeof messages;
  mobile: typeof mobile;
  notifications: typeof notifications;
  projects: typeof projects;
  pushNotifications: typeof pushNotifications;
  releaseConfig: typeof releaseConfig;
  reports: typeof reports;
  "schema/companyTables": typeof schema_companyTables;
  "schema/foundationValidators": typeof schema_foundationValidators;
  "schema/taskTables": typeof schema_taskTables;
  "schema/threadTables": typeof schema_threadTables;
  search: typeof search;
  typingIndicators: typeof typingIndicators;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
