export function createPendingAttachment(
  file: File,
  metadata: { durationMs?: number; kind?: 'file' | 'voice_note'; previewUrl?: string | null } = {},
) {
  return {
    file,
    id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
    durationMs: metadata.durationMs,
    kind: metadata.kind ?? 'file',
    previewUrl: metadata.previewUrl ?? (file.type.startsWith('image/') ? URL.createObjectURL(file) : null),
  }
}

export type PendingAttachment = ReturnType<typeof createPendingAttachment>
