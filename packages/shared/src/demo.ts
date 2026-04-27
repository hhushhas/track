export const demoCurrentUser = {
  id: 'user-hasan',
  name: 'Hasan Shoaib',
  email: 'q9labs.ai@gmail.com',
  initials: 'HS',
  role: 'owner',
} as const

export const demoProject = {
  id: 'project-q9-track',
  name: 'Q9 Track',
  clientLabel: 'Internal product build',
  activeGroupId: 'group-general',
} as const

export const demoGroups = [
  {
    id: 'group-general',
    kind: 'general',
    name: 'General',
    memberCount: 8,
    unreadCount: 3,
    visibility: 'Staff + Client',
  },
  {
    id: 'group-internal',
    kind: 'internal',
    name: 'Internal',
    memberCount: 4,
    unreadCount: 1,
    visibility: 'Staff only',
  },
  {
    id: 'group-commercials',
    kind: 'commercials',
    name: 'Commercials',
    memberCount: 2,
    unreadCount: 0,
    visibility: 'Owner + Admin',
  },
] as const

export const demoMessages = [
  {
    id: 'msg-001',
    author: 'Amina',
    role: 'client',
    body: 'Can we include the invoice audit trail in the first release? It will help our finance lead sign off faster.',
    time: '09:42',
    tone: 'client',
  },
  {
    id: 'msg-002',
    author: 'Hasan',
    role: 'owner',
    body: 'Yes. I am marking that as a requested export capability. We will keep the client summary separate from the full audit packet.',
    time: '09:44',
    tone: 'staff',
  },
  {
    id: 'msg-003',
    author: 'Track AI Review',
    role: 'system',
    body: 'Draft Record proposed: Export should support a client-safe summary PDF and a full audit packet PDF.',
    time: '09:45',
    tone: 'ai',
  },
  {
    id: 'msg-004',
    author: 'Bilal',
    role: 'admin',
    body: '@track is the client asking for something billable here?',
    time: '09:46',
    tone: 'staff',
  },
  {
    id: 'msg-005',
    author: 'Track Assistant',
    role: 'system',
    body: 'Yes. The request adds export behavior that was not already in the accepted scope. Evidence: Amina asked to include the invoice audit trail; Hasan confirmed it as a requested export capability.',
    time: '09:47',
    tone: 'ai',
  },
] as const

export const demoRecords = [
  {
    id: 'REC-104',
    type: 'scope_change',
    title: 'Client Summary and Full Audit Packet exports',
    classification: 'billable_scope',
    status: 'accepted',
    owner: 'Hasan Shoaib',
    evidence: ['msg-001', 'msg-002'],
  },
  {
    id: 'REC-103',
    type: 'decision',
    title: 'Group membership is the visibility boundary',
    classification: 'official_record',
    status: 'accepted',
    owner: 'Bilal',
    evidence: ['msg-previous-21'],
  },
  {
    id: 'REC-102',
    type: 'task',
    title: 'Implement per-Group notification overrides',
    classification: 'official_record',
    status: 'in_progress',
    owner: 'Amina',
    evidence: ['msg-previous-18'],
  },
] as const

export const demoMetrics = [
  { label: 'Drafts', value: '7' },
  { label: 'Accepted', value: '18' },
  { label: 'Billable', value: '5' },
  { label: 'Open Tasks', value: '9' },
] as const

export const demoAuditEvents = [
  '09:45 AI Review proposed REC-104 from General.',
  '09:44 Hasan confirmed export capability.',
  '09:42 Amina requested invoice audit trail.',
] as const
