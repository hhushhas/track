type CompanyAvailability<CompanyId extends string> = {
  company: {
    _id: CompanyId;
    status: string;
  } | null;
};

type CompanyAdministrationAvailability<CompanyId extends string> =
  CompanyAvailability<CompanyId> & {
    membership: { role: string };
  };

export function resolveActiveActingCompanyId<CompanyId extends string>(
  companies: Array<CompanyAvailability<CompanyId>> | undefined,
  actingCompanyId: CompanyId | null,
) {
  if (!actingCompanyId) return null;
  const actingCompany = companies?.find(
    (item) => item.company?._id === actingCompanyId,
  )?.company;
  return actingCompany?.status === "active" ? actingCompany._id : null;
}

export function resolveCompanyAdministrationId<CompanyId extends string>(
  companies: Array<CompanyAdministrationAvailability<CompanyId>> | undefined,
  actingCompanyId: CompanyId | null,
) {
  if (!actingCompanyId) return null;
  const actingCompany = companies?.find(
    (item) => item.company?._id === actingCompanyId,
  );
  if (actingCompany?.company?.status !== "active") return null;
  return actingCompany.membership.role === "owner" ||
    actingCompany.membership.role === "admin"
    ? actingCompanyId
    : null;
}

export function canQueryPendingChannelArchives(input: {
  channelSteward: boolean;
  exitStatus: string | undefined;
  projectMemberRole: string | undefined;
  projectMemberStatus: string | undefined;
  projectStatus: string | undefined;
}) {
  return (
    input.channelSteward &&
    input.exitStatus === "active" &&
    input.projectMemberRole === "manager" &&
    input.projectMemberStatus === "active" &&
    input.projectStatus !== "archived"
  );
}

export function canQueryProjectManagement(input: {
  exitStatus: string | undefined;
  projectMemberRole: string | undefined;
  projectMemberStatus: string | undefined;
  projectStatus: string | undefined;
}) {
  return (
    input.exitStatus === "active" &&
    input.projectMemberRole === "manager" &&
    input.projectMemberStatus === "active" &&
    (input.projectStatus === "active" || input.projectStatus === "proposed")
  );
}
