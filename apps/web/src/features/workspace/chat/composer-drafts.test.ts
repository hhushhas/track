import { afterEach, describe, expect, it } from 'vitest'

import {
  clearAllComposerDrafts,
  getComposerDraftKey,
  readComposerDraft,
  writeComposerDraft,
  type ComposerDraftScope,
} from '#/features/workspace/chat/composer-drafts'

const baseScope: ComposerDraftScope = {
  actorId: 'user-a',
  projectId: 'project-a',
  groupId: 'group-a',
}

afterEach(() => {
  clearAllComposerDrafts()
})

describe('composer draft scope', () => {
  it('separates actor, represented membership, project, channel, and thread', () => {
    const represented = {
      ...baseScope,
      actingCompanyId: 'company-a',
      projectMemberId: 'membership-a',
      threadId: 'thread-a',
    }
    const otherActor = { ...represented, actorId: 'user-b' }
    const otherMembership = { ...represented, projectMemberId: 'membership-b' }
    const otherThread = { ...represented, threadId: 'thread-b' }

    expect(new Set([
      getComposerDraftKey(represented),
      getComposerDraftKey(otherActor),
      getComposerDraftKey(otherMembership),
      getComposerDraftKey(otherThread),
    ]).size).toBe(4)
  })

  it('retains text within a session without sharing it across scopes', () => {
    writeComposerDraft(baseScope, { composer: 'unsent note', replyToMessageId: null })

    expect(readComposerDraft(baseScope)).toEqual({ composer: 'unsent note', replyToMessageId: null })
    expect(readComposerDraft({ ...baseScope, groupId: 'group-b' })).toBeNull()
  })
})
