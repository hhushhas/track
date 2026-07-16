import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState, type FormEvent } from 'react'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'

type RelationshipItem = {
  relationship: { _id: Id<'relationships'>; name: string }
  participants: Array<{ _id: Id<'companies'>; displayName: string }>
}

export function MigrationPanel({
  actingCompanyId,
  currentUserId,
  relationships,
  run,
}: {
  actingCompanyId: Id<'companies'>
  currentUserId: Id<'users'>
  relationships: Array<RelationshipItem>
  run: (action: () => Promise<unknown>) => Promise<void>
}) {
  const legacyProjects = useQuery(api.projects.list, { userId: currentUserId })
  const pending = useQuery(api.companyMigration.listPendingForCompany, { actingCompanyId })
  const [projectId, setProjectId] = useState<Id<'projects'> | ''>('')
  const [relationshipId, setRelationshipId] = useState<Id<'relationships'> | ''>('')
  const [companyByMember, setCompanyByMember] = useState<Record<string, string>>({})
  const [roleByMember, setRoleByMember] = useState<Record<string, 'manager' | 'member'>>({})
  const [managerSelections, setManagerSelections] = useState<Record<string, Set<string>>>({})
  const members = useQuery(api.projects.listMembers, projectId ? { projectId, userId: currentUserId } : 'skip')
  const upgrade = useQuery(api.companyMigration.get, projectId ? { projectId } : 'skip')
  const initiate = useMutation(api.companyMigration.initiate)
  const confirmCompany = useMutation(api.companyMigration.confirmCompany)
  const activate = useMutation(api.companyMigration.activate)
  const cancel = useMutation(api.companyMigration.cancel)
  const selectedRelationship = relationships.find((item) => item.relationship._id === relationshipId)
  const companyChoices = useMemo(() => {
    const choices = selectedRelationship?.participants ?? []
    return choices.some((company) => company._id === actingCompanyId)
      ? choices
      : [{ _id: actingCompanyId, displayName: 'Acting Company' }, ...choices]
  }, [actingCompanyId, selectedRelationship])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!projectId || !members) return
    const mappings = members.map(({ membership }) => ({
      projectMemberId: membership._id,
      companyId: companyByMember[membership._id] as Id<'companies'>,
      neutralRole: roleByMember[membership._id],
    }))
    if (mappings.some((mapping) => !mapping.companyId || !mapping.neutralRole)) return
    await run(() => initiate({
      idempotencyKey: crypto.randomUUID(),
      initiatingCompanyId: actingCompanyId,
      mappings,
      projectId,
      relationshipId: relationshipId || undefined,
    }))
  }

  return <section className="company-panel">
    <h2>Guided legacy upgrade</h2>
    <p>Track will not infer Company identity or neutral roles. Map every person explicitly; existing Group membership is preserved exactly.</p>
    <form className="company-migration-form" onSubmit={(event) => void submit(event)}>
      <label>Legacy Project<select onChange={(event) => {
        setProjectId(event.target.value as Id<'projects'>)
        setCompanyByMember({})
        setRoleByMember({})
      }} required value={projectId}><option value="">Select Project</option>{legacyProjects?.filter((item) => item.membership.role === 'owner').map((item) => <option key={item.project._id} value={item.project._id}>{item.project.name}</option>)}</select></label>
      <label>Relationship for multiple Companies<select onChange={(event) => setRelationshipId(event.target.value as Id<'relationships'>)} value={relationshipId}><option value="">Single-Company upgrade</option>{relationships.map((item) => <option key={item.relationship._id} value={item.relationship._id}>{item.relationship.name}</option>)}</select></label>
      {members?.map(({ membership, user }) => <fieldset key={membership._id}><legend>{user?.displayName ?? 'Unknown member'}</legend><label>Represented Company<select onChange={(event) => setCompanyByMember((current) => ({ ...current, [membership._id]: event.target.value }))} required value={companyByMember[membership._id] ?? ''}><option value="">Choose explicitly</option>{companyChoices.map((company) => <option key={company._id} value={company._id}>{company.displayName}</option>)}</select></label><label>Neutral Project role<select onChange={(event) => setRoleByMember((current) => ({ ...current, [membership._id]: event.target.value as 'manager' | 'member' }))} required value={roleByMember[membership._id] ?? ''}><option value="">Choose explicitly</option><option value="manager">Manager</option><option value="member">Member</option></select></label></fieldset>)}
      <Button disabled={!projectId || Boolean(upgrade)} type="submit">Start reviewed upgrade</Button>
    </form>
    {upgrade ? <div className="company-admin-card"><strong>Upgrade status: {upgrade.upgrade.status}</strong><p>{upgrade.companies.filter((item) => item.status === 'confirmed').length} of {upgrade.companies.length} Companies confirmed.</p>{upgrade.upgrade.status === 'ready' ? <Button onClick={() => void run(() => activate({ upgradeId: upgrade.upgrade._id }))}>Activate atomically</Button> : null}{upgrade.upgrade.status !== 'activated' ? <Button onClick={() => void run(() => cancel({ upgradeId: upgrade.upgrade._id }))} variant="outline">Cancel draft</Button> : null}</div> : null}
    {(pending ?? []).map((item) => item.upgrade && item.project ? <div className="company-admin-card" key={item.confirmation._id}><strong>Confirm {item.project.name}</strong><p>Select at least one manager from your Company; this confirms identity and roles for your people.</p>{item.ownMappings.map(({ mapping, user }) => <label key={mapping._id}><input checked={managerSelections[item.upgrade!._id]?.has(mapping.legacyProjectMemberId) ?? false} onChange={(event) => setManagerSelections((current) => {
          const next = new Set(current[item.upgrade!._id] ?? [])
          if (event.target.checked) next.add(mapping.legacyProjectMemberId)
          else next.delete(mapping.legacyProjectMemberId)
          return { ...current, [item.upgrade!._id]: next }
        })} type="checkbox" /> {user?.displayName ?? 'Unknown member'} as manager</label>)}<Button onClick={() => void run(() => confirmCompany({ actingCompanyId, managerProjectMemberIds: Array.from(managerSelections[item.upgrade!._id] ?? []) as Array<Id<'projectMembers'>>, upgradeId: item.upgrade!._id }))}>Confirm Company mapping</Button></div> : null)}
  </section>
}
