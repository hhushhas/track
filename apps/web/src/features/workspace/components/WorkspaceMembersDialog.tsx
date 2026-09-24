import { useMemo, useState } from 'react'
import { Copy, Search, UserRound, UsersRound } from 'lucide-react'

import type { Id } from '../../../../../../convex/_generated/dataModel'
import { Avatar, AvatarFallback } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { getAvatarTone, getInitials } from '#/features/workspace/identity'
import type { ActiveChannelMemberItem } from '#/features/workspace/lib/channel-header-members'

type WorkspaceMembersDialogProps = {
  channelName?: string
  members: Array<ActiveChannelMemberItem>
  onInvite: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  projectMemberRoleByUserId: Map<string, string>
}

export function WorkspaceMembersDialog({
  channelName,
  members,
  onInvite,
  onOpenChange,
  open,
  projectMemberRoleByUserId,
}: WorkspaceMembersDialogProps) {
  const [query, setQuery] = useState('')
  const [expandedId, setExpandedId] = useState<Id<'users'> | null>(null)
  const [copiedId, setCopiedId] = useState<Id<'users'> | null>(null)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleMembers = useMemo(
    () => members.filter(({ user }) => {
      if (!normalizedQuery) return true
      return `${user.displayName} ${user.email}`.toLocaleLowerCase().includes(normalizedQuery)
    }),
    [members, normalizedQuery],
  )

  async function copyEmail(userId: Id<'users'>, email: string) {
    if (!navigator.clipboard) return
    await navigator.clipboard.writeText(email)
    setCopiedId(userId)
    window.setTimeout(() => setCopiedId((current) => current === userId ? null : current), 1400)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('')
      setExpandedId(null)
      setCopiedId(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="track-dialog track-members-dialog">
        <DialogHeader>
          <DialogTitle><UsersRound aria-hidden="true" size={17} /> Channel members</DialogTitle>
          <DialogDescription>
            {channelName ? `People with access to #${channelName}.` : 'People with access to this Channel.'} Search members or open a row for details and actions.
          </DialogDescription>
        </DialogHeader>
        <div className="track-members-search">
          <Search aria-hidden="true" size={14} />
          <Input
            aria-label="Search channel members"
            autoComplete="off"
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search members…"
            value={query}
          />
        </div>
        <div className="track-members-summary" aria-live="polite">
          <span>{visibleMembers.length} {visibleMembers.length === 1 ? 'member' : 'members'}</span>
          {query ? <span>Matching “{query}”</span> : <span>Project access stays permission-aware</span>}
        </div>
        <ul className="track-members-list" aria-label="Channel members">
          {visibleMembers.map(({ membership, user }) => {
            const role = projectMemberRoleByUserId.get(user._id) ?? 'member'
            const expanded = expandedId === user._id
            return (
              <li className={expanded ? 'is-expanded' : ''} key={membership._id}>
                <div className="track-member-row">
                  <Avatar className={`track-member-avatar ${getAvatarTone(user.email)}`}>
                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                  </Avatar>
                  <span className="track-member-copy">
                    <strong>{user.displayName}</strong>
                    <small>{user.email}</small>
                  </span>
                  <span className="track-member-role">{role}</span>
                  <Button
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} details for ${user.displayName}`}
                    className="track-member-action"
                    onClick={() => setExpandedId(expanded ? null : user._id)}
                    size="sm"
                    variant="ghost"
                  >
                    <UserRound aria-hidden="true" size={13} />
                    {expanded ? 'Hide' : 'Details'}
                  </Button>
                </div>
                {expanded ? (
                  <div className="track-member-details">
                    <dl>
                      <div><dt>Channel access</dt><dd>{membership.status ?? 'active'}</dd></div>
                      <div><dt>Project role</dt><dd>{role}</dd></div>
                    </dl>
                    <Button
                      aria-label={`Copy ${user.displayName}'s email`}
                      className="track-member-copy-action"
                      onClick={() => void copyEmail(user._id, user.email)}
                      size="sm"
                      variant="outline"
                    >
                      <Copy aria-hidden="true" size={13} />
                      {copiedId === user._id ? 'Copied' : 'Copy email'}
                    </Button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        {!visibleMembers.length ? <p className="track-members-empty" role="status">No members match this search.</p> : null}
        <DialogFooter>
          <Button className="track-button" onClick={() => handleOpenChange(false)} type="button" variant="outline">Close</Button>
          <Button className="track-button track-button-primary" onClick={() => { handleOpenChange(false); onInvite() }} type="button">Invite member</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
