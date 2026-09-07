import type { Id } from '../../../../../../convex/_generated/dataModel'

export type ScopedComposerContext = {
  actingCompanyId: Id<'companies'>
  projectMemberId: Id<'projectMembers'>
}
