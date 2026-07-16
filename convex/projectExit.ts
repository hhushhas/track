import { v } from "convex/values";

import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAuthenticatedActor } from "./lib/actorContext";
import {
  requireCompanyAdmin,
  resolveCompanyProjectAccess,
} from "./lib/companyPolicy";
import { bumpProjectParticipants } from "./lib/companyProjectLifecycle";

export const prepare = mutation({
  args: { actingCompanyId: v.id("companies"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId);
    const project = await ctx.db.get(args.projectId);
    if (
      !project ||
      project.accessProfile !== "company" ||
      project.origin !== "shared"
    ) {
      throw new Error("shared_project_unavailable");
    }
    const terms = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_company_term", (q) =>
        q.eq("projectId", project._id).eq("companyId", args.actingCompanyId),
      )
      .collect();
    const alreadyPending = terms.find((term) => term.status === "exit_pending");
    if (alreadyPending) return alreadyPending._id;
    const participation = terms.find((term) => term.status === "active");
    if (!participation) throw new Error("project_participation_unavailable");
    const now = Date.now();
    await ctx.db.patch(participation._id, {
      status: "exit_pending",
      exitPreparedBy: actor.userId,
      exitPreparedAt: now,
      exitCutoff: now,
      memorySnapshotStatus: "pending",
      memorySnapshotError: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      (internal as any).projectExitActions.snapshot,
      {
        projectCompanyId: participation._id,
      },
    );
    return participation._id;
  },
});

export const retrySnapshot = mutation({
  args: { actingCompanyId: v.id("companies"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId);
    const participations = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "exit_pending"),
      )
      .collect();
    const participation = participations.find(
      (term) => term.companyId === args.actingCompanyId,
    );
    if (!participation) throw new Error("exit_not_pending");
    await ctx.db.patch(participation._id, {
      memorySnapshotStatus: "pending",
      memorySnapshotError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      (internal as any).projectExitActions.snapshot,
      {
        projectCompanyId: participation._id,
      },
    );
    return participation._id;
  },
});

export const cancel = mutation({
  args: { actingCompanyId: v.id("companies"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId);
    const participations = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", "exit_pending"),
      )
      .collect();
    const participation = participations.find(
      (term) => term.companyId === args.actingCompanyId,
    );
    if (!participation) throw new Error("exit_not_pending");
    const snapshotPath = participation.memorySnapshotPath;
    await ctx.db.patch(participation._id, {
      status: "active",
      exitPreparedBy: undefined,
      exitPreparedAt: undefined,
      exitCutoff: undefined,
      memorySnapshotStatus: undefined,
      memorySnapshotManifestHash: undefined,
      memorySnapshotManifest: undefined,
      memorySnapshotPath: snapshotPath,
      memorySnapshotError: snapshotPath
        ? "snapshot_cleanup_pending"
        : undefined,
      updatedAt: Date.now(),
    });
    if (snapshotPath) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).projectExitActions.cleanupSnapshot,
        {
          projectCompanyId: participation._id,
        },
      );
    }
    return participation._id;
  },
});

