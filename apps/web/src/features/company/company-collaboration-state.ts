export type ProjectDirectoryFilter =
  | "all"
  | "owned"
  | "collaborating"
  | "proposed"
  | "archived"
  | "ownership";

export type RelationshipDirectoryFilter =
  | "all"
  | "active"
  | "forming"
  | "inactive";

export type PeopleDirectoryFilter = "all" | "active" | "suspended" | "invited";

export function matchesDirectorySearch(
  values: ReadonlyArray<string | null | undefined>,
  search: string,
) {
  const query = search.trim().toLocaleLowerCase();
  return (
    query.length === 0 ||
    values.some((value) => value?.toLocaleLowerCase().includes(query))
  );
}

export function filterProjectDirectory<
  T extends {
    owningCompany: { displayName: string } | null;
    participationRole: "owner" | "collaborator" | "unassigned_legacy";
    project: { description?: string; name: string; status?: string };
  },
>(items: ReadonlyArray<T>, filter: ProjectDirectoryFilter, search: string): T[] {
  return items.filter((item) => {
    if (
      !matchesDirectorySearch(
        [
          item.project.name,
          item.project.description,
          item.owningCompany?.displayName,
        ],
        search,
      )
    ) {
      return false;
    }
    if (filter === "all") return true;
    if (filter === "proposed") return item.project.status === "proposed";
    if (filter === "archived") return item.project.status === "archived";
    if (filter === "owned")
      return (
        item.participationRole === "owner" && item.project.status !== "archived"
      );
    if (filter === "collaborating")
      return (
        item.participationRole === "collaborator" &&
        item.project.status !== "archived"
      );
    if (filter === "ownership")
      return item.participationRole === "unassigned_legacy";
    return false;
  });
}

export function filterRelationshipDirectory<
  T extends {
    participants: ReadonlyArray<{ displayName: string }>;
    relationship: { name: string; status: string };
  },
>(
  items: ReadonlyArray<T>,
  filter: RelationshipDirectoryFilter,
  search: string,
): T[] {
  return items.filter(
    (item) =>
      matchesDirectorySearch(
        [
          item.relationship.name,
          ...item.participants.map(({ displayName }) => displayName),
        ],
        search,
      ) &&
      (filter === "all" || item.relationship.status === filter),
  );
}

export function filterPeopleDirectory<
  T extends {
    membership: { role: string; status: string; userDisplayNameSnapshot: string };
    user: { displayName: string; email: string } | null;
  },
>(items: ReadonlyArray<T>, filter: PeopleDirectoryFilter, search: string): T[] {
  if (filter === "invited") return [];
  return items.filter(({ membership, user }) =>
    matchesDirectorySearch(
      [
        user?.displayName ?? membership.userDisplayNameSnapshot,
        user?.email,
        membership.role,
      ],
      search,
    ) && (filter === "all" || membership.status === filter),
  );
}
