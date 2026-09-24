import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { AlertTriangle, CheckCircle2, CircleDot, Clock3, FolderKanban, UsersRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { getCompanyProjectManagementSearch } from './company-project-links'

type Overview = FunctionReturnType<typeof api.companyOverview.get>
type ProjectSummary = NonNullable<Overview>['projects'][number]
type AsyncAction = (action: () => Promise<unknown>) => Promise<void | boolean>

export type OverviewProjectDialogTarget = {
  membershipId: Id<'projectMembers'>
  project: ProjectSummary
}

type Props = {
  activeCompanyId: Id<'companies'>
  activityProject: OverviewProjectDialogTarget | null
  onActivityOpenChange: (open: boolean) => void
  onSettingsOpenChange: (open: boolean) => void
  run: AsyncAction
  settingsProject: OverviewProjectDialogTarget | null
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(timestamp))
}

export function CompanyOverviewProjectDialogs({
  activeCompanyId,
  activityProject,
  onActivityOpenChange,
  onSettingsOpenChange,
  run,
  settingsProject,
}: Props) {
  const activeTarget = activityProject ?? settingsProject
  const projectData = useQuery(api.companyOverview.getProject, activeTarget ? {
    actingCompanyId: activeCompanyId,
    days: 30,
    projectId: activeTarget.project.id,
    projectMemberId: activeTarget.membershipId,
  } : 'skip')
  const settingsData = useQuery(api.sharedProjects.getOverview, settingsProject ? {
    actingCompanyId: activeCompanyId,
    projectId: settingsProject.project.id,
    projectMemberId: settingsProject.membershipId,
  } : 'skip')
  const updateDetails = useMutation(api.sharedProjects.updateDetails)
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!settingsData) return
    setName(settingsData.project.name)
    setLabel(settingsData.project.clientLabel ?? '')
    setDescription(settingsData.project.description ?? '')
    setSaved(false)
  }, [settingsData])

  async function saveSettings() {
    if (!settingsProject || !projectData?.permissions.canManageProject || !name.trim()) return
    const result = await run(() => updateDetails({
      actingCompanyId: activeCompanyId,
      description,
      label,
      name,
      projectId: settingsProject.project.id,
      projectMemberId: settingsProject.membershipId,
    }))
    if (result !== false) setSaved(true)
  }

  const stats = projectData?.stats
  const settingsContext = settingsProject ? {
    actingCompanyId: activeCompanyId,
    projectId: settingsProject.project.id,
    projectMemberId: settingsProject.membershipId,
  } : null

  return <>
    <Dialog onOpenChange={onActivityOpenChange} open={Boolean(activityProject)}>
      <DialogContent className="company-project-insight-dialog">
        <DialogHeader>
          <DialogTitle>{activityProject?.project.name ?? 'Project'} performance</DialogTitle>
          <DialogDescription>Current delivery health, workload, attention items, and recent movement for this project.</DialogDescription>
        </DialogHeader>
        {!projectData ? <div aria-label="Loading project performance" className="company-project-dialog-loading" role="status" /> : <div className="company-project-insight-body">
          <section aria-label="Project performance summary" className="company-project-insight-stats">
            {[
              ['Completion', `${stats?.completion ?? 0}%`, <CheckCircle2 aria-hidden="true" key="completion" />],
              ['Open tasks', String(stats?.open ?? 0), <CircleDot aria-hidden="true" key="open" />],
              ['Overdue', String(stats?.overdue ?? 0), <AlertTriangle aria-hidden="true" key="overdue" />],
              ['Due this week', String(stats?.dueThisWeek ?? 0), <Clock3 aria-hidden="true" key="due" />],
            ].map(([labelText, value, icon]) => <article key={String(labelText)}>{icon}<span><strong>{value}</strong><small>{labelText}</small></span></article>)}
          </section>
          <section className="company-project-performance-chart">
            <div><h3>30-day task movement</h3><p>Created work compared with completed work.</p></div>
            <div aria-label="Project task movement over 30 days" className="company-project-performance-chart-canvas" role="img">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart accessibilityLayer data={projectData.trend} margin={{ bottom: 0, left: -28, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--company-ref-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis axisLine={false} dataKey="date" minTickGap={24} tick={{ fill: 'var(--company-ref-muted)', fontSize: 10 }} tickFormatter={(value) => String(value).slice(5)} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tick={{ fill: 'var(--company-ref-muted)', fontSize: 10 }} tickLine={false} />
                  <Tooltip contentStyle={{ border: '1px solid var(--company-ref-border-strong)', borderRadius: 8, fontSize: 11 }} />
                  <Line dataKey="created" dot={false} isAnimationActive={false} name="Created" stroke="#f2b51d" strokeWidth={2} type="monotone" />
                  <Line dataKey="completed" dot={false} isAnimationActive={false} name="Completed" stroke="#10b981" strokeWidth={2} type="monotone" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <div className="company-project-insight-columns">
            <section><h3>Delivery details</h3><dl><div><dt>Total tasks</dt><dd>{stats?.total ?? 0}</dd></div><div><dt>Completed</dt><dd>{stats?.completed ?? 0}</dd></div><div><dt>Blocked</dt><dd>{stats?.blocked ?? 0}</dd></div><div><dt>Active people</dt><dd>{projectData.memberCount}</dd></div></dl></section>
            <section><h3>Needs attention</h3>{projectData.attention.length ? <ul>{projectData.attention.slice(0, 4).map((task) => <li key={task.id}><span><strong>{task.title}</strong><small>{task.reason}</small></span><em>{task.status}</em></li>)}</ul> : <div className="company-project-dialog-empty"><CheckCircle2 aria-hidden="true" />No immediate attention needed</div>}</section>
          </div>
        </div>}
      </DialogContent>
    </Dialog>

    <Dialog onOpenChange={onSettingsOpenChange} open={Boolean(settingsProject)}>
      <DialogContent className="company-project-settings-dialog">
        <DialogHeader>
          <DialogTitle>{settingsProject?.project.name ?? 'Project'} settings</DialogTitle>
          <DialogDescription>Review project identity, access, people, participating companies, and lifecycle settings.</DialogDescription>
        </DialogHeader>
        {!settingsData || !projectData ? <div aria-label="Loading project settings" className="company-project-dialog-loading" role="status" /> : <div className="company-project-settings-body">
          <section className="company-project-settings-section">
            <div className="company-project-settings-heading"><FolderKanban aria-hidden="true" /><span><h3>General</h3><p>The project identity shown across Track.</p></span></div>
            <div className="company-project-settings-fields">
              <label><span>Project name</span><Input disabled={!projectData.permissions.canManageProject} maxLength={120} onChange={(event) => { setName(event.target.value); setSaved(false) }} value={name} /></label>
              <label><span>Client label</span><Input disabled={!projectData.permissions.canManageProject} maxLength={80} onChange={(event) => { setLabel(event.target.value); setSaved(false) }} placeholder="Optional internal label" value={label} /></label>
              <label className="wide"><span>Description</span><Textarea disabled={!projectData.permissions.canManageProject} maxLength={2000} onChange={(event) => { setDescription(event.target.value); setSaved(false) }} placeholder="Describe this project" value={description} /></label>
            </div>
          </section>
          <section className="company-project-settings-section">
            <div className="company-project-settings-heading"><UsersRound aria-hidden="true" /><span><h3>Access and people</h3><p>Project membership stays separate from Channel access.</p></span></div>
            <dl className="company-project-settings-facts"><div><dt>Your access</dt><dd>{projectData.permissions.canManageProject ? 'Project manager' : projectData.permissions.canWriteProject ? 'Project member' : 'Read only'}</dd></div><div><dt>Active members</dt><dd>{settingsData.memberCount}{settingsData.memberCountTruncated ? '+' : ''}</dd></div><div><dt>Managers</dt><dd>{settingsData.managers.map((manager) => manager.displayName).join(', ') || 'None assigned'}</dd></div><div><dt>Participating companies</dt><dd>{settingsData.companies.map((company) => company.displayName).join(', ') || 'No company participants'}</dd></div></dl>
          </section>
          <section className="company-project-settings-section">
            <div className="company-project-settings-heading"><CircleDot aria-hidden="true" /><span><h3>Lifecycle</h3><p>Ownership and archive actions use the project approval workflow.</p></span></div>
            <dl className="company-project-settings-facts"><div><dt>Status</dt><dd>{settingsData.project.status ?? 'active'}</dd></div><div><dt>Origin</dt><dd>{settingsData.project.origin?.replaceAll('_', ' ') ?? 'Legacy project'}</dd></div><div><dt>Created</dt><dd>{formatDate(settingsData.project.createdAt)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(settingsData.project.updatedAt)}</dd></div></dl>
          </section>
          {!projectData.permissions.canManageProject ? <p className="company-project-settings-note">You can review these settings, but only a project manager can change project details.</p> : null}
          <footer className="company-project-settings-actions">
            {settingsContext ? <Link params={{ projectId: settingsContext.projectId }} search={getCompanyProjectManagementSearch(settingsContext)} to="/workspace/company-projects/$projectId">Open advanced settings</Link> : null}
            {saved ? <span role="status">Changes saved</span> : null}
            <Button onClick={() => onSettingsOpenChange(false)} type="button" variant="outline">Close</Button>
            {projectData.permissions.canManageProject ? <Button disabled={!name.trim()} onClick={() => void saveSettings()} type="button">Save changes</Button> : null}
          </footer>
        </div>}
      </DialogContent>
    </Dialog>
  </>
}
