'use node'

import { v } from 'convex/values'

import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { createLiveMemoryBoxAdapter } from './lib/box'

async function contentHash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export const snapshot = internalAction({
  args: { projectCompanyId: v.id('projectCompanies'), operationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery((internal as any).projectExit.getSnapshotInput, args) as any
    if (!input) return
    if (!args.operationId || input.participation.exitOperationId !== args.operationId) return
    const snapshotPath = input.participation.memorySnapshotPath
    if (!snapshotPath) return
    try {
      const sources: Array<{
        scope: 'project' | 'channel'
        groupId?: string
        sourceKind: string
        sourceIdentifier: string
        sourceRevision?: number
        contentHash: string
        contentLength: number
        snapshotIdentifier: string
      }> = []
      const adapter = createLiveMemoryBoxAdapter()
      if (input.memoryBox?.boxId !== input.participation.exitMemoryBoxId) {
        if (input.participation.exitMemoryBoxId || input.memoryBox) {
          throw new Error('snapshot_memory_version_changed')
        }
      }
      if (input.memoryBox && input.memoryBox.status !== 'ready') throw new Error('snapshot_memory_provider_unavailable')
      if (input.imports.length > 0 && input.memoryBox?.status !== 'ready') throw new Error('snapshot_memory_provider_unavailable')
      if (input.memoryBox?.status === 'ready') {
        if (
          input.memoryBox.contextWritePendingRevision ||
          input.memoryBox.lastContextUpdatedAt !== input.participation.exitContextRevision
        ) {
          throw new Error('snapshot_context_revision_changed')
        }
        const context = await adapter.readFile(input.memoryBox.boxId, 'context.md')
        await adapter.writeFile(input.memoryBox.boxId, `${snapshotPath}/context.md`, context)
        const recheck = await ctx.runQuery((internal as any).projectExit.getSnapshotInput, {
          projectCompanyId: args.projectCompanyId,
        }) as any
        if (
          !recheck ||
          recheck.memoryBox?.contextWritePendingRevision ||
          recheck.memoryBox?.lastContextUpdatedAt !== input.participation.exitContextRevision
        ) {
          throw new Error('snapshot_context_revision_changed')
        }
        sources.push({
          scope: 'project',
          sourceKind: 'context',
          sourceIdentifier: 'context.md',
          sourceRevision: input.memoryBox.lastContextUpdatedAt,
          contentHash: await contentHash(context),
          contentLength: new TextEncoder().encode(context).byteLength,
          snapshotIdentifier: `${snapshotPath}/context.md`,
        })
      }
      for (const memoryImport of input.imports) {
        const metadata = JSON.stringify({
          id: memoryImport._id,
          scope: memoryImport.scope ?? 'channel',
          groupId: memoryImport.groupId,
          sourceKind: memoryImport.sourceKind,
          sourceStorageIds: memoryImport.sourceStorageIds,
          sourceUrls: memoryImport.sourceUrls,
          completedAt: memoryImport.completedAt,
        })
        const scope = memoryImport.scope ?? 'channel'
        if (!input.memoryBox?.boxId || !memoryImport.boxScratchPath) throw new Error('snapshot_source_unavailable')
        const sourcePath = memoryImport.boxScratchPath
        const snapshotIdentifier = `${snapshotPath}/imports/${memoryImport._id}`
        const signature = await adapter.exec(input.memoryBox.boxId, {
          command: `cd ${shellQuote(sourcePath)} && find . -type f -exec sha256sum {} \\; | sort`,
        })
        if (signature.exitCode !== 0 || !signature.stdout.trim()) throw new Error('snapshot_source_hash_failed')
        const size = await adapter.exec(input.memoryBox.boxId, {
          command: `find ${shellQuote(sourcePath)} -type f -printf '%s\\n' | awk '{total += $1} END {print total+0}'`,
        })
        if (size.exitCode !== 0) throw new Error('snapshot_source_size_failed')
        const copied = await adapter.exec(input.memoryBox.boxId, {
          command: `mkdir -p ${shellQuote(snapshotIdentifier)} && cp -R ${shellQuote(`${sourcePath}/.`)} ${shellQuote(`${snapshotIdentifier}/`)}`,
        })
        if (copied.exitCode !== 0) throw new Error('snapshot_source_copy_failed')
        const copiedSignature = await adapter.exec(input.memoryBox.boxId, {
          command: `cd ${shellQuote(snapshotIdentifier)} && find . -type f -exec sha256sum {} \\; | sort`,
        })
        const copiedSize = await adapter.exec(input.memoryBox.boxId, {
          command: `find ${shellQuote(snapshotIdentifier)} -type f -printf '%s\\n' | awk '{total += $1} END {print total+0}'`,
        })
        if (
          copiedSignature.exitCode !== 0 ||
          copiedSize.exitCode !== 0 ||
          copiedSignature.stdout !== signature.stdout ||
          copiedSize.stdout.trim() !== size.stdout.trim()
        ) throw new Error('snapshot_copy_verification_failed')
        await adapter.writeFile(input.memoryBox.boxId, `${snapshotIdentifier}/track-manifest.json`, metadata)
        sources.push({
          scope,
          groupId: scope === 'channel' ? String(memoryImport.groupId) : undefined,
          sourceKind: 'import',
          sourceIdentifier: String(memoryImport._id),
          sourceRevision: memoryImport.completedAt ?? memoryImport.updatedAt,
          contentHash: await contentHash(copiedSignature.stdout),
          contentLength: Number.parseInt(size.stdout.trim(), 10) || 0,
          snapshotIdentifier,
        })
      }
      const manifest = {
        version: 1,
        projectId: input.project._id,
        companyId: input.company._id,
        cutoff: input.participation.exitCutoff,
        sources,
      }
      const serialized = JSON.stringify(manifest)
      if (input.memoryBox?.status === 'ready') {
        await adapter.writeFile(input.memoryBox.boxId, `${snapshotPath}/manifest.json`, serialized)
        const persisted = await adapter.readFile(input.memoryBox.boxId, `${snapshotPath}/manifest.json`)
        if (persisted !== serialized) throw new Error('snapshot_manifest_verification_failed')
      }
      await ctx.runMutation((internal as any).projectExit.markSnapshotVerified, {
        projectCompanyId: input.participation._id,
        manifest,
        manifestHash: await contentHash(serialized),
        snapshotPath,
        snapshotBoxId: input.participation.exitMemoryBoxId,
        operationId: args.operationId,
      })
    } catch (error) {
      await ctx.runMutation((internal as any).projectExit.markSnapshotFailed, {
        projectCompanyId: input.participation._id,
        operationId: args.operationId,
        snapshotPath,
        snapshotBoxId: input.participation.exitMemoryBoxId,
        error: error instanceof Error ? error.message : 'snapshot_failed',
      })
    }
  },
})

export const cleanupSnapshot = internalAction({
  args: {
    projectCompanyId: v.id('projectCompanies'),
    snapshotPath: v.string(),
    boxId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      if (args.boxId) {
        const result = await createLiveMemoryBoxAdapter().exec(args.boxId, {
          command: `rm -rf ${shellQuote(args.snapshotPath)}`,
        })
        if (result.exitCode !== 0) throw new Error('snapshot_cleanup_command_failed')
      }
      await ctx.runMutation((internal as any).projectExit.markSnapshotCleaned, {
        projectCompanyId: args.projectCompanyId,
        snapshotPath: args.snapshotPath,
      })
    } catch (error) {
      await ctx.runMutation((internal as any).projectExit.markSnapshotCleanupFailed, {
        projectCompanyId: args.projectCompanyId,
        snapshotPath: args.snapshotPath,
        error: error instanceof Error ? error.message : 'snapshot_cleanup_failed',
      })
    }
  },
})
