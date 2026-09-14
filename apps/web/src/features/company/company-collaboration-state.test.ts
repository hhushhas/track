import { describe, expect, it } from "vitest";

import {
  filterPeopleDirectory,
  filterProjectDirectory,
  filterRelationshipDirectory,
  matchesDirectorySearch,
} from "./company-collaboration-state";

describe("Company collaboration directory state", () => {
  it("normalizes search without losing ownership and archive boundaries", () => {
    const projects = [
      {
        owningCompany: { displayName: "Acme Health" },
        participationRole: "owner" as const,
        project: { name: "Patient Portal", status: "active" },
      },
      {
        owningCompany: { displayName: "Orbit Finance" },
        participationRole: "collaborator" as const,
        project: { name: "Partner Launch", status: "archived" },
      },
      {
        owningCompany: null,
        participationRole: "unassigned_legacy" as const,
        project: { name: "Legacy Migration", status: "active" },
      },
      {
        owningCompany: { displayName: "Acme Health" },
        participationRole: "owner" as const,
        project: { name: "Care Research", status: "proposed" },
      },
    ];

    expect(filterProjectDirectory(projects, "owned", " patient ")).toEqual([projects[0]]);
    expect(filterProjectDirectory(projects, "archived", "orbit")).toEqual([projects[1]]);
    expect(filterProjectDirectory(projects, "ownership", "legacy")).toEqual([projects[2]]);
    expect(filterProjectDirectory(projects, "proposed", "research")).toEqual([
      projects[3],
    ]);
  });

  it("searches relationship names and partner Companies within the selected state", () => {
    const relationships = [
      {
        participants: [
          { displayName: "Acme Health" },
          { displayName: "Orbit Finance" },
        ],
        relationship: { name: "Patient payments", status: "active" },
      },
      {
        participants: [{ displayName: "Northstar Labs" }],
        relationship: { name: "Research", status: "forming" },
      },
    ];

    expect(
      filterRelationshipDirectory(relationships, "active", "orbit"),
    ).toEqual([relationships[0]]);
    expect(
      filterRelationshipDirectory(relationships, "forming", "orbit"),
    ).toEqual([]);
  });

  it("keeps Company directory filters separate from invitation state", () => {
    const people = [
      {
        membership: {
          role: "owner",
          status: "active",
          userDisplayNameSnapshot: "Daniel Brooks",
        },
        user: { displayName: "Daniel Brooks", email: "daniel@example.com" },
      },
      {
        membership: {
          role: "member",
          status: "suspended",
          userDisplayNameSnapshot: "Sarah Kim",
        },
        user: null,
      },
    ];

    expect(
      filterPeopleDirectory(people, "active", "daniel@example.com"),
    ).toEqual([people[0]]);
    expect(filterPeopleDirectory(people, "suspended", "sarah")).toEqual([
      people[1],
    ]);
    expect(filterPeopleDirectory(people, "invited", "")).toEqual([]);
    expect(matchesDirectorySearch(["Compliance Hub"], "  HUB ")).toBe(true);
  });
});
