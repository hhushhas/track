import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { AlertTriangle, Building2, Handshake, Mail, ShieldCheck, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../../../../convex/_generated/api'
import { CompanyProfileForm } from '#/features/company/CompanyForms'
import { useActingCompany } from '#/features/company/use-acting-company'
import { resolveReleaseConfig, useReleaseConfigProjection } from '#/lib/release-config'

export const Route = createFileRoute('/workspace/company/settings')({ component: CompanySettingsPage })

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
  const [notice, setNotice] = useState<string | null>(null)

  async function run(action: () => Promise<unknown>) {
    setNotice(null)
    try {
      await action()
      setNotice('Company details saved.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message.replaceAll('_', ' ') : 'The action failed.')
    }
  }

  if (releaseConfigProjection === undefined) return <main className="company-settings-page"><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Checking your company role.</p></section></main>
  if (!releaseConfig.companyModel) return <main className="company-settings-page"><section className="track-guided-empty"><h1>Company settings unavailable</h1><p>Company collaboration is disabled for this environment.</p><Link to="/workspace">Back to workspace</Link></section></main>
  if (companies === undefined) return <main className="company-settings-page"><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Checking your company role.</p></section></main>
  if (!actingCompany || actingCompany.membership.role === 'member') return <main className="company-settings-page"><section className="track-guided-empty"><h1>Company settings unavailable</h1><p>Company settings are available to company owners and admins.</p><Link to="/workspace/company">Back to companies</Link></section></main>
  if (!actingCompanyId || administration === undefined) return <main className="company-settings-page"><section className="track-guided-empty" role="status"><h1>Loading company settings…</h1><p>Loading company administration data.</p></section></main>

  return <main className="company-settings-page">
    <header className="track-page-intro"><p className="mono-label">{administration.company.displayName}</p><h1>Company settings</h1><p>Manage company details, access, invitations, and relationships.</p><Link className="track-inline-action" to="/workspace/company">Back to companies</Link></header>
    {notice ? <p aria-live="polite" className="company-notice">{notice}</p> : null}
    <div className="company-settings-layout">
      <nav aria-label="Company settings"><a href="#company-details"><Building2 size={15} /> Company details</a><a href="#company-members"><Users size={15} /> Members</a><a href="#company-roles"><ShieldCheck size={15} /> Roles</a><a href="#company-invitations"><Mail size={15} /> Invitations</a><a href="#company-relationships"><Handshake size={15} /> Relationships</a><a className="danger" href="#company-danger"><AlertTriangle size={15} /> Danger zone</a></nav>
      <div className="company-settings-content">
        <section id="company-details">
          <h2>Company details</h2>
          <p>Update the identity people see across projects and invitations.</p>
          <CompanyProfileForm
            actingCompanyId={actingCompanyId}
            description={administration.company.description}
            displayName={administration.company.displayName}
            handle={administration.company.normalizedHandle}
            key={actingCompanyId}
            run={run}
          />
        </section>
        <section id="company-members"><h2>Members</h2><p>Invite people, review their status, and manage company membership.</p></section>
        <section id="company-roles"><h2>Roles</h2><p>Company Owner, Company Admin, and Company Member are the available company roles.</p></section>
        <section id="company-invitations"><h2>Invitations</h2><p>Pending invitations stay separate from active company members.</p></section>
        <section id="company-relationships"><h2>Relationships</h2><p>Review which companies can participate in shared projects.</p></section>
        <section className="track-danger-zone" id="company-danger"><h2>Danger zone</h2><p>Suspending or closing a company affects access. These actions remain on the company overview for current administrators.</p></section>
      </div>
    </div>
  </main>
}
