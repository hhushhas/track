import type { Id } from "../../../../../convex/_generated/dataModel";

export type CompanyProjectContext = {
  actingCompanyId: Id<"companies">;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  groupId?: Id<"groups">;
};

export function getCompanyProjectScopeKey(
  context: {
    actingCompanyId: string;
    projectId: string;
    projectMemberId: string;
    groupId?: string;
  },
  groupId: string | undefined = context.groupId,
) {
  return [
    context.actingCompanyId,
    context.projectId,
    context.projectMemberId,
    groupId ?? "channel",
  ].join(":");
}

function isMessageId(value: string): value is Id<"messages"> {
  return /^[a-z0-9]+$/.test(value);
}

export function getMessageIdFromHash(hash: string): Id<"messages"> | undefined {
  if (!hash.startsWith("#message-")) return undefined;
  try {
    const value = decodeURIComponent(hash.slice("#message-".length));
    return isMessageId(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
