import { v } from 'convex/values'

import { internal } from './_generated/api'
import { action, internalMutation, internalQuery, mutation, query } from './_generated/server'
import { appendAuditEvent } from './lib/audit'
import { rateLimiter } from './lib/rateLimit'
import { requireProjectMember } from './lib/permissions'

export const list = query({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    return await ctx.db
      .query('exports')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', args.projectId))
      .order('desc')
      .take(50)
  },
})

export const request = mutation({
  args: {
    projectId: v.id('projects'),
    userId: v.id('users'),
    format: v.union(v.literal('csv'), v.literal('pdf')),
    preset: v.union(v.literal('client_summary'), v.literal('full_audit_packet')),
    filters: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireProjectMember(ctx, args.projectId, args.userId)
    await rateLimiter.limit(ctx, 'requestExport', {
      key: args.userId,
      throws: true,
    })
    const exportId = await ctx.db.insert('exports', {
      projectId: args.projectId,
      requestedBy: args.userId,
      format: args.format,
      preset: args.preset,
      filters: args.filters ?? {},
      status: 'queued',
      createdAt: Date.now(),
    })

    await appendAuditEvent(ctx, {
      projectId: args.projectId,
      actorId: args.userId,
      entityType: 'export',
      entityId: exportId,
      action: 'export.requested',
      after: {
        format: args.format,
        preset: args.preset,
      },
    })

    return exportId
  },
})

export const collectData = internalQuery({
  args: {
    exportId: v.id('exports'),
  },
  handler: async (ctx, args) => {
    const exportJob = await ctx.db.get(args.exportId)
    if (!exportJob) throw new Error('export_not_found')
    const project = await ctx.db.get(exportJob.projectId)
    const records = await ctx.db
      .query('records')
      .withIndex('by_project', (q) => q.eq('projectId', exportJob.projectId))
      .collect()
    const auditEvents = await ctx.db
      .query('auditEvents')
      .withIndex('by_project_created_at', (q) => q.eq('projectId', exportJob.projectId))
      .order('asc')
      .take(exportJob.preset === 'full_audit_packet' ? 500 : 100)

    return { exportJob, project, records, auditEvents }
  },
})

export const markRunning = internalMutation({
  args: {
    exportId: v.id('exports'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: 'running',
    })
  },
})

export const markCompleted = internalMutation({
  args: {
    exportId: v.id('exports'),
    storageId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: 'completed',
      storageId: args.storageId,
      completedAt: Date.now(),
    })
  },
})

export const markFailed = internalMutation({
  args: {
    exportId: v.id('exports'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.exportId, {
      status: 'failed',
      error: args.error,
      completedAt: Date.now(),
    })
  },
})

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function buildCsv(data: Awaited<ReturnType<typeof collectData._handler>>) {
  const rows = [
    ['Record ID', 'Type', 'Classification', 'Status', 'Title', 'Description'],
    ...data.records.map((record) => [
      record._id,
      record.type,
      record.classification,
      record.status,
      record.title,
      record.description,
    ]),
  ]
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function pdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 11 Tf',
    '48 780 Td',
    ...lines.slice(0, 42).flatMap((line, index) => [
      index === 0 ? '' : '0 -17 Td',
      `(${pdfText(line.slice(0, 92))}) Tj`,
    ]),
    'ET',
  ]
    .filter(Boolean)
    .join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]

  let offset = '%PDF-1.4\n'.length
  const offsets = objects.map((object) => {
    const current = offset
    offset += object.length
    return current
  })
  const xrefStart = offset
  const xref = [
    'xref',
    '0 6',
    '0000000000 65535 f ',
    ...offsets.map((item) => `${String(item).padStart(10, '0')} 00000 n `),
    'trailer',
    '<< /Size 6 /Root 1 0 R >>',
    'startxref',
    String(xrefStart),
    '%%EOF',
  ].join('\n')

  return `%PDF-1.4\n${objects.join('')}${xref}`
}

function buildPdf(data: Awaited<ReturnType<typeof collectData._handler>>) {
  const projectName = data.project?.name ?? 'Track Project'
  const recordLines = data.records.map(
    (record) =>
      `${record._id}: ${record.classification} / ${record.status} / ${record.title}`,
  )
  const auditLines =
    data.exportJob.preset === 'full_audit_packet'
      ? data.auditEvents.map((event) => `${event.action}: ${event.entityType}/${event.entityId}`)
      : []

  return buildSimplePdf([
    `Track ${data.exportJob.preset === 'full_audit_packet' ? 'Full Audit Packet' : 'Client Summary'}`,
    `Project: ${projectName}`,
    `Generated: ${new Date().toISOString()}`,
    `Records: ${data.records.length}`,
    '',
    ...recordLines,
    '',
    ...auditLines,
  ])
}

export const generate = action({
  args: {
    exportId: v.id('exports'),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.exports.markRunning, { exportId: args.exportId })
    try {
      const data = await ctx.runQuery(internal.exports.collectData, {
        exportId: args.exportId,
      })
      const body =
        data.exportJob.format === 'csv' ? buildCsv(data) : buildPdf(data)
      const contentType =
        data.exportJob.format === 'csv' ? 'text/csv' : 'application/pdf'
      const storageId = await ctx.storage.store(new Blob([body], { type: contentType }))
      await ctx.runMutation(internal.exports.markCompleted, {
        exportId: args.exportId,
        storageId,
      })
      return storageId
    } catch (error) {
      await ctx.runMutation(internal.exports.markFailed, {
        exportId: args.exportId,
        error: error instanceof Error ? error.message : 'export_failed',
      })
      throw error
    }
  },
})
