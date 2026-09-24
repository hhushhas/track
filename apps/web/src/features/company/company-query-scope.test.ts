import { describe, expect, it } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";

import {
  canQueryPendingChannelArchives,
  canQueryProjectManagement,
  resolveActiveActingCompanyId,
  resolveCompanyAdministrationId,
} from "./company-query-scope";
import {
  getCompanyProjectScopeKey,
  getMessageIdFromHash,
} from "./company-project-context";
import {
  getCompanyProjectConversationSearch,
  getCompanyProjectEvidenceSearch,
  getCompanyProjectTaskSearch,
} from "./company-project-links";
import { formatCompanyError, formatSnapshotError } from "./company-errors";

function isCompanyId(value: string): value is Id<"companies"> {
  return value.length > 0;
}

function isProjectId(value: string): value is Id<"projects"> {
  return value.length > 0;
}

function isProjectMemberId(value: string): value is Id<"projectMembers"> {
  return value.length > 0;
}

describe("Company query scope", () => {
  const companies = [
    { company: { _id: "active-company", status: "active" } },
    { company: { _id: "suspended-company", status: "suspended" } },
  ];

  it("allows only the explicitly represented active Company", () => {
    expect(resolveActiveActingCompanyId(companies, "active-company")).toBe(
      "active-company",
    );
    expect(resolveActiveActingCompanyId(companies, "suspended-company")).toBe(
      null,
    );
    expect(resolveActiveActingCompanyId(companies, "missing-company")).toBe(
      null,
    );
  });

  it("queries Company administration only for active owners and admins", () => {
    const memberships = [
      {
        company: { _id: "owner-company", status: "active" },
        membership: { role: "owner" },
      },
      {
        company: { _id: "admin-company", status: "active" },
        membership: { role: "admin" },
      },
      {
        company: { _id: "member-company", status: "active" },
        membership: { role: "member" },
      },
    ];

    expect(resolveCompanyAdministrationId(memberships, "owner-company")).toBe(
      "owner-company",
    );
    expect(resolveCompanyAdministrationId(memberships, "admin-company")).toBe(
      "admin-company",
    );
    expect(resolveCompanyAdministrationId(memberships, "member-company")).toBeNull();
  });

  it("queries pending Channel archives only for an active Project manager steward", () => {
    const eligible = {
      channelSteward: true,
      exitStatus: "active",
      projectMemberRole: "manager",
      projectMemberStatus: "active",
      projectStatus: "active",
    };

    expect(canQueryPendingChannelArchives(eligible)).toBe(true);
    expect(
      canQueryPendingChannelArchives({
        ...eligible,
        projectMemberRole: "member",
      }),
    ).toBe(false);
    expect(
      canQueryPendingChannelArchives({
        ...eligible,
        projectStatus: "archived",
      }),
    ).toBe(false);
  });

  it("queries Project management only while the Project is writable", () => {
    const eligible = {
      exitStatus: "active",
      projectMemberRole: "manager",
      projectMemberStatus: "active",
      projectStatus: "active",
    };

    expect(canQueryProjectManagement(eligible)).toBe(true);
    expect(
      canQueryProjectManagement({ ...eligible, projectStatus: "proposed" }),
    ).toBe(true);
    expect(
      canQueryProjectManagement({ ...eligible, projectStatus: "archive_pending" }),
    ).toBe(false);
    expect(
      canQueryProjectManagement({ ...eligible, projectStatus: "archived" }),
    ).toBe(false);
    expect(
      canQueryProjectManagement({ ...eligible, projectMemberRole: "member" }),
    ).toBe(false);
  });

  it("keeps reply and draft scopes distinct across Company, Project, and Channel", () => {
    const first = getCompanyProjectScopeKey({
      actingCompanyId: "active-company",
      projectId: "project-a",
      projectMemberId: "member-a",
      groupId: "channel-a",
    });
    const second = getCompanyProjectScopeKey({
      actingCompanyId: "active-company",
      projectId: "project-a",
      projectMemberId: "member-a",
      groupId: "channel-b",
    });
    const otherCompany = getCompanyProjectScopeKey({
      actingCompanyId: "other-company",
      projectId: "project-a",
      projectMemberId: "member-a",
      groupId: "channel-a",
    });

    expect(new Set([first, second, otherCompany]).size).toBe(3);
  });

  it("preserves represented Company identity in the Evidence route", () => {
    expect(getCompanyProjectEvidenceSearch({
      actingCompanyId: "active-company" as Id<"companies">,
      projectId: "project-a" as Id<"projects">,
      projectMemberId: "member-a" as Id<"projectMembers">,
    })).toEqual({
      companyId: "active-company",
      groupId: "",
      membershipId: "member-a",
      view: "evidence",
    });
  });

  it("only accepts a well-formed message hash for source navigation", () => {
    expect(getMessageIdFromHash("#message-jd7abc123")).toBe("jd7abc123");
    expect(getMessageIdFromHash("#message-not a message")).toBeUndefined();
    expect(getMessageIdFromHash("#message-%E0%A4%A")).toBeUndefined();
  });

  it("does not expose arbitrary server errors or snapshot details", () => {
    expect(formatCompanyError(new Error("unexpected_database_details"))).toBe(
      "We couldn’t save that change. Try again.",
    );
    expect(formatCompanyError(new Error("project_ownership_transfer_required"))).toBe(
      "Transfer Project ownership before this Company exits.",
    );
    expect(formatSnapshotError("snapshot_source_hash_failed:private path")).toBe(
      "The exit snapshot could not be verified. Retry it before finalizing.",
    );
  });

  it("keeps the represented Company and membership on Project links", () => {
    const actingCompanyId = "active-company";
    const projectId = "project-a";
    const projectMemberId = "member-a";
    if (
      !isCompanyId(actingCompanyId) ||
      !isProjectId(projectId) ||
      !isProjectMemberId(projectMemberId)
    ) {
      throw new Error("test IDs must be present");
    }
    const context = {
      actingCompanyId,
      projectId,
      projectMemberId,
      groupId: "channel-a",
    };
    expect(getCompanyProjectConversationSearch(context)).toEqual({
      companyId: "active-company",
      groupId: "channel-a",
      membershipId: "member-a",
      view: "channels",
    });
    expect(getCompanyProjectTaskSearch(context)).toEqual({
      actingCompanyId: "active-company",
      groupId: "channel-a",
      projectMemberId: "member-a",
      view: "list",
    });
  });
});
