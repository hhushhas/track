export function resolvePushHref(data: Record<string, unknown> | null | undefined) {
  if (typeof data?.url !== 'string' || !data.url.startsWith('/') || data.url.startsWith('//')) return null;
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
  const webConversation = base.pathname.match(/^\/workspace\/projects\/([^/]+)\/groups\/([^/]+)$/);
  if (webConversation) {
    const projectId = typeof data.projectId === 'string' ? data.projectId : webConversation[1];
    const groupId = typeof data.groupId === 'string' ? data.groupId : webConversation[2];
    const companyId = typeof data.companyId === 'string' ? data.companyId : null;
    const membershipId = typeof data.membershipId === 'string' ? data.membershipId : null;
    if (!projectId || !groupId || Boolean(companyId) !== Boolean(membershipId)) return null;
    const params = new URLSearchParams({ projectId, groupId });
    if (companyId && membershipId) {
      params.set('companyId', companyId);
      params.set('membershipId', membershipId);
    }
    return `/conversation?${params.toString()}`;
  }
  return null;
}
