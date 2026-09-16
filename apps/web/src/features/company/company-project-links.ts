import type { Id } from "../../../../../convex/_generated/dataModel";

export type CompanyProjectLinkContext = {
  actingCompanyId: Id<"companies">;
  projectId: Id<"projects">;
  projectMemberId: Id<"projectMembers">;
  groupId?: string;
};

export function getCompanyProjectConversationSearch(
  context: CompanyProjectLinkContext,
) {
  return {
    companyId: context.actingCompanyId,
    groupId: context.groupId ?? "",
    membershipId: context.projectMemberId,
    view: "channels" as const,
  };
}

export function getCompanyProjectOverviewSearch(
  context: CompanyProjectLinkContext,
) {
  return {
    companyId: context.actingCompanyId,
    groupId: context.groupId ?? "",
    membershipId: context.projectMemberId,
    view: "overview" as const,
  };
}

export function getCompanyProjectEvidenceSearch(
  context: CompanyProjectLinkContext,
) {
  return {
    companyId: context.actingCompanyId,
    groupId: context.groupId ?? "",
    membershipId: context.projectMemberId,
    view: "evidence" as const,
  };
}

export function getCompanyProjectTaskSearch(context: CompanyProjectLinkContext) {
  return {
    actingCompanyId: context.actingCompanyId,
    groupId: context.groupId ?? "",
    projectMemberId: context.projectMemberId,
    view: "board" as const,
  };
}
