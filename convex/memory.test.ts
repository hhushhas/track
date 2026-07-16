import { convexTest } from 'convex-test'
import { describe, expect, it } from 'vitest'

import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import schema from './schema'

const modules = (import.meta as ImportMeta & {
  glob: (patterns: Array<string>) => Record<string, () => Promise<unknown>>
}).glob(['./**/*.{ts,js}', '!./**/*.test.{ts,js}'])

describe('memory import metadata', () => {
  it('records import lifecycle status and audit events', async () => {
    const t = convexTest(schema, modules)
    const now = Date.now()
    const { actorId, groupId, projectId } = await seedProjectMembership(t, now)
    const actor = t.withIdentity({ subject: 'memory-tester' })

    await actor.mutation((internal as any).memory.authorizeGroupMemoryWrite, {
      actorId,
      groupId,
      projectId,
    })
    const importId = await t.mutation((internal as any).memory.createImportJob, {
      actorId,
      createdAt: now,
      groupId,
      projectId,
      sourceKind: 'paste',
      sourceStorageIds: [],
      sourceUrls: [],
    }) as Id<'memoryImports'>

    await t.mutation((internal as any).memory.updateImportJob, {
      boxScratchPath: `scratch/groups/${groupId}/imports/${importId}`,
      completedAt: now + 2,
      importId,
      status: 'completed',
      summary: 'context length 147 -> 178 (+31)',
      updatedAt: now + 2,
    })
    await t.mutation((internal as any).memory.auditMemoryEvent, {
      action: 'memory_import.completed',
      actorId,
      after: { summary: 'context length 147 -> 178 (+31)' },
      entityId: String(importId),
      entityType: 'memoryImport',
      groupId,
      projectId,
    })

    const { auditActions, imports } = await t.run(async (ctx) => {
      const imports = await ctx.db
        .query('memoryImports')
        .withIndex('by_project_created_at', (q) => q.eq('projectId', projectId))
        .collect()
      const auditActions = (await ctx.db
        .query('auditEvents')
        .withIndex('by_project_created_at', (q) => q.eq('projectId', projectId))
        .collect()).map((event) => event.action)
      return { auditActions, imports }
    })

    expect(imports).toHaveLength(1)
    expect(imports[0]).toMatchObject({
      actorId,
      boxScratchPath: `scratch/groups/${groupId}/imports/${importId}`,
      groupId,
      projectId,
      sourceKind: 'paste',
      status: 'completed',
      summary: 'context length 147 -> 178 (+31)',
    })
    expect(auditActions).toEqual(expect.arrayContaining([
      'memory_import.queued',
      'memory_import.completed',
    ]))
  })

  it('rejects a memory write scoped to another project group', async () => {
    const t = convexTest(schema, modules)
    const now = Date.now()
    const { actorId, projectId } = await seedProjectMembership(t, now)
    const actor = t.withIdentity({ subject: 'memory-tester' })
    const otherProjectId = await t.run(async (ctx) => {
      const otherProjectId = await ctx.db.insert('projects', {
        createdAt: now,
        createdBy: actorId,
        name: 'Other Project',
        updatedAt: now,
      })
      return otherProjectId
    })
    const otherGroupId = await t.run(async (ctx) => {
      return await ctx.db.insert('groups', {
        createdAt: now,
        createdBy: actorId,
        kind: 'general',
        name: 'Other General',
        projectId: otherProjectId,
        updatedAt: now,
      })
    })

    await expect(actor.mutation((internal as any).memory.authorizeGroupMemoryWrite, {
      actorId,
      groupId: otherGroupId,
      projectId,
    })).rejects.toThrow('group_project_mismatch')
  })
})

async function seedProjectMembership(t: ReturnType<typeof convexTest>, now: number) {
  return await t.run(async (ctx) => {
    const actorId = await ctx.db.insert('users', {
      createdAt: now,
      displayName: 'Memory Tester',
      email: 'memory@example.test',
      googleSubject: 'memory-tester',
      twoFactorEnabled: false,
      updatedAt: now,
    })
    const projectId = await ctx.db.insert('projects', {
      createdAt: now,
      createdBy: actorId,
      name: 'Memory Project',
      updatedAt: now,
    })
    const groupId = await ctx.db.insert('groups', {
      createdAt: now,
      createdBy: actorId,
      kind: 'general',
      name: 'General',
      projectId,
      updatedAt: now,
    })
    await ctx.db.insert('projectMembers', {
      createdAt: now,
      projectId,
      role: 'owner',
      updatedAt: now,
      userId: actorId,
    })
    await ctx.db.insert('groupMembers', {
      createdAt: now,
      groupId,
      projectId,
      updatedAt: now,
      userId: actorId,
    })
    return { actorId, groupId, projectId }
  })
}