export const retryCleanup = mutation({
  args: { actingCompanyId: v.id("companies"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    await requireCompanyAdmin(ctx, actor, args.actingCompanyId);
    const terms = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_company_term", (q) =>
        q.eq("projectId", args.projectId).eq("companyId", args.actingCompanyId),
      )
      .collect();
    const term = terms.find(
      (candidate) =>
        candidate.status === "active" && candidate.memorySnapshotPath,
    );
    if (!term) throw new Error("snapshot_cleanup_unavailable");
    await ctx.db.patch(term._id, {
      memorySnapshotError: "snapshot_cleanup_pending",
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      (internal as any).projectExitActions.cleanupSnapshot,
      { projectCompanyId: term._id },
    );
    return term._id;
  },
});

export const finalize = mutation({
  args: { actingCompanyId: v.id("companies"), projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    const { company } = await requireCompanyAdmin(
      ctx,
      actor,
      args.actingCompanyId,
    );
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("project_unavailable");
    const participations = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", project._id).eq("status", "exit_pending"),
      )
      .collect();
    const participation = participations.find(
      (term) => term.companyId === company._id,
    );
    if (!participation) throw new Error("exit_not_pending");
    if (
      participation.memorySnapshotStatus !== "verified" ||
      !participation.memorySnapshotManifestHash ||
      !participation.memorySnapshotManifest ||
      !participation.exitCutoff
    )
      throw new Error("exit_snapshot_not_verified");

    const projectMembers = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_company_status", (q) =>
        q
          .eq("projectId", project._id)
          .eq("companyId", company._id)
          .eq("status", "active"),
      )
      .collect();
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect();
    const now = Date.now();
    for (const projectMember of projectMembers) {
      const channelMemberships = await ctx.db
        .query("groupMembers")
        .withIndex("by_project_member_status", (q) =>
          q.eq("projectMemberId", projectMember._id).eq("status", "active"),
        )
        .collect();
      const channelIds = channelMemberships.map(
        (membership) => membership.groupId,
      );
      const entitlementId = await ctx.db.insert("projectArchiveEntitlements", {
        projectId: project._id,
        projectCompanyId: participation._id,
        companyId: company._id,
        projectMemberId: projectMember._id,
        exitAt: participation.exitCutoff,
        channelIds,
        projectSnapshot: {
          _id: project._id,
          name: project.name,
          description: project.description,
          origin: project.origin,
          status: project.status,
        },
        channelSnapshots: groups
          .filter((group) => channelIds.includes(group._id))
          .map((group) => ({
            _id: group._id,
            kind: group.kind,
            name: group.name,
            status: group.status,
          })),
        retentionStatus: "active",
        manifestHash: participation.memorySnapshotManifestHash,
        createdAt: now,
        updatedAt: now,
      });
      const manifest = participation.memorySnapshotManifest as {
        sources?: Array<{
          scope: "project" | "channel";
          groupId?: string;
          sourceKind: string;
          sourceIdentifier: string;
          sourceRevision?: number;
          contentHash: string;
          contentLength: number;
          snapshotIdentifier: string;
        }>;
      };
      for (const source of manifest.sources ?? []) {
        if (
          source.scope === "channel" &&
          (!source.groupId || !channelIds.map(String).includes(source.groupId))
        )
          continue;
        await ctx.db.insert("projectArchiveSnapshots", {
          entitlementId,
          scope: source.scope,
          ...(source.groupId ? { groupId: source.groupId as never } : {}),
          sourceKind: source.sourceKind,
          sourceIdentifier: source.sourceIdentifier,
          sourceRevision: source.sourceRevision,
          contentHash: source.contentHash,
          contentLength: source.contentLength,
          snapshotIdentifier: source.snapshotIdentifier,
          createdAt: now,
        });
      }
      await Promise.all(
        channelMemberships.map((membership) =>
          ctx.db.patch(membership._id, {
            status: "archived",
            endedAt: now,
            updatedAt: now,
          }),
        ),
      );
      await ctx.db.patch(projectMember._id, {
        status: "archived",
        endedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(participation._id, {
      status: "exited",
      exitedBy: actor.userId,
      exitedAt: now,
      updatedAt: now,
    });
    await bumpProjectParticipants(ctx, project._id, now);
    const remaining = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", project._id).eq("status", "active"),
      )
      .collect();
    if (remaining.length === 0) {
      await ctx.db.patch(project._id, {
        status: "archived",
        archiveReason: "no_active_participants",
        revision: (project.revision ?? 0) + 1,
        updatedAt: now,
      });
    }
    return participation._id;
  },
});

export const getStatus = query({
  args: {
    actingCompanyId: v.id("companies"),
    projectId: v.id("projects"),
    projectMemberId: v.optional(v.id("projectMembers")),
  },
  handler: async (ctx, args) => {
    const actor = await requireAuthenticatedActor(ctx);
    if (args.projectMemberId) {
      await resolveCompanyProjectAccess(ctx, actor, {
        actingCompanyId: args.actingCompanyId,
        projectId: args.projectId,
        projectMemberId: args.projectMemberId,
      });
    } else {
      await requireCompanyAdmin(ctx, actor, args.actingCompanyId);
    }
    const terms = await ctx.db
      .query("projectCompanies")
      .withIndex("by_project_company_term", (q) =>
        q.eq("projectId", args.projectId).eq("companyId", args.actingCompanyId),
      )
      .collect();
    const term = terms.slice().sort((a, b) => b.term - a.term)[0];
    return term
      ? {
          status: term.status,
          snapshotStatus: term.memorySnapshotStatus,
          snapshotError: term.memorySnapshotError,
        }
      : null;
  },
});

export const getSnapshotInput = internalQuery({
  args: { projectCompanyId: v.id("projectCompanies") },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.status !== "exit_pending" ||
      !participation.exitCutoff
    )
      return null;
    const [project, company, memoryBox, members, imports] = await Promise.all([
      ctx.db.get(participation.projectId),
      ctx.db.get(participation.companyId),
      ctx.db
        .query("projectMemoryBoxes")
        .withIndex("by_project", (q) =>
          q.eq("projectId", participation.projectId),
        )
        .unique(),
      ctx.db
        .query("projectMembers")
        .withIndex("by_project_company_status", (q) =>
          q
            .eq("projectId", participation.projectId)
            .eq("companyId", participation.companyId)
            .eq("status", "active"),
        )
        .collect(),
      ctx.db
        .query("memoryImports")
        .withIndex("by_project_created_at", (q) =>
          q.eq("projectId", participation.projectId),
        )
        .collect(),
    ]);
    if (!project || !company) return null;
    const memberships = (
      await Promise.all(
        members.map(
          async (member) =>
            await ctx.db
              .query("groupMembers")
              .withIndex("by_project_member_status", (q) =>
                q.eq("projectMemberId", member._id).eq("status", "active"),
              )
              .collect(),
        ),
      )
    ).flat();
    const channelIds = Array.from(
      new Set(memberships.map((membership) => membership.groupId)),
    );
    return {
      participation,
      project,
      company,
      memoryBox,
      channelIds,
      imports: imports.filter(
        (item) =>
          item.createdAt <= participation.exitCutoff! &&
          ((item.scope ?? "channel") === "project" ||
            Boolean(item.groupId && channelIds.includes(item.groupId))),
      ),
    };
  },
});

