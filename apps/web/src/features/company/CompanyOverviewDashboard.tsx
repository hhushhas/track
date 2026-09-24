import { Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CheckSquare2, CircleAlert, Clipboard, FolderKanban, Handshake, Mail, MoreHorizontal, Plus, UsersRound } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'

import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { InternalProjectForm, InviteMemberForm, RelationshipForm } from './CompanyForms'
import { getCompanyProjectOverviewSearch } from './company-project-links'
import { CompanyOverviewProjectDialogs } from './CompanyOverviewProjectDialogs'
import type { OverviewProjectDialogTarget } from './CompanyOverviewProjectDialogs'

type Overview = FunctionReturnType<typeof api.companyOverview.get>
type ProjectDirectory = FunctionReturnType<typeof api.sharedProjects.listForActingCompany>
type AsyncAction = (action: () => Promise<unknown>) => Promise<void | boolean>

type Props = {
  activeCompanyId: Id<'companies'>
  companyName: string
  createProjectRequest: number
  currentUserId: Id<'users'>
  userName: string
  isAdmin: boolean
  overview: Overview | undefined
  projects: ProjectDirectory | undefined
  onCreateProjectRequestHandled: () => void
  run: AsyncAction
}

type QuickAction = 'project' | 'invite' | 'partner' | 'task'
type StatTrend = NonNullable<Overview>['stats']['trends'][number]

