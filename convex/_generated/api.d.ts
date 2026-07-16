/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistant from "../assistant.js";
import type * as assistantNode from "../assistantNode.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as channels from "../channels.js";
import type * as companies from "../companies.js";
import type * as companyMigration from "../companyMigration.js";
import type * as crons from "../crons.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as invitations from "../invitations.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_assistantAttachments from "../lib/assistantAttachments.js";
import type * as lib_attachmentTextExtraction from "../lib/attachmentTextExtraction.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_actorContext from "../lib/actorContext.js";
import type * as lib_box from "../lib/box.js";
import type * as lib_companyInvitations from "../lib/companyInvitations.js";
import type * as lib_companyPolicy from "../lib/companyPolicy.js";
import type * as lib_companyProjectLifecycle from "../lib/companyProjectLifecycle.js";
import type * as lib_memoryPolicy from "../lib/memoryPolicy.js";
import type * as lib_observability from "../lib/observability.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_relationshipLifecycle from "../lib/relationshipLifecycle.js";
import type * as lib_requestAuthorization from "../lib/requestAuthorization.js";
import type * as memory from "../memory.js";
import type * as memoryActions from "../memoryActions.js";
import type * as messages from "../messages.js";
import type * as mobile from "../mobile.js";
import type * as notifications from "../notifications.js";
import type * as projects from "../projects.js";
import type * as projectArchives from "../projectArchives.js";
import type * as projectExit from "../projectExit.js";
import type * as projectExitActions from "../projectExitActions.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as reports from "../reports.js";
import type * as relationships from "../relationships.js";
import type * as search from "../search.js";
import type * as sharedProjects from "../sharedProjects.js";
import type * as taskBoards from "../taskBoards.js";
import type * as taskComments from "../taskComments.js";
import type * as taskDetection from "../taskDetection.js";
import type * as taskDetectionNode from "../taskDetectionNode.js";
import type * as taskLabels from "../taskLabels.js";
import type * as taskNotifications from "../taskNotifications.js";
import type * as taskReminders from "../taskReminders.js";
import type * as taskSearch from "../taskSearch.js";
import type * as tasks from "../tasks.js";
import type * as taskSuggestions from "../taskSuggestions.js";
import type * as typingIndicators from "../typingIndicators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assistant: typeof assistant;
  assistantNode: typeof assistantNode;
  audit: typeof audit;
  auth: typeof auth;
  channels: typeof channels;
  companies: typeof companies;
  companyMigration: typeof companyMigration;
  crons: typeof crons;
  groups: typeof groups;
  http: typeof http;
  invitations: typeof invitations;
  "lib/ai": typeof lib_ai;
  "lib/assistantAttachments": typeof lib_assistantAttachments;
  "lib/attachmentTextExtraction": typeof lib_attachmentTextExtraction;
  "lib/audit": typeof lib_audit;
  "lib/actorContext": typeof lib_actorContext;
  "lib/box": typeof lib_box;
  "lib/companyInvitations": typeof lib_companyInvitations;
  "lib/companyPolicy": typeof lib_companyPolicy;
  "lib/companyProjectLifecycle": typeof lib_companyProjectLifecycle;
  "lib/memoryPolicy": typeof lib_memoryPolicy;
  "lib/observability": typeof lib_observability;
  "lib/permissions": typeof lib_permissions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/relationshipLifecycle": typeof lib_relationshipLifecycle;
  "lib/requestAuthorization": typeof lib_requestAuthorization;
  memory: typeof memory;
  memoryActions: typeof memoryActions;
  messages: typeof messages;
  mobile: typeof mobile;
  notifications: typeof notifications;
  projects: typeof projects;
  projectArchives: typeof projectArchives;
  projectExit: typeof projectExit;
  projectExitActions: typeof projectExitActions;
  pushNotifications: typeof pushNotifications;
  reports: typeof reports;
  relationships: typeof relationships;
  search: typeof search;
  sharedProjects: typeof sharedProjects;
  taskBoards: typeof taskBoards;
  taskComments: typeof taskComments;
  taskDetection: typeof taskDetection;
  taskDetectionNode: typeof taskDetectionNode;
  taskLabels: typeof taskLabels;
  taskNotifications: typeof taskNotifications;
  taskReminders: typeof taskReminders;
  taskSearch: typeof taskSearch;
  tasks: typeof tasks;
  taskSuggestions: typeof taskSuggestions;
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
