import { usePaginatedQuery, useQuery } from 'convex/react'
import {
  Archive, ArrowUpRight, Bot, CheckCircle2, ChevronRight, CircleAlert, Clock3,
  FileSearch, FileText, FolderLock, Import, Link2, MemoryStick,
  MessageSquareText, Search, ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { api } from '../../../../../../convex/_generated/api'
import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '#/components/ui/sheet'
import { setStoredActingCompanyId } from '#/features/company/use-acting-company'
import { ProjectMemoryImportDialog } from '#/features/workspace/components/ProjectMemoryImportDialog'
import { ProjectSearchDialog, type ProjectSearchFilter, type ProjectSearchResult } from '#/features/workspace/search/ProjectSearchDialog'
import {
  projectSearchDestinationCompanyId,
  projectSearchResultHref,
} from '#/features/workspace/search/project-search-navigation'
import { buildProjectSearchSections, getProjectSearchTotal } from '#/features/workspace/search/project-search-sections'
import { threadHref } from '#/features/threads/thread-navigation'
import { useReleaseConfig } from '#/lib/release-config'

type KnowledgeView = 'evidence' | 'memory'
type EvidenceFilter = 'all' | 'message' | 'attachment' | 'assistant_answer' | 'memory_excerpt'

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', hour: 'numeric', minute: '2-digit', month: 'short', year: 'numeric',
})
const evidenceFilters: Array<{ label: string; value: EvidenceFilter }> = [
  { label: 'All evidence', value: 'all' }, { label: 'Messages', value: 'message' },
  { label: 'Files', value: 'attachment' }, { label: 'Assistant', value: 'assistant_answer' },
  { label: 'Memory', value: 'memory_excerpt' },
]

function evidenceTypeLabel(type: EvidenceFilter) {
  if (type === 'assistant_answer') return 'Assistant response'
  if (type === 'memory_excerpt') return 'Memory excerpt'
  if (type === 'attachment') return 'File'
  if (type === 'message') return 'Message'
  return 'Evidence'
}

function EvidenceTypeIcon({ type }: { type: Exclude<EvidenceFilter, 'all'> }) {
  if (type === 'attachment') return <FileText aria-hidden="true" size={16} />
  if (type === 'assistant_answer') return <Bot aria-hidden="true" size={16} />
  if (type === 'memory_excerpt') return <MemoryStick aria-hidden="true" size={16} />
  return <MessageSquareText aria-hidden="true" size={16} />
}

