const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})

export function formatCopiedAttachmentCount(count: number) {
  return `${count} attachment${count === 1 ? '' : 's'} copied`
}

export function formatMessageTime(createdAt: number) {
  return messageTimeFormatter.format(createdAt)
}
