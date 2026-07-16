export function resolvePushHref(data: Record<string, unknown> | null | undefined) {
  if (typeof data?.url !== 'string' || !data.url.startsWith('/')) return null;
  const base = new URL(data.url, 'https://track.local');
  if (base.pathname === '/task') {
    if (!base.searchParams.get('projectId') || !base.searchParams.get('taskKey')) return null;
    const companyId = base.searchParams.get('companyId');
    const membershipId = base.searchParams.get('membershipId');
    if (Boolean(companyId) !== Boolean(membershipId)) return null;
    return `${base.pathname}${base.search}`;
  }
  if (base.pathname === '/conversation' && base.searchParams.get('projectId') && base.searchParams.get('groupId')) {
    return `${base.pathname}${base.search}`;
  }
  return null;
}