export function ProjectEvidencePage({
  actorId, firstGroup, projectId, projectName = 'Project', actingCompanyId, projectMemberId,
}: {
  actorId: Id<'users'> | null
  firstGroup: Doc<'groups'> | undefined
  projectId: Id<'projects'>
  projectName?: string
  actingCompanyId?: Id<'companies'>
  projectMemberId?: Id<'projectMembers'>
}) {
  const releaseConfig = useReleaseConfig()
  const [view, setView] = useState<KnowledgeView>('evidence')
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>('all')
  const [evidenceQuery, setEvidenceQuery] = useState('')
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)
  const [memoryImportOpen, setMemoryImportOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState<ProjectSearchFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const searchButtonRef = useRef<HTMLButtonElement>(null)
  const scopedIdentity = actingCompanyId && projectMemberId ? { actingCompanyId, projectMemberId } : {}

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 180)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const { results: evidence, status, loadMore } = usePaginatedQuery(
    api.evidence.listProjectPage,
    releaseConfig.tasks ? { projectId, ...scopedIdentity } : 'skip',
    { initialNumItems: 50 },
  )
  const memoryArgs = actorId ? { projectId, userId: actorId, ...scopedIdentity } : 'skip'
  const memoryStatus = useQuery(api.memory.getStatus, memoryArgs)
  const memoryImports = useQuery(api.memory.listImports, memoryArgs === 'skip' ? 'skip' : { ...memoryArgs, limit: 40 })
  const searchResults = useQuery(api.search.project, actorId && searchOpen && debouncedSearchQuery.trim().length >= 2 ? {
    filter: searchFilter, limit: 8, projectId, query: debouncedSearchQuery, userId: actorId, ...scopedIdentity,
  } : 'skip')
  const searchSections = useMemo(() => buildProjectSearchSections(searchResults), [searchResults])
  const selectedEvidence = evidence.find((item) => String(item.reference._id) === selectedEvidenceId) ?? null
  const normalizedEvidenceQuery = evidenceQuery.trim().toLowerCase()
  const filteredEvidence = useMemo(() => evidence.filter((item) => {
    if (evidenceFilter !== 'all' && item.reference.type !== evidenceFilter) return false
    if (!normalizedEvidenceQuery) return true
    return [item.reference.quote, item.group?.name, item.thread?.name, item.task.publicKey,
      item.task.title, item.creator?.displayName, evidenceTypeLabel(item.reference.type)]
      .some((value) => value?.toLowerCase().includes(normalizedEvidenceQuery))
  }), [evidence, evidenceFilter, normalizedEvidenceQuery])
  const linkedTaskCount = new Set(evidence.map((item) => String(item.task._id))).size
  const sourceCount = new Set(evidence.map((item) => item.group?._id ? String(item.group._id) : 'project')).size
  const isArchive = Boolean(memoryStatus && 'archive' in memoryStatus && memoryStatus.archive)

  function sourceHref(item: (typeof evidence)[number]) {
    if (item.group && item.reference.channelThreadId) return threadHref(
      projectId, item.group._id, item.reference.channelThreadId,
      actingCompanyId && projectMemberId ? { actingCompanyId, projectMemberId } : undefined,
      item.reference.messageId,
    )
    if (!item.group) return null
    if (actingCompanyId && projectMemberId) {
      const search = new URLSearchParams({ companyId: actingCompanyId, groupId: item.group._id, membershipId: projectMemberId, view: 'channels' })
      return `/workspace/company-projects/${encodeURIComponent(projectId)}?${search}${item.reference.messageId ? `#message-${encodeURIComponent(item.reference.messageId)}` : ''}`
    }
    return `/workspace/projects/${encodeURIComponent(projectId)}/groups/${encodeURIComponent(item.group._id)}${item.reference.messageId ? `#message-${encodeURIComponent(item.reference.messageId)}` : ''}`
  }

  function openSearchResult(result: ProjectSearchResult) {
    const href = projectSearchResultHref(result, {
      actingCompanyId,
      projectId,
      projectMemberId,
    })
    const destinationCompanyId = projectSearchDestinationCompanyId(result, {
      actingCompanyId,
      projectId,
      projectMemberId,
    })
    if (destinationCompanyId) {
      setStoredActingCompanyId(destinationCompanyId)
    }
    setSearchOpen(false)
    if (href) window.location.assign(href)
  }

  function moveKnowledgeTab(nextView: KnowledgeView) {
    setView(nextView)
    window.requestAnimationFrame(() => {
      document.getElementById(nextView === 'evidence' ? 'project-evidence-tab' : 'project-memory-tab')?.focus()
    })
  }

  return <div className="track-knowledge-page">
    <header className="track-knowledge-header">
      <div><p className="mono-label">Search, evidence, and memory</p><h1>Project knowledge</h1><p>Find work, verify its source, and manage the context Track can use inside this Project.</p></div>
      <Button onClick={() => setSearchOpen(true)} ref={searchButtonRef} type="button" variant="outline"><Search aria-hidden="true" size={15} /> Search Project <kbd>Ctrl K</kbd></Button>
    </header>
    <section aria-label="Project knowledge summary" className="track-knowledge-metrics">
      <article><span>Evidence</span><strong>{evidence.length}</strong><small>linked sources</small></article>
      <article><span>Tasks</span><strong>{linkedTaskCount}</strong><small>with context</small></article>
      <article><span>Scopes</span><strong>{sourceCount}</strong><small>Project and Channels</small></article>
      <article><span>Imports</span><strong>{memoryImports?.length ?? 0}</strong><small>memory sources</small></article>
    </section>
    <div className="track-knowledge-tabs" role="tablist" aria-label="Project knowledge views">
      <button aria-controls="project-evidence-panel" aria-selected={view === 'evidence'} className={view === 'evidence' ? 'active' : ''} id="project-evidence-tab" onClick={() => setView('evidence')} onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'End') { event.preventDefault(); moveKnowledgeTab('memory') } else if (event.key === 'ArrowLeft' || event.key === 'Home') { event.preventDefault(); moveKnowledgeTab('evidence') } }} role="tab" tabIndex={view === 'evidence' ? 0 : -1} type="button"><FileSearch aria-hidden="true" size={15} /> Evidence hub</button>
      <button aria-controls="project-memory-panel" aria-selected={view === 'memory'} className={view === 'memory' ? 'active' : ''} id="project-memory-tab" onClick={() => setView('memory')} onKeyDown={(event) => { if (event.key === 'ArrowLeft' || event.key === 'Home') { event.preventDefault(); moveKnowledgeTab('evidence') } else if (event.key === 'ArrowRight' || event.key === 'End') { event.preventDefault(); moveKnowledgeTab('memory') } }} role="tab" tabIndex={view === 'memory' ? 0 : -1} type="button"><MemoryStick aria-hidden="true" size={15} /> Project memory</button>
    </div>

    {view === 'evidence' ? <section aria-labelledby="project-evidence-tab" className="track-knowledge-workspace" id="project-evidence-panel" role="tabpanel">
      <div className="track-knowledge-primary">
        <header className="track-knowledge-section-header"><div><p className="mono-label">Verified provenance</p><h2 id="evidence-hub-title">Evidence hub</h2></div><span>{filteredEvidence.length} shown</span></header>
        <div className="track-knowledge-filterbar">
          <label className="track-knowledge-search"><Search aria-hidden="true" size={15} /><span className="sr-only">Filter evidence</span><Input autoComplete="off" name="evidence-filter" onChange={(event) => setEvidenceQuery(event.currentTarget.value)} placeholder="Filter by source, task, author, or text…" value={evidenceQuery} /></label>
          <div aria-label="Evidence type" className="track-knowledge-chips">{evidenceFilters.map((filter) => <button aria-pressed={evidenceFilter === filter.value} className={evidenceFilter === filter.value ? 'active' : ''} key={filter.value} onClick={() => setEvidenceFilter(filter.value)} type="button">{filter.label}</button>)}</div>
        </div>
        {!releaseConfig.tasks ? <KnowledgeEmpty icon={<FileSearch aria-hidden="true" size={21} />} title="Evidence is unavailable">Tasks and linked evidence are disabled in this environment.</KnowledgeEmpty>
          : status === 'LoadingFirstPage' ? <div aria-live="polite" className="track-knowledge-loading">Loading Project evidence…</div>
          : filteredEvidence.length ? <><ol className="track-evidence-feed">{filteredEvidence.map((item) => <li key={item.reference._id}>
            <button className="track-evidence-card" onClick={() => setSelectedEvidenceId(String(item.reference._id))} type="button">
              <span className={`track-evidence-type ${item.reference.type}`}><EvidenceTypeIcon type={item.reference.type} /></span>
              <span className="track-evidence-card-body"><span className="track-evidence-card-heading"><strong>{evidenceTypeLabel(item.reference.type)}</strong><span>{item.group ? `#${item.group.name}` : 'Project scope'}</span></span><span className="track-evidence-quote">{item.reference.quote ?? 'The original source is no longer available.'}</span><span className="track-evidence-card-meta"><span>{item.creator?.displayName ?? 'Project member'}</span><time dateTime={new Date(item.reference.createdAt).toISOString()}>{dateFormatter.format(item.reference.createdAt)}</time><span>Task {item.task.publicKey}</span></span><span className="track-evidence-path">{projectName}<ChevronRight aria-hidden="true" size={12} />{item.group?.name ?? 'Project'}{item.thread ? <><ChevronRight aria-hidden="true" size={12} />{item.thread.name}</> : null}</span></span>
              <ChevronRight aria-hidden="true" className="track-evidence-open-icon" size={16} />
            </button>
          </li>)}</ol>{status === 'CanLoadMore' ? <Button onClick={() => loadMore(50)} type="button" variant="outline">Load more evidence</Button> : null}</>
          : evidence.length ? <KnowledgeEmpty icon={<Search aria-hidden="true" size={21} />} title="No matching evidence">Try another phrase or source type. Your Project scope remains unchanged.</KnowledgeEmpty>
          : <KnowledgeEmpty icon={<FileSearch aria-hidden="true" size={21} />} title="No Project evidence yet">Create a task from a message, thread, file, assistant response, or memory excerpt to preserve its source here.</KnowledgeEmpty>}
      </div>
      <KnowledgeContextPanel evidenceCount={evidence.length} isArchive={isArchive} projectName={projectName} />
    </section> : <section aria-labelledby="project-memory-tab" className="track-knowledge-workspace" id="project-memory-panel" role="tabpanel">
      <div className="track-knowledge-primary">
        <header className="track-knowledge-section-header"><div><p className="mono-label">Permission-aware context</p><h2 id="memory-title">Project memory</h2></div><Button disabled={!actorId || !firstGroup || isArchive} onClick={() => setMemoryImportOpen(true)} type="button"><Import aria-hidden="true" size={15} /> Import memory</Button></header>
        <div className="track-memory-status"><span className={memoryStatus === undefined ? 'loading' : isArchive ? 'archive' : memoryStatus ? 'ready' : 'idle'}>{memoryStatus === undefined ? <Clock3 aria-hidden="true" size={16} /> : isArchive ? <Archive aria-hidden="true" size={16} /> : memoryStatus ? <CheckCircle2 aria-hidden="true" size={16} /> : <MemoryStick aria-hidden="true" size={16} />}</span><div><strong>{memoryStatus === undefined ? 'Checking memory' : isArchive ? 'Snapshot memory' : memoryStatus ? 'Memory is ready' : 'Memory has not been created'}</strong><p>{isArchive ? 'This former participant view is fixed at the recorded exit boundary.' : memoryStatus && !('archive' in memoryStatus) ? `Runtime ${memoryStatus.runtime} · schema ${memoryStatus.schemaVersion}` : 'Import approved context to make Project history easier to retrieve.'}</p></div></div>
        {memoryImports === undefined ? <div aria-live="polite" className="track-knowledge-loading">Loading memory sources…</div> : memoryImports.length ? <ol className="track-memory-list">{memoryImports.map((item) => {
          if ('entitlementId' in item) return <li className="track-memory-row" key={item._id}><Archive aria-hidden="true" size={16} /><div><strong>Archived memory snapshot</strong><p>Preserved at the Project access boundary.</p></div><span className="track-status-pill neutral">Snapshot</span></li>
          const sourceTotal = item.sourceStorageIds.length + item.sourceUrls.length
          return <li className="track-memory-row" key={item._id}><span className="track-memory-source-icon">{item.sourceKind === 'file' ? <FileText aria-hidden="true" size={16} /> : item.sourceKind === 'link' ? <Link2 aria-hidden="true" size={16} /> : <MessageSquareText aria-hidden="true" size={16} />}</span><div><strong>{item.sourceKind === 'file' ? 'File import' : item.sourceKind === 'link' ? 'Link import' : 'Pasted context'}</strong><p>{item.summary ?? (item.status === 'failed' ? 'The import needs attention.' : 'Track is preparing this source for Project memory.')}</p><small>{item.scope === 'project' ? 'Project scope' : `Channel scope · ${firstGroup && item.groupId === firstGroup._id ? firstGroup.name : 'visible Channel'}`} · {sourceTotal || 1} source{sourceTotal === 1 ? '' : 's'} · <time dateTime={new Date(item.createdAt).toISOString()}>{dateTimeFormatter.format(item.createdAt)}</time></small></div><span className={`track-status-pill ${item.status}`}>{item.status}</span></li>
        })}</ol> : <KnowledgeEmpty icon={<MemoryStick aria-hidden="true" size={21} />} title="No memory sources yet">Import notes, links, or files into the selected Channel. Track records where every source came from and who can use it.</KnowledgeEmpty>}
      </div>
      <aside className="track-knowledge-context" aria-label="Memory access boundary"><header><FolderLock aria-hidden="true" size={18} /><div><span className="mono-label">Access boundary</span><h3>{isArchive ? 'Snapshot only' : firstGroup ? `#${firstGroup.name}` : 'Project scope'}</h3></div></header><p>Memory follows the Project and Channel permissions of its source. It does not make private Channel content visible elsewhere.</p><dl><div><dt>Current scope</dt><dd>{actingCompanyId ? 'Represented Company' : 'Project member'}</dd></div><div><dt>Provenance</dt><dd>Source and author retained</dd></div><div><dt>Processing</dt><dd>{memoryImports?.some((item) => 'status' in item && (item.status === 'queued' || item.status === 'running')) ? 'In progress' : 'Up to date'}</dd></div></dl></aside>
    </section>}

    <ProjectSearchDialog filter={searchFilter} loading={searchOpen && debouncedSearchQuery.trim().length >= 2 && searchResults === undefined} onClose={() => setSearchOpen(false)} onFilterChange={setSearchFilter} onOpenResult={openSearchResult} onQueryChange={setSearchQuery} open={searchOpen} projectName={projectName} query={searchQuery} returnFocusRef={searchButtonRef} sections={searchSections} total={getProjectSearchTotal(searchSections)} updating={searchQuery !== debouncedSearchQuery} />
    <ProjectMemoryImportDialog actingCompanyId={actingCompanyId} actorId={actorId} groupId={firstGroup?._id ?? null} groupName={firstGroup?.name} onOpenChange={setMemoryImportOpen} open={memoryImportOpen} projectId={projectId} projectMemberId={projectMemberId} />
    <Sheet onOpenChange={(open) => { if (!open) setSelectedEvidenceId(null) }} open={Boolean(selectedEvidence)}>
      <SheetContent className="track-evidence-preview" side="right">
        {selectedEvidence ? <>
          <SheetHeader>
            <span className={`track-evidence-type ${selectedEvidence.reference.type}`}><EvidenceTypeIcon type={selectedEvidence.reference.type} /></span>
            <div><p className="mono-label">Evidence preview</p><SheetTitle>{evidenceTypeLabel(selectedEvidence.reference.type)}</SheetTitle><SheetDescription>Linked to task {selectedEvidence.task.publicKey}</SheetDescription></div>
          </SheetHeader>
          <SheetBody className="track-evidence-preview-body">
            <section><span className="track-evidence-preview-label">Selected source</span><blockquote>{selectedEvidence.reference.quote ?? 'The source content is unavailable.'}</blockquote></section>
            <section><span className="track-evidence-preview-label">Provenance</span><ol className="track-provenance-chain"><li>{projectName}</li><li>{selectedEvidence.group?.name ?? 'Project scope'}</li>{selectedEvidence.thread ? <li>{selectedEvidence.thread.name}</li> : null}<li>{evidenceTypeLabel(selectedEvidence.reference.type)}</li></ol></section>
            <section><span className="track-evidence-preview-label">Source details</span><dl><div><dt>Author</dt><dd>{selectedEvidence.creator?.displayName ?? 'Project member'}</dd></div><div><dt>Recorded</dt><dd>{dateTimeFormatter.format(selectedEvidence.reference.createdAt)}</dd></div><div><dt>Availability</dt><dd>{selectedEvidence.reference.availability}</dd></div><div><dt>Linked task</dt><dd>{selectedEvidence.task.publicKey} · {selectedEvidence.task.title}</dd></div></dl></section>
          </SheetBody>
          <SheetFooter>
            {sourceHref(selectedEvidence) ? <a className="track-button track-button-primary" href={sourceHref(selectedEvidence) ?? undefined}><ArrowUpRight aria-hidden="true" size={15} /> Open original source</a> : <p className="track-evidence-unavailable"><CircleAlert aria-hidden="true" size={15} /> No direct source is available for this item.</p>}
          </SheetFooter>
        </> : null}
      </SheetContent>
    </Sheet>
  </div>
}

function KnowledgeEmpty({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return <section className="track-knowledge-empty" role="status"><span>{icon}</span><h3>{title}</h3><p>{children}</p></section>
}

function KnowledgeContextPanel({ evidenceCount, isArchive, projectName }: { evidenceCount: number; isArchive: boolean; projectName: string }) {
  return <aside className="track-knowledge-context" aria-label="Evidence access boundary"><header><ShieldCheck aria-hidden="true" size={18} /><div><span className="mono-label">Source integrity</span><h3>{projectName}</h3></div></header><p>Each evidence item keeps its original Project and Channel boundary. Opening a source rechecks access on the server.</p><dl><div><dt>Visible sources</dt><dd>{evidenceCount}</dd></div><div><dt>Access mode</dt><dd>{isArchive ? 'Recorded snapshot' : 'Live permissions'}</dd></div><div><dt>Navigation</dt><dd>Original context</dd></div></dl></aside>
}