function relativeTime(timestamp: number) {
  const elapsed = Math.max(0, Date.now() - timestamp)
  const hours = Math.floor(elapsed / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${value}T00:00:00Z`))
}

function chartDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
}

function StatSparkline({ color, data, dataKey, label }: {
  color: string
  data: StatTrend[]
  dataKey: 'openTasks' | 'overdueTasks' | 'completedThisWeek' | 'activePeople'
  label: string
}) {
  const first = data[0]?.[dataKey] ?? 0
  const last = data.at(-1)?.[dataKey] ?? 0
  const direction = last === first ? 'unchanged' : last > first ? 'increased' : 'decreased'
  return <div aria-label={`${label} trend: ${direction} from ${first} to ${last}`} className="company-dashboard-stat-chart" role="img">
    <ResponsiveContainer height="100%" width="100%">
      <LineChart accessibilityLayer data={data} margin={{ bottom: 2, left: 2, right: 2, top: 4 }}>
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, padding: '6px 8px' }} cursor={false} formatter={(value) => [value, label]} labelFormatter={(value) => chartDateLabel(String(value))} />
        <Line activeDot={{ r: 3 }} dataKey={dataKey} dot={false} isAnimationActive={false} stroke={color} strokeWidth={2} type="monotone" />
      </LineChart>
    </ResponsiveContainer>
  </div>
}

export function CompanyOverviewDashboard({ activeCompanyId, companyName, createProjectRequest, currentUserId, userName, isAdmin, onCreateProjectRequestHandled, onCreateTaskRequest, overview, projects, run }: Props & { onCreateTaskRequest?: () => void }) {
  const [menu, setMenu] = useState<string | null>(null)
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null)
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(7)
  const [chartProjectId, setChartProjectId] = useState<Id<'projects'> | ''>('')
  const [activityProject, setActivityProject] = useState<OverviewProjectDialogTarget | null>(null)
  const [settingsProject, setSettingsProject] = useState<OverviewProjectDialogTarget | null>(null)
  const [hoveredChartDate, setHoveredChartDate] = useState<string | null>(null)
  const chartScrollRef = useRef<HTMLDivElement>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const keyboardChartNavigation = useRef(false)
  const uniqueProjects = useMemo(() => Array.from(new Map((projects ?? []).map((row) => [row.project._id, row])).values()), [projects])
  const overviewProjects = useMemo(() => Array.from(new Map((overview?.projects ?? []).map((project) => [project.id, project])).values()), [overview?.projects])
  useEffect(() => {
    if (!menu) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null) }
    const closeOnOutsidePointer = (event: PointerEvent) => { if (event.target instanceof Node && !dashboardRef.current?.contains(event.target)) setMenu(null) }
    window.addEventListener('keydown', close)
    window.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => { window.removeEventListener('keydown', close); window.removeEventListener('pointerdown', closeOnOutsidePointer) }
  }, [menu])

  useEffect(() => {
    if (createProjectRequest <= 0) return
    setQuickAction('project')
    onCreateProjectRequestHandled()
  }, [createProjectRequest, onCreateProjectRequestHandled])

  useEffect(() => {
    if (!hoveredChartDate || !keyboardChartNavigation.current) return
    chartScrollRef.current?.querySelector<HTMLElement>(`[data-chart-date="${hoveredChartDate}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [hoveredChartDate])

  const projectSources = useMemo(() => new Map(uniqueProjects.map((row) => [row.project._id, row])), [uniqueProjects])
  const shouldUseInitialOverview = rangeDays === 7 && chartProjectId === ''
  const rangedOverview = useQuery(api.companyOverview.get, shouldUseInitialOverview ? 'skip' : { companyId: activeCompanyId, days: rangeDays, projectId: chartProjectId || undefined })
  const trend = (shouldUseInitialOverview ? overview?.activityTrend : rangedOverview?.activityTrend) ?? []
  const maxTrend = Math.max(1, ...trend.flatMap((point) => [point.created, point.completed]))
  const workload = overview?.workload ?? []
  const maxWorkload = Math.max(1, ...workload.map((owner) => owner.open))

  function openQuickAction(action: QuickAction) { setMenu(null); if (action === 'task') { onCreateTaskRequest?.(); return } setQuickAction(action) }
  function closeQuickAction() { setQuickAction(null) }

  function activityHref(activity: NonNullable<Overview>['recentActivity'][number]) {
    const source = projectSources.get(activity.projectId)
    if (!source) return null
    const projectId = encodeURIComponent(String(activity.projectId))
    const membershipId = encodeURIComponent(String(source.membership._id))
    const companyId = encodeURIComponent(String(activeCompanyId))
    if (activity.kind === 'task' && activity.taskKey) return `/workspace/projects/${projectId}/tasks?actingCompanyId=${companyId}&groupId=&projectMemberId=${membershipId}&view=all&task=${encodeURIComponent(activity.taskKey)}`
    if (activity.kind === 'message' && activity.groupId && activity.threadId) return `/workspace/projects/${projectId}/groups/${encodeURIComponent(String(activity.groupId))}/threads/${encodeURIComponent(String(activity.threadId))}?companyId=${companyId}&membershipId=${membershipId}`
    const groupId = activity.kind === 'message' && activity.groupId ? encodeURIComponent(String(activity.groupId)) : ''
    return `/workspace/company-projects/${projectId}?companyId=${companyId}&groupId=${groupId}&membershipId=${membershipId}&view=${activity.kind === 'message' ? 'channels' : 'overview'}`
  }

  function copyActivityLink(activity: NonNullable<Overview>['recentActivity'][number]) {
    const href = activityHref(activity)
    if (href) void navigator.clipboard?.writeText(`${window.location.origin}${href}`)
    setMenu(null)
  }

  return <div aria-busy={!overview} className="company-overview-live" ref={dashboardRef}>
    <section className="company-dashboard-welcome">
      <div><span className="company-dashboard-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</span><h2>Good morning, {userName.split(/\s+/)[0] || 'there'}</h2><p>Here&apos;s what&apos;s happening across {companyName}.</p></div>
      <blockquote>{overview?.quote ? `“${overview.quote}”` : ''}<span /></blockquote>
    </section>

    <section aria-label="Company task summary" className="company-dashboard-stat-grid">
      {[
        { label: 'Open tasks', value: overview?.stats?.openTasks, tone: 'amber', context: 'Company total', color: '#f6b51a', dataKey: 'openTasks' as const, icon: <Mail aria-hidden="true" /> },
        { label: 'Overdue tasks', value: overview?.stats?.overdueTasks, tone: 'red', context: 'Needs attention', color: '#f05b63', dataKey: 'overdueTasks' as const, icon: <CircleAlert aria-hidden="true" /> },
        { label: 'Completed this week', value: overview?.stats?.completedThisWeek, tone: 'green', context: 'Current week', color: '#2dbf8b', dataKey: 'completedThisWeek' as const, icon: <CheckCircle2 aria-hidden="true" /> },
        { label: 'Active people', value: overview?.stats?.activePeople, tone: 'blue', context: 'Active assignments', color: '#5b8def', dataKey: 'activePeople' as const, icon: <UsersRound aria-hidden="true" /> },
      ].map((stat) => <article className={`company-dashboard-stat ${stat.tone}`} key={stat.label}><span className="company-dashboard-stat-icon">{stat.icon}</span><div><strong>{stat.value ?? '—'}</strong><span>{stat.label}</span></div><small>{stat.context}</small><StatSparkline color={stat.color} data={overview?.stats?.trends ?? []} dataKey={stat.dataKey} label={stat.label} /></article>)}
    </section>

    <div className="company-dashboard-grid">
      <section className="company-dashboard-panel company-dashboard-progress"><div className="company-dashboard-panel-heading"><div><h2>Project progress</h2><p>Completion across all company projects</p></div></div><div className="company-dashboard-project-list">{!overview ? <div aria-label="Loading projects" className="company-dashboard-skeleton" role="status" /> : overviewProjects.length === 0 ? <div className="company-quiet-empty"><FolderKanban aria-hidden="true" size={18} /><strong>No projects yet</strong></div> : overviewProjects.slice(0, 4).map((project, index) => {
        const source = projectSources.get(project.id)
        const projectMenu = `project-${project.id}`
        const content = <><span className={`company-dashboard-project-icon tone-${(index % 3) + 1}`}><FolderKanban aria-hidden="true" size={20} /></span><div className="company-dashboard-project-copy"><strong>{project.name}</strong><span>{project.completedTasks}/{project.totalTasks} tasks done · {project.description ?? 'No project description'}</span><div className="company-dashboard-progress-track"><i style={{ width: `${project.progress}%` }} /></div></div><span className={`company-dashboard-health ${project.health.toLowerCase().replace(' ', '-')}`}>{project.health}</span><strong className="company-dashboard-percent">{project.progress}%</strong></>
        return <div className="company-dashboard-project-row-shell" key={project.id}>{source ? <Link aria-label={`Open ${project.name} project overview`} className="company-dashboard-project-row company-dashboard-project-link" params={{ projectId: project.id }} search={getCompanyProjectOverviewSearch({ actingCompanyId: activeCompanyId, projectId: project.id, projectMemberId: source.membership._id })} to="/workspace/company-projects/$projectId">{content}</Link> : <div className="company-dashboard-project-row">{content}</div>}<button aria-expanded={menu === projectMenu} aria-haspopup="menu" aria-label={`Open actions for ${project.name}`} className="company-dashboard-more" onClick={() => setMenu(menu === projectMenu ? null : projectMenu)} type="button"><MoreHorizontal aria-hidden="true" size={18} /></button>{menu === projectMenu ? <div aria-label="Project actions" className="company-dashboard-menu" role="menu">{source ? <Link params={{ projectId: project.id }} search={getCompanyProjectOverviewSearch({ actingCompanyId: activeCompanyId, projectId: project.id, projectMemberId: source.membership._id })} to="/workspace/company-projects/$projectId">Open project overview</Link> : null}{source ? <button onClick={() => { setMenu(null); setActivityProject({ membershipId: source.membership._id, project }) }} type="button">View activity</button> : null}{source && (isAdmin || source.membership.role === 'manager') ? <button onClick={() => { setMenu(null); setSettingsProject({ membershipId: source.membership._id, project }) }} type="button">Project settings</button> : null}</div> : null}</div>
      })}</div></section>

      <section className="company-dashboard-panel company-dashboard-activity"><div className="company-dashboard-panel-heading"><div><h2>Recent activity</h2><p>Latest updates across your projects, tasks, and threads.</p></div></div><div className="company-dashboard-activity-list">{!overview ? <div aria-label="Loading activity" className="company-dashboard-skeleton" role="status" /> : overview.recentActivity.length === 0 ? <div className="company-quiet-empty"><strong>No recent activity yet</strong></div> : overview.recentActivity.map((activity, index) => {
        const activityMenu = `activity-${activity.id}`
        const href = activityHref(activity)
        const content = <><span className={`company-dashboard-avatar tone-${(index % 4) + 1}`}>{activity.actorInitials}</span><div><strong>{activity.preview}</strong><span>{activity.projectName} · {activity.action}</span></div><time>{relativeTime(activity.createdAt)}</time><small className={activity.kind}>{activity.kind === 'message' ? 'Comment' : activity.kind === 'task' ? 'Task' : 'Project'}</small></>
        return <div className="company-dashboard-activity-row-shell" key={activity.id}>{href ? <a aria-label={`Open activity: ${activity.preview}`} className="company-dashboard-activity-row company-dashboard-activity-link" href={href}>{content}</a> : <div className="company-dashboard-activity-row">{content}</div>}<button aria-expanded={menu === activityMenu} aria-haspopup="menu" aria-label={`Open actions for ${activity.preview}`} className="company-dashboard-more" onClick={() => setMenu(menu === activityMenu ? null : activityMenu)} type="button"><MoreHorizontal aria-hidden="true" size={18} /></button>{menu === activityMenu ? <div aria-label="Activity actions" className="company-dashboard-menu company-dashboard-menu-right" role="menu">{href ? <a href={href}>Open activity</a> : null}<button onClick={() => copyActivityLink(activity)} type="button"><Clipboard aria-hidden="true" size={14} /> Copy link</button></div> : null}</div>
      })}</div></section>
    </div>

    <div className="company-dashboard-bottom-grid company-dashboard-bottom-grid-live">
      <section aria-label="Workload by owner" className="company-dashboard-panel company-dashboard-workload-panel"><div className="company-dashboard-panel-heading"><div><h2>Workload by owner</h2><p>Open and overdue tasks across projects</p></div><UsersRound aria-hidden="true" size={18} /></div>{!overview ? <div aria-label="Loading workload" className="company-dashboard-skeleton" role="status" /> : workload.length === 0 ? <div className="company-quiet-empty"><strong>No assigned work yet</strong><span>Workload will appear when tasks are assigned.</span></div> : <ol className="company-dashboard-workload-list">{workload.map((owner) => <li key={owner.id}><span aria-hidden="true" className="company-dashboard-workload-avatar">{owner.initials}</span><div className="company-dashboard-workload-copy"><strong>{owner.name}</strong><span>{owner.open} open · {owner.completed} completed</span><div aria-hidden="true" className="company-dashboard-workload-track"><i style={{ width: `${(owner.open / maxWorkload) * 100}%` }} /></div></div><span className="company-dashboard-workload-meta"><strong>{owner.open}</strong><small>{owner.overdue ? `${owner.overdue} overdue` : 'On track'}</small></span></li>)}</ol>}</section>

      <section className="company-dashboard-panel company-dashboard-chart-panel"><div className="company-dashboard-panel-heading"><div><h2>Activity overview</h2><p>Task creation vs. completion across all projects</p></div><div className="company-dashboard-chart-filters"><NativeSelect aria-label="Activity range" id="overview-range" onChange={(event) => setRangeDays(Number(event.target.value) as 7 | 30 | 90)} value={String(rangeDays)}><NativeSelectOption value="7">Last 7 days</NativeSelectOption><NativeSelectOption value="30">Last 30 days</NativeSelectOption><NativeSelectOption value="90">Last 90 days</NativeSelectOption></NativeSelect><NativeSelect aria-label="Activity project" id="overview-project" onChange={(event) => setChartProjectId(event.target.value as Id<'projects'> | '')} value={chartProjectId}><NativeSelectOption value="">All projects</NativeSelectOption>{uniqueProjects.map((project) => <NativeSelectOption key={project.project._id} value={project.project._id}>{project.project.name}</NativeSelectOption>)}</NativeSelect></div></div><div className="company-dashboard-chart-scroll" ref={chartScrollRef}><div aria-label={`Task creation and completion by day${hoveredChartDate ? `; ${chartDateLabel(hoveredChartDate)} selected` : ''}`} className="company-dashboard-chart" data-range={rangeDays} onBlur={() => setHoveredChartDate(null)} onFocus={() => { keyboardChartNavigation.current = true; setHoveredChartDate((current) => current ?? trend.at(-1)?.date ?? null) }} onKeyDown={(event) => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); keyboardChartNavigation.current = true; const currentIndex = Math.max(0, trend.findIndex((point) => point.date === hoveredChartDate)); const nextIndex = Math.min(trend.length - 1, Math.max(0, currentIndex + (event.key === 'ArrowRight' ? 1 : -1))); setHoveredChartDate(trend[nextIndex]?.date ?? null) }} role="group" style={{ gridTemplateColumns: `repeat(${Math.max(trend.length, 1)}, minmax(0, 1fr))` }} tabIndex={0}><div className="company-dashboard-chart-grid" />{trend.map((point) => <div className="company-dashboard-chart-day" data-chart-date={point.date} key={point.date} onMouseEnter={() => { keyboardChartNavigation.current = false; setHoveredChartDate(point.date) }} onMouseLeave={() => setHoveredChartDate(null)}><div className="company-dashboard-bars"><i className="created" style={{ height: `${(point.created / maxTrend) * 100}%` }} /><i className="completed" style={{ height: `${(point.completed / maxTrend) * 100}%` }} /></div><span>{dayLabel(point.date)}</span>{hoveredChartDate === point.date ? <div className="company-dashboard-chart-tooltip" role="status"><strong>{chartDateLabel(point.date)}</strong><span><i className="created" />Created <b>{point.created}</b></span><span><i className="completed" />Completed <b>{point.completed}</b></span></div> : null}</div>)}</div></div><div className="company-dashboard-chart-legend"><span><i className="created" />Created</span><span><i className="completed" />Completed</span></div></section>

      <div className="company-dashboard-utility-column"><section className="company-dashboard-panel company-dashboard-partners"><div className="company-dashboard-panel-heading"><div><h2>Connected partners</h2><p>Active company relationships</p></div></div>{overview?.partners.length ? <ul>{overview.partners.map((partner) => <li key={partner.id}><span className="company-dashboard-partner-avatar">{partner.initials}</span><span><strong>{partner.name}</strong><small>{partner.relationshipName}</small></span><em>{partner.status}</em></li>)}</ul> : <div className="company-quiet-empty"><strong>No connected partners yet</strong>{isAdmin ? <button onClick={() => openQuickAction('partner')} type="button">Add partner</button> : null}</div>}</section>{isAdmin ? <section className="company-dashboard-panel company-dashboard-actions"><div className="company-dashboard-panel-heading"><div><h2>Quick actions</h2><p>Keep the team moving</p></div></div><div className="company-dashboard-action-grid"><button onClick={() => openQuickAction('project')} type="button"><Plus aria-hidden="true" size={20} /><span><strong>New project</strong><small>Start a new initiative</small></span></button><button onClick={() => openQuickAction('invite')} type="button"><UsersRound aria-hidden="true" size={20} /><span><strong>Invite people</strong><small>Add team members</small></span></button><button onClick={() => openQuickAction('partner')} type="button"><Handshake aria-hidden="true" size={20} /><span><strong>Add partner</strong><small>Connect a company</small></span></button>{onCreateTaskRequest ? <button onClick={() => openQuickAction('task')} type="button"><CheckSquare2 aria-hidden="true" size={20} /><span><strong>Create task</strong><small>Turn an idea into action</small></span></button> : null}</div></section> : null}</div>
    </div>

    <Dialog onOpenChange={(open) => { if (!open) closeQuickAction() }} open={quickAction === 'project' || quickAction === 'invite' || quickAction === 'partner'}><DialogContent className="company-dashboard-dialog"><DialogHeader><DialogTitle>{quickAction === 'project' ? 'New project' : quickAction === 'invite' ? 'Invite people' : 'Add partner'}</DialogTitle><DialogDescription>Save this change in the active company workspace.</DialogDescription></DialogHeader>{quickAction === 'project' ? <InternalProjectForm actingCompanyId={activeCompanyId} currentUserId={currentUserId} run={async (action) => { const result = await run(action); closeQuickAction(); return result }} /> : quickAction === 'invite' ? <InviteMemberForm actingCompanyId={activeCompanyId} run={async (action) => { const result = await run(action); closeQuickAction(); return result }} /> : <RelationshipForm actingCompanyId={activeCompanyId} run={async (action) => { const result = await run(action); closeQuickAction(); return result }} />}</DialogContent></Dialog>
    <CompanyOverviewProjectDialogs activeCompanyId={activeCompanyId} activityProject={activityProject} onActivityOpenChange={(open) => { if (!open) setActivityProject(null) }} onSettingsOpenChange={(open) => { if (!open) setSettingsProject(null) }} run={run} settingsProject={settingsProject} />
  </div>
}
