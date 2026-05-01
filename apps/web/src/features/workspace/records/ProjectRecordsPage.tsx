import { ChevronDown, Download } from 'lucide-react'

import type { Doc, Id } from '../../../../../../convex/_generated/dataModel'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { Input } from '#/components/ui/input'
import { draftStatuses } from '#/features/workspace/constants'
import { formatRailLabel } from '#/features/workspace/lib/formatting'

export function ProjectRecordsPage({
  busyAction,
  filteredRecords,
  onRecordStatus,
  onRequestExport,
  recordFilter,
  recordSearchQuery,
  records,
  setRecordFilter,
  setRecordSearchQuery,
}: {
  busyAction: string | null
  filteredRecords: Array<Doc<'records'>>
  onRecordStatus: (recordId: Id<'records'>, status: (typeof draftStatuses)[number]) => Promise<void>
  onRequestExport: (format: 'csv' | 'pdf') => Promise<void>
  recordFilter: 'all' | 'open' | 'billable' | 'blocked' | 'done'
  recordSearchQuery: string
  records: Array<Doc<'records'>>
  setRecordFilter: (filter: 'all' | 'open' | 'billable' | 'blocked' | 'done') => void
  setRecordSearchQuery: (query: string) => void
}) {
  const openRecords = records.filter((record) => record.status === 'open' || record.status === 'in_progress')
  const billableRecords = records.filter((record) => record.classification === 'billable_scope')
  const blockedRecords = records.filter((record) => record.status === 'blocked')
  const doneRecords = records.filter((record) => record.status === 'done')

  return (
    <div className="track-records-page">
      <section className="track-records-main">
        <div className="track-records-toolbar">
          <div className="track-record-filter-row" role="list" aria-label="Record filters">
            {[
              ['all', 'All', records.length],
              ['open', 'Open', openRecords.length],
              ['billable', 'Billable', billableRecords.length],
              ['blocked', 'Blocked', blockedRecords.length],
              ['done', 'Done', doneRecords.length],
            ].map(([value, label, count]) => (
              <button
                className={recordFilter === value ? 'track-record-filter active' : 'track-record-filter'}
                key={value}
                onClick={() => setRecordFilter(value as typeof recordFilter)}
                type="button"
              >
                <span>{label}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="track-record-tools">
            <Input
              className="track-record-search"
              onChange={(event) => setRecordSearchQuery(event.currentTarget.value)}
              placeholder="Search records..."
              value={recordSearchQuery}
            />
            <Button
              className="track-button"
              disabled={busyAction === 'export-csv'}
              onClick={() => void onRequestExport('csv')}
              type="button"
            >
              <Download size={14} />
              CSV
            </Button>
            <Button
              className="track-button track-button-primary"
              disabled={busyAction === 'export-pdf'}
              onClick={() => void onRequestExport('pdf')}
              type="button"
            >
              <Download size={14} />
              Audit packet
            </Button>
          </div>
        </div>

        <div className="track-record-table-wrap">
          <table className="track-record-table">
            <thead>
              <tr>
                <th>Record</th>
                <th>Type</th>
                <th>Class</th>
                <th>Status</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record._id}>
                  <td className="track-record-title-cell">
                    <span className="track-record-id">R-{record._id.slice(-5).toUpperCase()}</span>
                    <strong>{record.title}</strong>
                    <small>{record.description}</small>
                  </td>
                  <td>
                    <Badge className="track-type-pill" variant="outline">
                      <span className="track-type-dot" />
                      {record.type.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      className={record.classification === 'billable_scope' ? 'track-badge success' : 'track-badge'}
                      variant="outline"
                    >
                      {record.classification.replaceAll('_', ' ')}
                    </Badge>
                  </td>
                  <td>
                    <RecordStatusDropdown
                      ariaLabel={`Set status for ${record.title}`}
                      disabled={busyAction === `record-status-${record._id}`}
                      onStatus={(status) => onRecordStatus(record._id, status)}
                      status={record.status}
                    />
                  </td>
                  <td className="track-record-time-cell">
                    {new Date(record.reviewedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 ? (
                <tr>
                  <td className="track-record-empty-row" colSpan={5}>
                    No records match this view.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
export function RecordStatusDropdown({
  ariaLabel,
  disabled,
  onStatus,
  status,
}: {
  ariaLabel: string
  disabled: boolean
  onStatus: (status: (typeof draftStatuses)[number]) => Promise<void>
  status: Doc<'records'>['status']
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className="track-status-menu-trigger"
        disabled={disabled}
      >
        {formatRailLabel(status)}
        <ChevronDown size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="track-status-menu">
        <DropdownMenuRadioGroup
          onValueChange={(nextStatus) => void onStatus(nextStatus as (typeof draftStatuses)[number])}
          value={status}
        >
          {draftStatuses.map((nextStatus) => (
            <DropdownMenuRadioItem className="track-status-menu-item" key={nextStatus} value={nextStatus}>
              {formatRailLabel(nextStatus)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
