import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { AlertTriangle, ArrowUpRight, Building2, CheckCircle2, FolderKanban, Handshake, LifeBuoy, Mail, ShieldCheck, UserRound, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { api } from '../../../../convex/_generated/api'
import { Button } from '#/components/ui/button'
import { ConfirmDialog } from '#/components/ui/confirm-dialog'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { CompanyProfileForm, InviteMemberForm } from '#/features/company/CompanyForms'
import { CompanyProjectNavigation } from '#/features/company/CompanyProjectNavigation'
import { useActingCompany } from '#/features/company/use-acting-company'
import { resolveReleaseConfig, useReleaseConfigProjection } from '#/lib/release-config'

import '#/features/company/company-settings.css'

export const Route = createFileRoute('/workspace/company/settings')({ component: CompanySettingsPage })

function CompanySettingsShell({
  actingCompanyId,
  children,
  tasksEnabled,
}: {
  actingCompanyId: NonNullable<ReturnType<typeof useActingCompany>['actingCompanyId']> | null
  children: ReactNode
  tasksEnabled: boolean
}) {
  return (
    <main className="company-hub-shell company-unified-shell">
      <CompanyProjectNavigation
        activeArea="company"
        actingCompanyId={actingCompanyId}
        companyNavigation={
          <nav aria-label="Company workspace">
            <span className="company-project-nav-label">Workspace</span>
            <Link className="company-project-nav-item" to="/workspace/company" search={{ view: 'overview', taskFilter: undefined }}>
              <Building2 aria-hidden="true" size={14} />
              Overview
            </Link>
            <Link className="company-project-nav-item" to="/workspace/company" search={{ view: 'projects', taskFilter: undefined }}>
              <FolderKanban aria-hidden="true" size={14} />
              Projects
            </Link>
            <Link className="company-project-nav-item" to="/workspace/company" search={{ view: 'relationships', taskFilter: undefined }}>
              <Handshake aria-hidden="true" size={14} />
              Relationships
            </Link>
            <Link className="company-project-nav-item" to="/workspace/company" search={{ view: 'people', taskFilter: undefined }}>
              <Users aria-hidden="true" size={14} />
              People
            </Link>
            <Link aria-current="page" className="company-project-nav-item active" to="/workspace/company/settings">
              <ShieldCheck aria-hidden="true" size={14} />
              Settings
            </Link>
          </nav>
        }
        tasksEnabled={tasksEnabled}
      />
      <section className="company-settings-page">{children}</section>
    </main>
  )
}

function CompanySettingsPage() {
  const releaseConfigProjection = useReleaseConfigProjection()
  const releaseConfig = resolveReleaseConfig(releaseConfigProjection)
  const companies = useQuery(api.companies.listMine, releaseConfig.companyModel ? {} : 'skip')
  const availableCompanyIds = useMemo(
    () => (companies ?? []).flatMap((item) => item.company && item.company.status !== 'closed' ? [item.company._id] : []),
    [companies],
  )
  const { actingCompanyId } = useActingCompany(availableCompanyIds)
  const actingCompany = companies?.find((item) => item.company?._id === actingCompanyId)
  const administration = useQuery(
    api.companies.getAdministration,
    actingCompanyId && actingCompany && actingCompany.membership.role !== 'member'
      ? { companyId: actingCompanyId }
      : 'skip',
  )
  const relationships = useQuery(
    api.relationships.listMine,
    actingCompanyId && actingCompany && actingCompany.membership.role !== 'member'
      ? { actingCompanyId }
      : 'skip',
  )
  const updateMember = useMutation(api.companies.updateMember)
  const revokeInvitation = useMutation(api.companies.revokeInvitation)
  const setSuspended = useMutation(api.companies.setSuspended)
  const closeCompany = useMutation(api.companies.close)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)

  async function run(action: () => Promise<unknown>, success = 'Changes saved.') {
    setNotice(null)
    setBusyAction('saving')
    try {
      await action()
      setNotice(success)
      return true
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replaceAll('_', ' ') : 'The action failed. Try again.')
      return false
    } finally {
      setBusyAction(null)
    }
  }

  if (releaseConfigProjection === undefined) return <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Checking your company role.</p></section></CompanySettingsShell>
  if (!releaseConfig.companyModel) return <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}><section className="track-guided-empty"><h1>Company settings unavailable</h1><p>Company collaboration is disabled for this environment.</p><Link to="/workspace">Back to workspace</Link></section></CompanySettingsShell>
  if (companies === undefined) return <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Checking your company role.</p></section></CompanySettingsShell>
  if (!actingCompany || actingCompany.membership.role === 'member') return <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}><section className="track-guided-empty"><h1>Company settings unavailable</h1><p>Company settings are available to company owners and admins.</p><Link search={{ view: 'overview', taskFilter: undefined }} to="/workspace/company">Back to companies</Link></section></CompanySettingsShell>
  if (!actingCompanyId || administration === undefined) return <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Loading company administration data.</p></section></CompanySettingsShell>

  const isOwner = administration.membership.role === 'owner'
  const activeMembers = administration.members.filter(({ membership }) => membership.status === 'active')
  const suspendedMembers = administration.members.filter(({ membership }) => membership.status === 'suspended')
  const companyStatus = administration.company.status

  return (
    <CompanySettingsShell actingCompanyId={actingCompanyId} tasksEnabled={releaseConfig.tasks}>
      <header className="company-settings-header">
        <div>
          <span className="company-settings-kicker">{administration.company.displayName}</span>
          <h1>Company settings</h1>
          <p>Keep company identity, membership, relationships, and access boundaries in one calm administration surface.</p>
        </div>
        <div className="company-settings-header-actions">
          <span className={`company-settings-status ${companyStatus}`}><i aria-hidden="true" />{companyStatus}</span>
          <Link className="company-settings-back" search={{ view: 'overview', taskFilter: undefined }} to="/workspace/company">Back to companies</Link>
        </div>
      </header>
      {notice ? <p aria-live="polite" className="company-settings-notice"><CheckCircle2 aria-hidden="true" size={15} />{notice}</p> : null}
      <section aria-label="Company settings summary" className="company-settings-summary">
        <div><Building2 aria-hidden="true" size={16} /><span>Company<strong>@{administration.company.normalizedHandle}</strong></span></div>
        <div><Users aria-hidden="true" size={16} /><span>Active people<strong>{activeMembers.length}</strong></span></div>
        <div><Handshake aria-hidden="true" size={16} /><span>Relationships<strong>{relationships?.length ?? '—'}</strong></span></div>
        <div><Mail aria-hidden="true" size={16} /><span>Invitations<strong>{administration.invitations.length}</strong></span></div>
      </section>
      <div className="company-settings-layout">
        <nav aria-label="Company settings" className="company-settings-nav">
          <a href="#company-details"><Building2 aria-hidden="true" size={15} />Company details</a>
          <a href="#company-members"><Users aria-hidden="true" size={15} />Members</a>
          <a href="#company-roles"><ShieldCheck aria-hidden="true" size={15} />Roles & access</a>
          <a href="#company-invitations"><Mail aria-hidden="true" size={15} />Invitations</a>
          <a href="#company-relationships"><Handshake aria-hidden="true" size={15} />Relationships</a>
          <a href="#company-recovery"><LifeBuoy aria-hidden="true" size={15} />Recovery</a>
          <a className="danger" href="#company-danger"><AlertTriangle aria-hidden="true" size={15} />Danger zone</a>
        </nav>
        <div className="company-settings-content">
          <section className="company-settings-card" id="company-details">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Identity</span><h2>Company details</h2><p>Update the identity people see across projects, invitations, and relationship requests.</p></div><Building2 aria-hidden="true" size={17} /></div>
            <CompanyProfileForm actingCompanyId={actingCompanyId} description={administration.company.description} displayName={administration.company.displayName} handle={administration.company.normalizedHandle} key={actingCompanyId} run={run} />
          </section>

          <section className="company-settings-card" id="company-members">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Membership</span><h2>People and membership</h2><p>Company membership is separate from Project membership. Change a person’s role or pause their Company access here.</p></div><Users aria-hidden="true" size={17} /></div>
            <div className="company-settings-list" aria-label="Company members">
              {administration.members.map(({ membership, user }) => {
                const isTargetOwner = membership.role === 'owner'
                const canEdit = !isTargetOwner || isOwner
                return (
                  <div className="company-settings-list-row" key={membership._id}>
                    <span className="company-settings-avatar"><UserRound aria-hidden="true" size={15} /></span>
                    <span className="company-settings-list-copy"><strong>{user?.displayName ?? membership.userDisplayNameSnapshot ?? 'Unnamed member'}</strong><small>{user?.email ?? 'No email'} · {membership.status}</small></span>
                    <NativeSelect aria-label={`Role for ${user?.displayName ?? 'member'}`} disabled={!canEdit || busyAction !== null} onChange={(event) => void run(() => updateMember({ companyId: actingCompanyId, companyMemberId: membership._id, role: event.target.value as 'owner' | 'admin' | 'member' }), 'Member role updated.')} value={membership.role}>
                      <NativeSelectOption value="owner">Owner</NativeSelectOption><NativeSelectOption value="admin">Admin</NativeSelectOption><NativeSelectOption value="member">Member</NativeSelectOption>
                    </NativeSelect>
                    {membership.userId !== administration.membership.userId && membership.status !== 'removed' ? <Button disabled={!canEdit || busyAction !== null} onClick={() => void run(() => updateMember({ companyId: actingCompanyId, companyMemberId: membership._id, status: membership.status === 'active' ? 'suspended' : 'active' }), membership.status === 'active' ? 'Member suspended.' : 'Member reactivated.')} type="button" variant="outline">{membership.status === 'active' ? 'Suspend' : 'Reactivate'}</Button> : null}
                  </div>
                )
              })}
              {administration.members.length === 0 ? <p className="company-settings-empty">No members are attached to this Company.</p> : null}
            </div>
            <div className="company-settings-inline-summary"><span>Active</span><strong>{activeMembers.length}</strong><span>Suspended</span><strong>{suspendedMembers.length}</strong></div>
          </section>

          <section className="company-settings-card" id="company-roles">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Access model</span><h2>Roles and boundaries</h2><p>Company roles govern membership and relationships. Project and Channel permissions still require explicit participation.</p></div><ShieldCheck aria-hidden="true" size={17} /></div>
            <div className="company-settings-role-grid"><div><strong>Owner</strong><span>Can change ownership, suspend, close, and manage all Company administration.</span></div><div><strong>Admin</strong><span>Can manage people, invitations, and relationship operations.</span></div><div><strong>Member</strong><span>Can participate where the Company grants Project or Channel access.</span></div></div>
          </section>

          <section className="company-settings-card" id="company-invitations">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Inbound access</span><h2>Invitations</h2><p>Invitations remain inactive until the recipient accepts them.</p></div><Mail aria-hidden="true" size={17} /></div>
            <div className="company-settings-invite-form"><InviteMemberForm actingCompanyId={actingCompanyId} run={run} /></div>
            <div className="company-settings-list" aria-label="Pending company invitations">
              {administration.invitations.map((invitation) => <div className="company-settings-list-row" key={invitation._id}><span className="company-settings-avatar"><Mail aria-hidden="true" size={15} /></span><span className="company-settings-list-copy"><strong>{invitation.normalizedEmail}</strong><small>Invited as {invitation.role} · expires {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(invitation.expiresAt)}</small></span><Button disabled={busyAction !== null} onClick={() => void run(() => revokeInvitation({ companyId: actingCompanyId, invitationId: invitation._id }), 'Invitation revoked.')} type="button" variant="outline">Revoke</Button></div>)}
              {administration.invitations.length === 0 ? <p className="company-settings-empty">No pending invitations.</p> : null}
            </div>
          </section>

          <section className="company-settings-card" id="company-relationships">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Collaboration</span><h2>Relationships</h2><p>A relationship permits a Company invitation. Project and Channel access still require explicit grants.</p></div><Handshake aria-hidden="true" size={17} /></div>
            <div className="company-settings-relationship-list">
              {(relationships ?? []).slice(0, 4).map(({ relationship, participants }) => <div className="company-settings-relationship-row" key={relationship._id}><span><strong>{relationship.name}</strong><small>{participants.map((company) => company.displayName).join(' · ') || 'Company relationship'}</small></span><span className={`company-settings-pill ${relationship.status}`}>{relationship.status}</span></div>)}
              {relationships?.length === 0 ? <p className="company-settings-empty">No relationships yet.</p> : null}
            </div>
            <Link className="company-settings-secondary-link" to="/workspace/company" search={{ view: 'relationships', taskFilter: undefined }}>Open relationship management <ArrowUpRight aria-hidden="true" size={13} /></Link>
          </section>

          <section className="company-settings-card" id="company-recovery">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Recovery</span><h2>Archive and recovery boundaries</h2><p>Project and Channel archive requests use Company approval. Shared Project exits create a verified snapshot before access changes.</p></div><LifeBuoy aria-hidden="true" size={17} /></div>
            <div className="company-settings-recovery-callout"><ShieldCheck aria-hidden="true" size={16} /><span><strong>Evidence stays recoverable</strong><small>Open a Project’s participation controls to review pending archive approvals, snapshot progress, retry actions, and safe cancellation.</small></span><Link to="/workspace/company" search={{ view: 'overview', taskFilter: undefined }}>Open Project recovery <ArrowUpRight aria-hidden="true" size={13} /></Link></div>
          </section>

          <section className="company-settings-card company-settings-danger" id="company-danger">
            <div className="company-settings-card-heading"><div><span className="company-settings-eyebrow">Owner only</span><h2>Danger zone</h2><p>Suspending pauses Company access. Closing is irreversible after active Projects, Relationships, and invitations are resolved.</p></div><AlertTriangle aria-hidden="true" size={17} /></div>
            <div className="company-settings-danger-actions">
              {isOwner ? <Button disabled={busyAction !== null} onClick={() => void run(() => setSuspended({ companyId: actingCompanyId, suspended: companyStatus !== 'suspended' }), companyStatus === 'suspended' ? 'Company reactivated.' : 'Company suspended.')} type="button" variant="outline">{companyStatus === 'suspended' ? 'Reactivate Company' : 'Suspend Company'}</Button> : <span>Only the Company owner can suspend or reactivate this Company.</span>}
              {isOwner && companyStatus !== 'closed' ? <Button disabled={busyAction !== null} onClick={() => setCloseOpen(true)} type="button" variant="destructive">Close Company</Button> : null}
            </div>
          </section>
        </div>
        <ConfirmDialog
          confirmLabel="Close Company"
          description={`Closing ${administration.company.displayName} is irreversible after its active Projects, Relationships, and invitations are resolved.`}
          onConfirm={() => run(() => closeCompany({ companyId: actingCompanyId, retentionConfirmed: true }), 'Company closed.')}
          onOpenChange={setCloseOpen}
          open={closeOpen}
          title={`Close ${administration.company.displayName}?`}
        />
      </div>
    </CompanySettingsShell>
  )
}
