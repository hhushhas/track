import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAuthenticatedActor } from "./lib/actorContext";
import {
  requireActiveCompanyMembership,
  requireCompanyAdmin,
} from "./lib/companyPolicy";
import {
  bumpProjectParticipants,
  revokePendingProjectInvitations,
} from "./lib/companyProjectLifecycle";
import {
  captureTaskExitStaging,
  clearTaskExitStaging,
  materializeTaskArchiveSnapshots,
} from "./lib/taskLifecycle";

async function threadStateAtCutoff(
  ctx: MutationCtx,
  thread: Pick<Doc<"channelThreads">, "_id" | "name" | "revision" | "status">,
  cutoff: number,
) {
  const events = await ctx.db
    .query("auditEvents")
    .withIndex("by_entity", (q) =>
      q.eq("entityType", "channelThread").eq("entityId", thread._id),
    )
    .collect();
  const state = {
    name: thread.name,
    revision: thread.revision,
    status: thread.status,
  };
  for (const event of events
    .filter((item: { createdAt: number }) => item.createdAt > cutoff)
    .sort((left: { createdAt: number }, right: { createdAt: number }) => right.createdAt - left.createdAt)) {
    const before = event.before as {
      name?: string;
      revision?: number;
      status?: "active" | "archived";
    } | undefined;
    if (before?.name) state.name = before.name;
    if (before?.revision !== undefined) state.revision = before.revision;
    if (before?.status) state.status = before.status;
  }
  return state;
}

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
    const memoryBox = await ctx.db
      .query("projectMemoryBoxes")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .unique();
    if (memoryBox?.contextWritePendingRevision) {
      throw new Error("memory_context_update_in_progress");
    }
    const exitOperationId = crypto.randomUUID();
    const snapshotPath = `archives/company-exits/${participation._id}/${now}/${exitOperationId}`;
    await ctx.db.patch(participation._id, {
      status: "exit_pending",
      exitPreparedBy: actor.userId,
      exitPreparedAt: now,
      exitCutoff: now,
      exitOperationId,
      exitContextRevision: memoryBox?.lastContextUpdatedAt,
      exitMemoryBoxId: memoryBox?.boxId,
      memorySnapshotStatus: "pending",
      memorySnapshotPath: snapshotPath,
      memorySnapshotError: undefined,
      updatedAt: now,
    });
    await captureTaskExitStaging(ctx, {
      projectCompanyId: participation._id,
      projectId: project._id,
      cutoff: now,
    });
    await bumpProjectParticipants(ctx, project._id, now);
    await ctx.scheduler.runAfter(
      0,
      (internal as any).projectExitActions.snapshot,
      {
        projectCompanyId: participation._id,
        operationId: exitOperationId,
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
        operationId: participation.exitOperationId,
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
    await clearTaskExitStaging(ctx, participation._id);
    await ctx.db.patch(participation._id, {
      status: "active",
      exitPreparedBy: undefined,
      exitPreparedAt: undefined,
      exitCutoff: undefined,
      exitContextRevision: undefined,
      memorySnapshotStatus: undefined,
      memorySnapshotManifestHash: undefined,
      memorySnapshotManifest: undefined,
      memorySnapshotPath: snapshotPath,
      memorySnapshotError: snapshotPath
        ? "snapshot_cleanup_pending"
        : undefined,
      updatedAt: Date.now(),
    });
    await bumpProjectParticipants(ctx, args.projectId, Date.now());
    if (snapshotPath) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).projectExitActions.cleanupSnapshot,
        {
          projectCompanyId: participation._id,
          snapshotPath,
          boxId: participation.exitMemoryBoxId,
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
      {
        projectCompanyId: term._id,
        snapshotPath: term.memorySnapshotPath,
        boxId: term.exitMemoryBoxId,
      },
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
      const threads = (
        await Promise.all(
          channelIds.map(async (groupId) => [
            ...(await ctx.db
              .query("channelThreads")
              .withIndex("by_group_status_updated_at", (q) =>
                q.eq("groupId", groupId).eq("status", "active"),
              )
              .collect()),
            ...(await ctx.db
              .query("channelThreads")
              .withIndex("by_group_status_updated_at", (q) =>
                q.eq("groupId", groupId).eq("status", "archived"),
              )
              .collect()),
          ]),
        )
      ).flat();
      const threadSnapshots = await Promise.all(
        threads
          .filter((thread) => thread.createdAt <= participation.exitCutoff!)
          .map(async (thread) => {
            const [sourceMessage, follower, readState, cutoffState, messages] = await Promise.all([
              thread.sourceMessageId ? ctx.db.get(thread.sourceMessageId) : null,
              ctx.db
                .query("channelThreadFollowers")
                .withIndex("by_thread_project_member", (q) =>
                  q
                    .eq("channelThreadId", thread._id)
                    .eq("projectMemberId", projectMember._id),
                )
                .unique(),
              ctx.db
                .query("channelThreadReadStates")
                .withIndex("by_thread_project_member", (q) =>
                  q
                    .eq("channelThreadId", thread._id)
                    .eq("projectMemberId", projectMember._id),
                )
                .unique(),
              threadStateAtCutoff(ctx, thread, participation.exitCutoff!),
              ctx.db
                .query("messages")
                .withIndex("by_thread_created_at", (q) =>
                  q
                    .eq("channelThreadId", thread._id)
                    .lte("createdAt", participation.exitCutoff!),
                )
                .collect(),
            ]);
            const latestMessage = messages.reduce<Doc<"messages"> | null>(
              (latest, message) =>
                !latest || message.createdAt > latest.createdAt ? message : latest,
              null,
            );
            return {
              _id: thread._id,
              name: cutoffState.name,
              status: cutoffState.status,
              revision: cutoffState.revision,
              sourceAvailable: Boolean(
                sourceMessage &&
                  sourceMessage.createdAt <= participation.exitCutoff!,
              ),
              following: follower?.preference === "following",
              lastReadChannelSequence:
                readState?.lastReadChannelSequence ?? 0,
              replyCount: messages.length,
              latestReplyAt: latestMessage?.createdAt,
              latestChannelSequence: latestMessage?.channelSequence ?? 0,
            };
          }),
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
        threadSnapshots,
        memberSnapshots: await Promise.all(
          (await ctx.db
            .query("projectMembers")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect())
            .filter((member) => member.status === "active")
            .map(async (member) => {
              const memberCompany = member.companyId
                ? await ctx.db.get(member.companyId)
                : null;
              return {
                membership: {
                  _id: member._id,
                  companyId: member.companyId,
                  role: member.role,
                  status: member.status,
                  userId: member.userId,
                  userDisplayNameSnapshot: member.userDisplayNameSnapshot,
                  companyDisplayNameSnapshot:
                    member.companyDisplayNameSnapshot,
                },
                user: {
                  _id: member.userId,
                  displayName:
                    member.userDisplayNameSnapshot ?? "Former member",
                },
                company: memberCompany
                  ? {
                      _id: memberCompany._id,
                      displayName:
                        member.companyDisplayNameSnapshot ??
                        memberCompany.displayName,
                    }
                  : null,
              };
            }),
        ),
        retentionStatus: "active",
        manifestHash: participation.memorySnapshotManifestHash,
        createdAt: now,
        updatedAt: now,
      });
      await materializeTaskArchiveSnapshots(ctx, {
        entitlementId,
        projectCompanyId: participation._id,
        projectId: project._id,
        channelIds,
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
    await clearTaskExitStaging(ctx, participation._id);
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
      await revokePendingProjectInvitations(ctx, project._id, now);
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
      await requireActiveCompanyMembership(ctx, actor, args.actingCompanyId);
      const membership = await ctx.db.get(args.projectMemberId);
      if (
        !membership ||
        membership.userId !== actor.userId ||
        membership.companyId !== args.actingCompanyId ||
        membership.projectId !== args.projectId
      ) throw new Error("project_unavailable");
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
          item.status === "completed" &&
          item.completedAt !== undefined &&
          item.completedAt <= participation.exitCutoff! &&
          ((item.scope ?? "channel") === "project" ||
            Boolean(item.groupId && channelIds.includes(item.groupId))),
      ),
    };
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
      exitMemoryBoxId: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const markSnapshotCleanupFailed = internalMutation({
  args: {
    projectCompanyId: v.id("projectCompanies"),
    snapshotPath: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.status !== "active" ||
      participation.memorySnapshotPath !== args.snapshotPath
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
    snapshotBoxId: v.optional(v.string()),
    operationId: v.string(),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.status !== "exit_pending" ||
      participation.exitOperationId !== args.operationId
    ) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).projectExitActions.cleanupSnapshot,
        {
          projectCompanyId: args.projectCompanyId,
          snapshotPath: args.snapshotPath,
          boxId: args.snapshotBoxId,
        },
      );
      return;
    }
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
  args: {
    projectCompanyId: v.id("projectCompanies"),
    operationId: v.string(),
    snapshotPath: v.string(),
    snapshotBoxId: v.optional(v.string()),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const participation = await ctx.db.get(args.projectCompanyId);
    if (
      !participation ||
      participation.status !== "exit_pending" ||
      participation.exitOperationId !== args.operationId
    ) {
      await ctx.scheduler.runAfter(
        0,
        (internal as any).projectExitActions.cleanupSnapshot,
        {
          projectCompanyId: args.projectCompanyId,
          snapshotPath: args.snapshotPath,
          boxId: args.snapshotBoxId,
        },
      );
      return;
    }
    await ctx.db.patch(participation._id, {
      memorySnapshotStatus: "failed",
      memorySnapshotError: args.error.slice(0, 500),
      updatedAt: Date.now(),
    });
  },
});
