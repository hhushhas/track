type CompanyAvailability<CompanyId extends string> = {
  company: {
    _id: CompanyId;
    status: string;
  } | null;
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
