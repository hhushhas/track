import type { Doc, Id } from '../../../../convex/_generated/dataModel';

export type ProjectScopeRow = {
  project: Pick<Doc<'projects'>, '_id'>;
  membership: Pick<Doc<'projectMembers'>, '_id' | 'companyId'>;
};

/** Resolves a represented Project by membership first; Project IDs are not unique across Company identities. */
export function findProjectScope<T extends ProjectScopeRow>(
  projects: readonly T[],
  projectId: Id<'projects'> | null,
  membershipId: Id<'projectMembers'> | null,
  companyId?: string,
) {
  return projects.find((row) => {
    if (membershipId) return row.membership._id === membershipId;
    if (row.project._id !== projectId) return false;
    return companyId ? row.membership.companyId === companyId : !row.membership.companyId;
  });
}
