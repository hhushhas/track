'use node'

import { v } from 'convex/values'

import { api } from './_generated/api'
import { action } from './_generated/server'
import { createLiveTaskModelAdapter } from './taskDetectionNode'

export const request = action({
  args: {
    importId: v.id('memoryImports'),
    actingCompanyId: v.optional(v.id('companies')),
    projectMemberId: v.optional(v.id('projectMembers')),
  },
  handler: async (ctx, args): Promise<{ created: number }> => {
    const input = await ctx.runQuery(api.taskMemoryExtraction.getInput, args)
    const result = await createLiveTaskModelAdapter().detect([input.message])
    return await ctx.runMutation(api.taskMemoryExtraction.commit, {
      ...args,
      candidates: result.candidates.map((candidate) => ({
        ...candidate, sourceMessageIds: [...candidate.sourceMessageIds],
      })),
      model: result.model,
    })
  },
})