export const getMemoryBoxForCleanup = internalQuery({
  args: { projectCompanyId: v.id("projectCompanies") },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (!participation?.memorySnapshotPath) return null;
    const memoryBox = await ctx.db
      .query("projectMemoryBoxes")
      .withIndex("by_project", (q) =>
        q.eq("projectId", participation.projectId),
      )
      .unique();
    return { memoryBox, participation };
  },
});

export const markSnapshotCleaned = internalMutation({
  args: {
    projectCompanyId: v.id("projectCompanies"),
    snapshotPath: v.string(),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.memorySnapshotPath !== args.snapshotPath ||
      participation.status !== "active"
    )
      return;
    await ctx.db.patch(participation._id, {
      memorySnapshotError: undefined,
      memorySnapshotPath: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markSnapshotCleanupFailed = internalMutation({
  args: { projectCompanyId: v.id("projectCompanies"), error: v.string() },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.status !== "active" ||
      !participation.memorySnapshotPath
    )
      return;
    await ctx.db.patch(participation._id, {
      memorySnapshotError: `snapshot_cleanup_failed:${args.error.slice(0, 400)}`,
      updatedAt: Date.now(),
    });
  },
});

export const markSnapshotVerified = internalMutation({
  args: {
    projectCompanyId: v.id("projectCompanies"),
    manifestHash: v.string(),
    manifest: v.any(),
    snapshotPath: v.string(),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (!participation || participation.status !== "exit_pending") return;
    await ctx.db.patch(participation._id, {
      memorySnapshotStatus: "verified",
      memorySnapshotManifestHash: args.manifestHash,
      memorySnapshotManifest: args.manifest,
      memorySnapshotPath: args.snapshotPath,
      memorySnapshotError: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markSnapshotFailed = internalMutation({
  args: { projectCompanyId: v.id("projectCompanies"), error: v.string() },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (!participation || participation.status !== "exit_pending") return;
    await ctx.db.patch(participation._id, {
      memorySnapshotStatus: "failed",
      memorySnapshotError: args.error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});
