import { useAction, useMutation, useQuery } from 'convex/react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Clipboard, FlatList, Platform, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useNetworkState } from 'expo-network';
import type { TaskPriority } from '@track/shared/tasks';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { ActionButton } from '@/components/action-button';
import { Composer } from '@/components/composer';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { DateField } from '@/components/date-field';
import { ForwardMessageSheet } from '@/components/forward-message-sheet';
import { MessageActions } from '@/components/message-actions';
import { IconButton } from '@/components/icon-button';
import { PlatformIcon } from '@/components/platform-icon';
import { TaskInlineCards } from '@/components/task-inline-cards';
import type { MobileBoardView } from '@/components/task-detail-types';
import { DateSeparator, ThreadRow, type DetailedMessage, type GroupedThreadItem, type ProjectMemberRow, resolveMentionIds, resolveMentionProjectMemberIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OptionsSheet, SheetFieldButton, SheetInput, SheetNote, SheetSection, SheetRow } from '@/components/options-sheet';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { sendComposerMessage, type ComposerSubmission, type ComposerSubmissionResult } from '@/lib/attachment-upload';
import { hapticLight, hapticMedium, hapticDestructive } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { buildMentionCandidates } from '@/lib/mention-autocomplete';
import { useReleaseConfig } from '@/lib/release-config';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { taskPriorityLabel } from '@/lib/task-presentation';
import { resolveWorkflowStateId } from '@/lib/task-workflow';
import { TaskAction } from '@/components/task-ui';
import { forwardedSourceHref, threadConversationHref, threadListHref } from '@/lib/thread-navigation';
import { communicationErrorMessage, taskErrorMessage } from '@/lib/user-facing-error';
import { setActivePushContext } from '@/lib/push-presentation';
import { enqueueOfflineTask } from '@/lib/offline-task-queue';
import { displayText } from '@/lib/display-text';
import { channelRoleLabel } from '@/lib/role-label';

/** WhatsApp-style grouping gap: a longer pause re-states who is speaking. */
const FIVE_MINUTES = 5 * 60 * 1000;

const reportReasons = ['inaccurate', 'unsafe', 'spam', 'harassment', 'privacy', 'other'] as const;

const reportReasonLabels: Record<(typeof reportReasons)[number], string> = {
  harassment: 'Harassment',
  inaccurate: 'Inaccurate',
  other: 'Something else',
  privacy: 'Privacy',
  spam: 'Spam',
  unsafe: 'Unsafe',
};

type PendingMessage = { id: string; body: string; at: number };

type TaskReviewTarget = {
  key: string;
  source: string;
  reference: {
    type: 'message' | 'assistant_answer';
    messageId?: Id<'messages'>;
    assistantStreamId?: Id<'assistantStreams'>;
    isPrimary: true;
  };
};

type TaskAssigneeView = {
  member: Doc<'projectMembers'>;
  user: { _id: Id<'users'>; displayName: string };
  company: Doc<'companies'> | null;
};

const taskPriorities: TaskPriority[] = ['none', 'urgent', 'high', 'medium', 'low'];
type TaskCreatePicker = 'assignee' | 'board' | 'priority' | 'status' | null;

function dateSepLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ConversationScreen() {
  const theme = useTheme();
  const network = useNetworkState();
  const router = useRouter();
  const { trackUserId } = useTrackUser();
  const releaseConfig = useReleaseConfig();
  const { groupId, projectId, companyId, membershipId, archive, messageId } = useLocalSearchParams<{ groupId: string; projectId: string; companyId?: string; membershipId?: string; archive?: string; messageId?: string }>();

  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachFile = useMutation(api.messages.attachFile);
  const askTrack = useAction(api.assistant.ask);
  const markRead = useMutation(api.mobile.markGroupRead);
  const setLastActive = useMutation(api.mobile.setLastActiveContext);
  const setGlobalNotif = useMutation(api.notifications.setGlobalMode);
  const setGroupNotif = useMutation(api.notifications.setGroupMode);
  const createReport = useMutation(api.reports.create);
  const createTask = useMutation(api.tasks.create);
  const deleteMessage = useMutation(api.messages.remove);
  const forwardMessage = useMutation(api.messages.forwardMessage);

  const gid = groupId as Id<'groups'> | undefined;
  const pid = projectId as Id<'projects'> | undefined;
  const cid = companyId as Id<'companies'> | undefined;
  const pmid = membershipId as Id<'projectMembers'> | undefined;
  const targetMessageId = messageId as Id<'messages'> | undefined;
  useFocusEffect(useCallback(() => {
    if (pid && gid) setActivePushContext({ projectId: pid, groupId: gid });
    return () => setActivePushContext(null);
  }, [gid, pid]));
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && pid && gid ? { userId: trackUserId, projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');
  const membershipArchived = archive === '1' || navigation?.readStateImmutable === true;
  const readOnly = membershipArchived || navigation?.archived === true;
  // Memoised so composing a message does not rebuild every row's identity props.
  const taskIdentity = useMemo<MobileTaskIdentity | null>(() => cid && pmid ? {
    archived: readOnly,
    companyId: cid,
    membershipId: pmid,
  } : null, [cid, pmid, readOnly]);

  const groups = useQuery(api.mobile.listGroups, trackUserId && pid && navigation?.available ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');
  const messages = useQuery(api.messages.listDetailed, trackUserId && gid && navigation?.available ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, limit: 120, targetMessageId } : 'skip');
  const assistantStreams = useQuery(api.assistant.listForGroup, trackUserId && gid && navigation?.available ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, limit: 40 } : 'skip');
  const notifSettings = useQuery(api.notifications.getSettings, trackUserId ? { userId: trackUserId, projectMemberId: pmid } : 'skip');
  const projectMembers = useQuery(api.mobile.listProjectMembers, trackUserId && pid && navigation?.available ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');
  const taskAssignees = useQuery(api.tasks.listEligibleAssignees, trackUserId && pid && gid && navigation?.available && !readOnly ? {
    projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid,
  } : 'skip') as TaskAssigneeView[] | undefined;
  const taskBoards = useQuery(api.taskBoards.list, trackUserId && pid && gid && navigation?.available && !readOnly ? {
    projectId: pid, actingCompanyId: cid, projectMemberId: pmid,
  } : 'skip') as MobileBoardView[] | undefined;

  const listRef = useRef<FlatList<GroupedThreadItem>>(null);
  /** Tracks whether the reader is pinned to the newest message, so arriving messages never yank them off history. */
  const atBottomRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<DetailedMessage | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [groupSwitchOpen, setGroupSwitchOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<GroupedThreadItem | null>(null);
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>('inaccurate');
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<GroupedThreadItem | null>(null);
  const [forwardTarget, setForwardTarget] = useState<DetailedMessage | null>(null);
  const [forwardBusyTargetId, setForwardBusyTargetId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [taskReviewTarget, setTaskReviewTarget] = useState<TaskReviewTarget | null>(null);
  const [taskTitleDraft, setTaskTitleDraft] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('none');
  const [taskDueDate, setTaskDueDate] = useState<string | null>(null);
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>('');
  const [taskBoardId, setTaskBoardId] = useState<string>('');
  const [taskWorkflowStateId, setTaskWorkflowStateId] = useState<string>('');
  const [taskCreateState, setTaskCreateState] = useState<'idle' | 'creating' | 'success' | 'error' | 'queued'>('idle');
  const [taskCreateError, setTaskCreateError] = useState<string | null>(null);
  const [createdTaskKey, setCreatedTaskKey] = useState<string | null>(null);
  const [taskPicker, setTaskPicker] = useState<TaskCreatePicker>(null);
  const forwardKeys = useRef(new Map<string, string>());
  /**
   * Rows that render task cards below them; those cards interrupt author
   * grouping. Rows only report while mounted, so scrolling never regroups.
   */
  const [cardRowIds, setCardRowIds] = useState<ReadonlySet<string>>(() => new Set());

  const trackCardRow = useCallback((rowId: string, hasCards: boolean) => {
    setCardRowIds((prev) => {
      if (prev.has(rowId) === hasCards) return prev;
      const next = new Set(prev);
      if (hasCards) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  }, []);

  const groupItems = useMemo(() => (groups ?? []) as { group: Doc<'groups'>; membership: Doc<'groupMembers'>; lastMessage: Doc<'messages'> | null; unreadCount: number }[], [groups]);
  const memberItems = useMemo(() => (projectMembers ?? []) as ProjectMemberRow[], [projectMembers]);
  const activeGroup = groupItems.find((g) => g.group._id === gid)?.group ?? null;
  const activeMembership = groupItems.find((g) => g.group._id === gid)?.membership;
  const globalMode = notifSettings?.global?.globalMode ?? 'all';
  const groupMode = notifSettings?.groups?.find((g) => g.groupId === gid)?.mode ?? 'inherit';
  const channelTaskBoards = useMemo(
    () => taskBoards?.filter((item) => item.board.groupId === gid) ?? [],
    [gid, taskBoards],
  );
  const selectedTaskBoard = channelTaskBoards.find((item) => item.board._id === taskBoardId)
    ?? channelTaskBoards.find((item) => item.board.isDefault)
    ?? channelTaskBoards[0];

  useEffect(() => {
    if (!taskReviewTarget || !selectedTaskBoard) return;
    setTaskBoardId(selectedTaskBoard.board._id);
    setTaskWorkflowStateId((current) =>
      resolveWorkflowStateId(selectedTaskBoard.states, current),
    );
  }, [selectedTaskBoard, taskReviewTarget]);

  function copyMessage(item: DetailedMessage) {
    const text = displayText(item.message.body || item.forwardedFrom?.originalBody || '').trim();
    if (!text) {
      Alert.alert('Nothing to copy', 'This message contains attachments but no text.');
      return;
    }
    Clipboard.setString(text);
    hapticLight();
    setNotice('Message copied.');
  }

  async function forwardTo(
    target: { group: Doc<'groups'> },
    note: string,
    audienceExpansionConfirmed = false,
  ) {
    if (!forwardTarget || !trackUserId || !pid || !gid) return;
    const sourceMessageId = forwardTarget.message._id;
    const key = `${sourceMessageId}:${target.group._id}`;
    const requestKey = forwardKeys.current.get(key) ?? idempotencyKey();
    forwardKeys.current.set(key, requestKey);
    setForwardBusyTargetId(target.group._id);
    setForwardError(null);
    try {
      await forwardMessage({
        actingCompanyId: cid,
        actorId: trackUserId,
        audienceExpansionConfirmed,
        body: note.trim() || undefined,
        idempotencyKey: requestKey,
        mentionedProjectMemberIds: resolveMentionProjectMemberIds(note, memberItems),
        mentions: resolveMentionIds(note, memberItems),
        projectId: pid,
        projectMemberId: pmid,
        sourceMessageId,
        targetGroupId: target.group._id,
      });
      forwardKeys.current.delete(key);
      setForwardTarget(null);
      setNotice(`Message forwarded to ${target.group.name}.`);
      hapticMedium();
    } catch (failure) {
      if (failure instanceof Error && failure.message.includes('audience_expansion_confirmation_required')) {
        Alert.alert(
          'Forward to a wider audience?',
          'Some people in this Channel could not access the original conversation. Forwarding sends them a copied snapshot.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Forward', onPress: () => void forwardTo(target, note, true) },
          ],
        );
      } else {
        setForwardError(communicationErrorMessage(failure, 'forward this message'));
      }
    } finally {
      setForwardBusyTargetId(null);
    }
  }

  const threadItems = useMemo<GroupedThreadItem[]>(() => {
    const msgs = [...((messages ?? []) as DetailedMessage[]).reverse()].map((item) => ({
      kind: 'message' as const, key: item.message._id, at: item.message.createdAt, item, isFirstInGroup: true,
    }));
    const streams = ((assistantStreams ?? []) as Doc<'assistantStreams'>[]).map((stream) => ({
      kind: 'assistant' as const, key: stream._id, at: stream.createdAt, stream, isFirstInGroup: true,
    }));
    const sorted: Array<{ kind: 'message'; key: string; at: number; item: DetailedMessage; isFirstInGroup: boolean } | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'>; isFirstInGroup: boolean }> =
      [...msgs, ...streams].sort((a, b) => a.at - b.at);

    const result: GroupedThreadItem[] = [];
    let lastDateStr = '';
    let lastAuthorKey = '';
    let lastAt = 0;
    /** Anything between two messages — a date pill, an answer, a task card — starts a new group. */
    let interrupted = true;

    for (const raw of sorted) {
      const dateStr = new Date(raw.at).toDateString();
      if (dateStr !== lastDateStr) {
        result.push({ kind: 'date-sep', key: `sep-${raw.at}`, at: raw.at, label: dateSepLabel(raw.at) });
        lastDateStr = dateStr;
        interrupted = true;
      }

      const authorKey = raw.kind === 'message' ? (raw.item.author?._id ?? 'anon') : '__assistant__';
      const tooLong = raw.at - lastAt > FIVE_MINUTES;
      const isFirstInGroup = interrupted || authorKey !== lastAuthorKey || tooLong;

      result.push({ ...raw, isFirstInGroup });
      lastAuthorKey = authorKey;
      lastAt = raw.at;
      interrupted = cardRowIds.has(raw.key);
    }

    return result;
  }, [assistantStreams, cardRowIds, messages]);
  // Lets a row jump to its quoted message without rebuilding every row when the thread grows.
  const threadItemsRef = useRef<GroupedThreadItem[]>(threadItems);
  useEffect(() => {
    threadItemsRef.current = threadItems;
  }, [threadItems]);

  const mentionCandidates = useMemo(() => buildMentionCandidates(memberItems), [memberItems]);

  function openTaskReview(target: Exclude<GroupedThreadItem, { kind: 'date-sep' }>) {
    if (!pid) return;
    const source = displayText(target.kind === 'message' ? target.item.message.body : target.stream.answer);
    setTaskReviewTarget({
      key: target.key,
      source,
      reference: target.kind === 'message'
        ? { type: 'message', messageId: target.item.message._id, isPrimary: true }
        : { type: 'assistant_answer', assistantStreamId: target.stream._id, isPrimary: true },
    });
    setTaskTitleDraft(source.trim().slice(0, 180) || 'Follow up');
    setTaskPriority('none');
    setTaskDueDate(null);
    setTaskAssigneeId('');
    setTaskBoardId('');
    setTaskWorkflowStateId('');
    setTaskCreateState('idle');
    setTaskCreateError(null);
    setCreatedTaskKey(null);
  }

  async function submitTaskReview() {
    if (!pid || !gid || !taskReviewTarget || !taskTitleDraft.trim() || taskCreateState === 'creating') return;
    const taskInput = {
      projectId: pid,
      groupId: gid,
      boardId: selectedTaskBoard?.board._id,
      workflowStateId: taskWorkflowStateId
        ? taskWorkflowStateId as Id<'taskWorkflowStates'>
        : undefined,
      title: taskTitleDraft.trim(),
      priority: taskPriority,
      dueDate: taskDueDate ?? undefined,
      assigneeProjectMemberId: taskAssigneeId ? taskAssigneeId as Id<'projectMembers'> : undefined,
      references: [taskReviewTarget.reference],
      idempotencyKey: `message-task:${taskReviewTarget.key}`,
      actingCompanyId: cid,
      projectMemberId: pmid,
    };
    if (network.isConnected === false) {
      if (!trackUserId) {
        setTaskCreateError('Sign in again before saving this task for later.');
        setTaskCreateState('error');
        return;
      }
      try {
        await enqueueOfflineTask(trackUserId, taskInput);
        setTaskCreateState('queued');
        setTaskCreateError(null);
      } catch {
        setTaskCreateError('This task could not be saved on the device.');
        setTaskCreateState('error');
      }
      return;
    }
    setTaskCreateState('creating');
    setTaskCreateError(null);
    try {
      const result = await createTask(taskInput);
      setCreatedTaskKey(result.publicKey);
      setTaskCreateState('success');
    } catch (error) {
      setTaskCreateError(taskErrorMessage(error, 'The task could not be created. Check your connection and try again.'));
      setTaskCreateState('error');
    }
  }

  /** The composer grows over the list when the keyboard opens; follow it down. */
  const pinToLatest = useCallback(() => {
    if (!atBottomRef.current) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    const subscriptions = [
      KeyboardEvents.addListener('keyboardWillShow', pinToLatest),
      KeyboardEvents.addListener('keyboardDidShow', pinToLatest),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [pinToLatest]);

  useEffect(() => {
    if (!targetMessageId) return;
    const index = threadItems.findIndex((item) => item.kind === 'message' && item.item.message._id === targetMessageId);
    if (index < 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 }));
  }, [targetMessageId, threadItems]);

  const messageActions = useMemo(() => {
    if (!actionTarget || actionTarget.kind === 'date-sep') return [];
    return [
      ...(releaseConfig.threads && actionTarget.kind === 'message' && pid && gid ? [{
        label: actionTarget.item.channelThread ? 'Open thread' : 'Start thread',
        icon: 'forum-outline' as const,
        onPress: () => {
          if (actionTarget.item.channelThread) {
            router.push(threadConversationHref(pid, gid, actionTarget.item.channelThread.threadId, cid && pmid ? { companyId: cid, membershipId: pmid, archived: readOnly } : null) as never);
            return;
          }
          router.push(threadListHref(pid, gid, cid && pmid ? { companyId: cid, membershipId: pmid, archived: readOnly } : null, actionTarget.item.message._id) as never);
        },
      }] : []),
      ...(!readOnly ? [{
        label: 'Reply',
        icon: 'arrow-up' as const,
        onPress: () => {
          if (actionTarget.kind === 'message') setReplyTo(actionTarget.item);
        },
      }] : []),
      ...(!readOnly && releaseConfig.tasks ? [{
        label: 'Create task',
        icon: 'plus' as const,
        onPress: () => {
          openTaskReview(actionTarget);
        },
      }] : []),
      ...(!readOnly && actionTarget.kind === 'message' && groupItems.some(({ group, membership }) =>
        group._id !== gid
        && (!group.status || group.status === 'active')
        && (!membership.status || membership.status === 'active')) ? [{
        label: 'Forward',
        icon: 'forward' as const,
        onPress: () => {
          setForwardError(null);
          setForwardTarget(actionTarget.item);
        },
      }] : []),
      ...(actionTarget.kind === 'message' ? [{
        label: 'Copy',
        icon: 'content-copy' as const,
        onPress: () => copyMessage(actionTarget.item),
      }] : []),
      ...(!readOnly &&
        actionTarget.kind === 'message' &&
        actionTarget.item.message.authorId === trackUserId &&
        (!pmid || !actionTarget.item.message.authorProjectMemberId ||
          actionTarget.item.message.authorProjectMemberId === pmid) ? [{
        label: 'Delete message',
        icon: 'alert-circle' as const,
        destructive: true,
        onPress: () => {
          Alert.alert(
            'Delete message?',
            'This can’t be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  setBusy(`delete-${actionTarget.item.message._id}`);
                  void deleteMessage({
                    messageId: actionTarget.item.message._id,
                    actorId: trackUserId,
                    actingCompanyId: cid,
                    projectMemberId: pmid,
                  }).then(() => {
                    setReplyTo((current) => current?.message._id === actionTarget.item.message._id ? null : current);
                  }).catch(() => {
                    Alert.alert('Message not deleted', 'Check your connection and try again.');
                  }).finally(() => setBusy(null));
                },
              },
            ],
          );
        },
      }] : []),
      {
        label: 'Report',
        icon: 'trash-can-outline' as const,
        destructive: true,
        onPress: () => setReportTarget(actionTarget),
      },
    ];
  }, [actionTarget, cid, createTask, deleteMessage, gid, groupItems, openTaskReview, pid, pmid, readOnly, releaseConfig.tasks, releaseConfig.threads, router, trackUserId]);

  // Clear pending messages when the real message arrives from the server
  useEffect(() => {
    if (!pendingMessages.length || !messages) return;
    const now = Date.now();
    const recentBodies = new Set(
      (messages as DetailedMessage[])
        .filter((m) => now - m.message.createdAt < 30_000)
        .map((m) => m.message.body),
    );
    setPendingMessages((prev) => prev.filter((p) => !recentBodies.has(p.body)));
  }, [messages, pendingMessages.length]);

  useEffect(() => {
    if (!trackUserId || !pid || !gid || !navigation?.available) return;
    void setLastActive({
      userId: trackUserId, projectId: pid, groupId: gid,
      actingCompanyId: cid, projectMemberId: pmid,
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    }).catch(() => undefined);
  }, [cid, gid, navigation?.available, pid, pmid, setLastActive, trackUserId]);

  useEffect(() => {
    if (!trackUserId || !gid || navigation?.readStateImmutable || threadItems.length === 0) return;
    const last = [...threadItems].reverse().find((i) => i.kind === 'message');
    void markRead({
      userId: trackUserId, groupId: gid,
      actingCompanyId: cid, projectMemberId: pmid,
      lastReadMessageId: last?.kind === 'message' ? last.item.message._id : undefined,
    }).catch(() => undefined);
  }, [cid, gid, markRead, navigation?.readStateImmutable, pmid, threadItems, trackUserId]);

  async function withBusy(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  async function handleSendMessage(payload: ComposerSubmission): Promise<ComposerSubmissionResult> {
    if (!trackUserId || !pid || !gid) return { failedIds: payload.attachments.map((a) => a.id), messageId: null };
    hapticMedium();
    const body = payload.body.trim();
    const replyToMessageId = replyTo?.message._id;
    // Only text-only sends get an optimistic row; attachment sends show their own progress.
    const pendingId = body && payload.attachments.length === 0 ? Date.now().toString() : null;
    if (pendingId) setPendingMessages((prev) => [...prev, { id: pendingId, body, at: Date.now() }]);

    setBusy('send');
    try {
      const result = await sendComposerMessage({
        ...payload,
        body,
        replyToMessageId,
        target: {
          attachFile: (input) => attachFile({
            projectId: pid, groupId: gid, userId: trackUserId,
            actingCompanyId: cid, projectMemberId: pmid,
            messageId: input.messageId as Id<'messages'>,
            storageId: input.storageId as Id<'_storage'>,
            filename: input.filename, contentType: input.contentType,
            size: input.size, kind: input.kind, durationMs: input.durationMs,
          }),
          generateUploadUrl: () => generateUploadUrl({ groupId: gid, userId: trackUserId, actingCompanyId: cid, projectMemberId: pmid }),
          sendMessage: (input) => sendMessage({
            projectId: pid, groupId: gid, authorId: trackUserId,
            actingCompanyId: cid, projectMemberId: pmid,
            body: input.body, mentions: resolveMentionIds(input.body, memberItems),
            replyToMessageId: input.replyToMessageId as Id<'messages'> | undefined,
            notificationPreview: input.body,
          }),
        },
      });

      const { parseMentions } = await import('@track/shared');
      if (result.messageId && parseMentions(body).includes('track')) {
        await askTrack({
          projectId: pid, groupId: gid, requesterId: trackUserId,
          actingCompanyId: cid, projectMemberId: pmid,
          promptMessageId: result.messageId as Id<'messages'>, question: body,
        });
      }
      return result;
    } catch {
      if (pendingId) setPendingMessages((prev) => prev.filter((p) => p.id !== pendingId));
      Alert.alert('Message not sent', 'Check your connection and try again.');
      return { failedIds: payload.attachments.map((a) => a.id), messageId: null };
    } finally {
      setBusy(null);
    }
  }

  async function submitReport() {
    if (!trackUserId || !pid || !reportTarget || reportTarget.kind === 'date-sep') return;
    hapticDestructive();
    await withBusy('report', async () => {
      await createReport({
        projectId: pid, reporterId: trackUserId, groupId: gid,
        actingCompanyId: cid, projectMemberId: pmid,
        targetType: reportTarget.kind === 'assistant' ? 'assistant_answer' : 'message',
        targetMessageId: reportTarget.kind === 'message' ? reportTarget.item.message._id : undefined,
        targetAssistantStreamId: reportTarget.kind === 'assistant' ? reportTarget.stream._id : undefined,
        reason: reportReason, note: '',
      });
      setReportTarget(null);
    });
  }

  const renderItem = useCallback<ListRenderItem<GroupedThreadItem>>(({ item }) => {
    if (item.kind === 'date-sep') return <DateSeparator label={item.label} />;
    const isOwnMessage = item.kind === 'message' && item.item.author?._id === trackUserId;
    const forwarded = item.kind === 'message' ? item.item.forwardedFrom : null;
    const sourceGroupId = forwarded?.sourceGroupId ?? undefined;
    const sourceMessageId = forwarded?.sourceMessageId ?? undefined;
    const sourceThreadId = forwarded?.sourceChannelThreadId ?? undefined;
    const openForwardSource = pid && forwarded?.canOpenSource && sourceGroupId && sourceMessageId
      ? () => router.push(forwardedSourceHref(
          pid,
          sourceGroupId,
          sourceMessageId,
          sourceThreadId,
          cid && pmid ? { companyId: cid, membershipId: pmid, archived: membershipArchived } : null,
        ) as never)
      : undefined;
    return (
      <View>
        <ThreadRow
          item={item}
          isFirstInGroup={item.isFirstInGroup}
          isOwnMessage={isOwnMessage}
          onLongPress={() => {
            hapticLight();
            setActionTarget(item);
            setActionSheetOpen(true);
          }}
          onOpenForwardSource={openForwardSource}
          onSwipeReply={readOnly ? undefined : () => {
            hapticLight();
            if (item.kind === 'message') setReplyTo(item.item);
          }}
          onOpenThread={releaseConfig.threads && pid && gid && item.kind === 'message' && item.item.channelThread ? () => {
            router.push(threadConversationHref(pid, gid, item.item.channelThread!.threadId, cid && pmid ? { companyId: cid, membershipId: pmid, archived: readOnly } : null) as never);
          } : undefined}
          onPressReply={item.kind === 'message' && item.item.replyTo ? () => {
            const quotedId = item.item.replyTo?.messageId;
            const index = threadItemsRef.current.findIndex((entry) => entry.kind === 'message' && entry.item.message._id === quotedId);
            if (index >= 0) listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 });
          } : undefined}
        />
        {releaseConfig.tasks && pid ? <TaskInlineCards
          assistantStreamId={item.kind === 'assistant' ? item.stream._id : undefined}
          identity={taskIdentity}
          isOwnMessage={isOwnMessage}
          messageId={item.kind === 'message' ? item.item.message._id : undefined}
          onCardsChange={trackCardRow}
          projectId={pid}
        /> : null}
      </View>
    );
  }, [cid, gid, membershipArchived, pid, pmid, readOnly, releaseConfig.tasks, releaseConfig.threads, router, taskIdentity, trackCardRow, trackUserId]);

  if (navigation && !navigation.available) return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Channel unavailable' }} /><View style={styles.empty}><ThemedText type="subtitle">Channel unavailable</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{navigationUnavailableCopy(Boolean(cid))}</ThemedText></View></ThemedView>;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerTransparent: false,
          headerTitle: () => (
            <Pressable
              accessibilityLabel={`Conversation: ${activeGroup?.name ?? 'Current Channel'}. Switch Channel`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => { hapticLight(); setGroupSwitchOpen(true); }}
              style={styles.headerTitle}>
              <ThemedText numberOfLines={1} type="smallBold">{activeGroup?.name ?? 'Conversation'}</ThemedText>
              <PlatformIcon color={theme.textSecondary} name="chevron-down" size={16} />
            </Pressable>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                accessibilityLabel="Open Threads"
                icon="forum-outline"
                onPress={() => pid && gid && router.push(threadListHref(pid, gid, cid && pmid ? { companyId: cid, membershipId: pmid, archived: readOnly } : null) as never)}
                size={21}
              />
              {!readOnly ? (
                <IconButton
                  accessibilityLabel="Conversation options"
                  icon="dots-horizontal"
                  onPress={() => setToolsOpen(true)}
                  size={22}
                />
              ) : null}
            </View>
          ),
        }}
      />

      <View style={styles.flex}>
        <ConnectivityBanner message="You’re offline. Saved conversation remains readable; new messages will need a connection." style={styles.connection} />
        {notice ? (
          <ThemedText accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.success }]} type="small">
            {notice}
          </ThemedText>
        ) : null}
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.thread}
          contentInsetAdjustmentBehavior="automatic"
          data={threadItems}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          onScrollToIndexFailed={({ index }) => requestAnimationFrame(() => listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.5 }))}
          initialNumToRender={24}
          keyExtractor={(item) => item.key}
          maxToRenderPerBatch={16}
          onScroll={({ nativeEvent }) => {
            const distanceFromBottom = nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height;
            atBottomRef.current = distanceFromBottom < 80;
            setShowJumpToLatest(distanceFromBottom > 320);
          }}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (!targetMessageId && atBottomRef.current) listRef.current?.scrollToEnd({ animated: true });
          }}
          removeClippedSubviews={false}
          renderItem={renderItem}
          style={styles.flex}
          windowSize={9}
          ListEmptyComponent={
            messages !== undefined ? (
              <View style={styles.empty}>
                <ThemedText style={{ color: theme.textSecondary }} type="small">Start the conversation</ThemedText>
              </View>
            ) : null
          }
          ListFooterComponent={
            pendingMessages.length > 0 ? (
              <View>
                {pendingMessages.map((m) => (
                  <View key={m.id} style={styles.pendingRow}>
                    <View style={styles.pendingAvatarSpacer} />
                    <View style={styles.pendingBody}>
                      <PlatformIcon color={theme.textSecondary} name="clock-outline" size={12} />
                      <ThemedText style={styles.pendingText} type="small">{m.body}</ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            ) : null
          }
        />
      {showJumpToLatest ? (
        <Pressable
          accessibilityLabel="Jump to latest messages"
          accessibilityRole="button"
          onPress={() => {
            hapticLight();
            atBottomRef.current = true;
            setShowJumpToLatest(false);
            listRef.current?.scrollToEnd({ animated: true });
          }}
          style={[styles.jumpToLatest, { backgroundColor: theme.backgroundElevated, borderColor: theme.hairline }]}>
          <PlatformIcon color={theme.text} name="chevron-down" size={22} />
        </Pressable>
      ) : null}
      </View>

      {readOnly ? <View style={[styles.archiveBanner, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Read-only Company exit archive</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="small">Messages and frozen memory stop at the Company exit cutoff.</ThemedText></View> : <Composer
        activeGroupName={activeGroup?.name ?? null}
        busy={busy === 'send'}
        mentionCandidates={mentionCandidates}
        onCancelReply={() => setReplyTo(null)}
        onChangeText={setComposer}
        onFocus={() => {
          atBottomRef.current = true;
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        }}
        onSendMessage={handleSendMessage}
        replyTo={replyTo}
        value={composer}
      />}

      <OptionsSheet onClose={() => setGroupSwitchOpen(false)} title="Switch Channel" visible={groupSwitchOpen}>
        <SheetSection>
          {groupItems.map((item) => (
            <SheetRow
              key={item.group._id}
              label={item.group.name}
              selected={item.group._id === gid}
              onPress={() => {
                setGroupSwitchOpen(false);
                hapticLight();
                router.replace(channelHref(pid!, item.group._id, cid && pmid ? { archived: readOnly, companyId: cid, membershipId: pmid } : null) as never);
              }}
            />
          ))}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet onClose={() => setToolsOpen(false)} title="Channel settings" visible={toolsOpen}>
        <SheetSection title="Access">
          <SheetRow
            detail="Channel access is enforced by the server. Company administration remains on web."
            icon="shield-check"
            label={channelRoleLabel(Boolean(activeMembership?.isSteward))}
          />
        </SheetSection>
        <SheetSection>
          <SheetRow
            icon="bell-outline"
            label="Manage notification settings"
            onPress={() => {
              setToolsOpen(false);
              router.push('/notifications');
            }}
          />
        </SheetSection>
        {releaseConfig.threads && pid && gid ? <SheetSection title="Conversation">
          <SheetRow
            icon="forum-outline"
            label="Threads"
            onPress={() => {
              setToolsOpen(false);
              router.push(threadListHref(pid, gid, cid && pmid ? { companyId: cid, membershipId: pmid, archived: readOnly } : null) as never);
            }}
          />
        </SheetSection> : null}
        <SheetSection title="Global">
          {(['all', 'mentions', 'none'] as const).map((mode) => (
            <SheetRow
              key={mode}
              label={mode === 'all' ? 'All messages' : mode === 'mentions' ? 'Mentions only' : 'Off'}
              selected={globalMode === mode}
              onPress={() => trackUserId && void setGlobalNotif({ userId: trackUserId, mode })}
            />
          ))}
        </SheetSection>
        <SheetSection title="This Channel">
          {(['inherit', 'all', 'mentions', 'none'] as const).map((mode) => (
            <SheetRow
              key={mode}
              label={mode === 'inherit' ? 'Follow global' : mode === 'all' ? 'All messages' : mode === 'mentions' ? 'Mentions only' : 'Off'}
              selected={groupMode === mode}
              onPress={() => trackUserId && gid && void setGroupNotif({ userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, mode })}
            />
          ))}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet onClose={() => setReportTarget(null)} title="Report" visible={Boolean(reportTarget)}>
        <SheetSection title="Reason">
          <View style={styles.reasonGrid}>
            {reportReasons.map((r) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected: reportReason === r }}
                key={r}
                onPress={() => setReportReason(r)}
                style={[styles.reasonChip, { backgroundColor: reportReason === r ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="small">{reportReasonLabels[r]}</ThemedText>
              </Pressable>
            ))}
          </View>
        </SheetSection>
        <ActionButton
          disabled={busy === 'report'}
          label="Submit report"
          loading={busy === 'report'}
          onPress={() => void submitReport()}
          variant="destructive"
        />
      </OptionsSheet>

      <OptionsSheet
        onClose={() => {
          if (taskCreateState === 'creating') return;
          setTaskReviewTarget(null);
          setTaskPicker(null);
          setTaskCreateState('idle');
          setTaskCreateError(null);
        }}
        showScrollProgress
        title={taskCreateState === 'success' ? 'Task created' : taskCreateState === 'queued' ? 'Waiting to sync' : taskPicker ? `Choose ${taskPicker}` : 'Create task from message'}
        visible={Boolean(taskReviewTarget)}>
        {taskCreateState === 'success' ? (
          <>
            <SheetSection>
              <View style={styles.taskSuccess}>
                <PlatformIcon color={theme.success} name="check-circle" size={24} />
                <ThemedText type="subtitle">Task created from this conversation</ThemedText>
                <ThemedText themeColor="textSecondary" type="small">
                  The source message is linked to {createdTaskKey ?? 'the new task'}.
                </ThemedText>
              </View>
            </SheetSection>
            <TaskAction label="Open task" onPress={() => {
                if (!pid || !createdTaskKey) return;
                setTaskReviewTarget(null);
                router.push(taskDetailHref(pid, createdTaskKey, taskIdentity));
              }} primary />
          </>
        ) : taskCreateState === 'queued' ? (
          <SheetSection>
            <View style={styles.taskSuccess}>
              <PlatformIcon color={theme.textSecondary} name="cloud-off" size={24} />
              <ThemedText type="subtitle">Saved locally</ThemedText>
              <ThemedText themeColor="textSecondary" type="small">
                Waiting to sync. Track will create this task when the connection returns.
              </ThemedText>
            </View>
          </SheetSection>
        ) : taskPicker ? (
          <>
            <SheetSection><SheetRow icon="chevron-left" label="Back to task" onPress={() => setTaskPicker(null)} /></SheetSection>
            {taskPicker === 'board' ? <SheetSection title="Board">
              {taskBoards === undefined ? <SheetNote>Loading boards…</SheetNote> : null}
              {channelTaskBoards.map((item) => <SheetRow icon="view-board" key={item.board._id} label={item.board.name} selected={item.board._id === selectedTaskBoard?.board._id} onPress={() => { setTaskBoardId(item.board._id); setTaskWorkflowStateId(resolveWorkflowStateId(item.states)); setTaskPicker(null); }} />)}
            </SheetSection> : null}
            {taskPicker === 'status' ? <SheetSection title="Status">
              {selectedTaskBoard?.states.map((state) => <SheetRow icon={state.category === 'completed' ? 'check-circle' : 'circle-outline'} key={state._id} label={state.name} selected={taskWorkflowStateId === state._id} onPress={() => { setTaskWorkflowStateId(state._id); setTaskPicker(null); }} />)}
              {taskBoards && (!selectedTaskBoard || selectedTaskBoard.states.length === 0) ? <SheetNote>The default status will be used.</SheetNote> : null}
            </SheetSection> : null}
            {taskPicker === 'priority' ? <SheetSection title="Priority">
              {taskPriorities.map((value) => <SheetRow icon="flag" key={value} label={taskPriorityLabel(value)} selected={taskPriority === value} onPress={() => { setTaskPriority(value); setTaskPicker(null); }} />)}
            </SheetSection> : null}
            {taskPicker === 'assignee' ? <SheetSection title="Assignee">
              <SheetRow icon="person" label="Unassigned" selected={!taskAssigneeId} onPress={() => { setTaskAssigneeId(''); setTaskPicker(null); }} />
              {taskAssignees?.map((item) => <SheetRow icon="person" key={item.member._id} label={`${item.user.displayName}${item.company ? ` · ${item.company.displayName}` : ''}`} selected={taskAssigneeId === item.member._id} onPress={() => { setTaskAssigneeId(item.member._id); setTaskPicker(null); }} />)}
            </SheetSection> : null}
          </>
        ) : (
          <>
            <SheetSection>
              <View style={styles.taskReviewCopy}>
                <ThemedText themeColor="textSecondary" type="captionBold">Source message</ThemedText>
                <ThemedText numberOfLines={4} themeColor="textSecondary" type="small">
                  {taskReviewTarget?.source}
                </ThemedText>
                <ThemedText themeColor="textSecondary" type="caption">
                  This message will stay linked to the task.
                </ThemedText>
              </View>
            </SheetSection>
            <SheetSection title="Task title">
              <SheetInput
                autoFocus
                label="Title"
                maxLength={180}
                onChangeText={setTaskTitleDraft}
                value={taskTitleDraft}
              />
            </SheetSection>
            <SheetFieldButton icon="person" label="Assignee" onClear={taskAssigneeId ? () => setTaskAssigneeId('') : undefined} onPress={() => setTaskPicker('assignee')} placeholder="Unassigned" value={taskAssignees?.find((item) => item.member._id === taskAssigneeId)?.user.displayName} />
            <DateField onChange={setTaskDueDate} value={taskDueDate} />
            {channelTaskBoards.length > 1 ? <SheetFieldButton icon="view-board" label="Board" onPress={() => setTaskPicker('board')} value={selectedTaskBoard?.board.name} /> : null}
            <SheetFieldButton icon="circle-outline" label="Status" onPress={() => setTaskPicker('status')} placeholder="Default status" value={selectedTaskBoard?.states.find((state) => state._id === taskWorkflowStateId)?.name} />
            <SheetFieldButton icon="flag" label="Priority" onPress={() => setTaskPicker('priority')} value={taskPriorityLabel(taskPriority)} />
            {!taskAssignees && network.isConnected === false ? <SheetNote>Assignees will load when you’re back online.</SheetNote> : null}
            {taskCreateError ? (
              <ThemedText accessibilityRole="alert" style={styles.taskCreateError} themeColor="danger" type="small">
                {taskCreateError}
              </ThemedText>
            ) : null}
            <TaskAction
              disabled={taskCreateState === 'creating' || !taskTitleDraft.trim()}
              label={taskCreateState === 'creating' ? 'Creating task…' : taskCreateState === 'error' ? 'Try again' : network.isConnected === false ? 'Save for later' : 'Create task'}
              onPress={() => void submitTaskReview()}
              primary
            />
          </>
        )}
      </OptionsSheet>

      <MessageActions
        visible={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        actions={messageActions}
      />
      <ForwardMessageSheet
        busyTargetId={forwardBusyTargetId}
        currentGroupId={gid}
        error={forwardError}
        groups={groups === undefined ? undefined : groupItems}
        message={forwardTarget}
        onClose={() => {
          if (forwardBusyTargetId) return;
          setForwardTarget(null);
          setForwardError(null);
        }}
        onForward={(target, note) => void forwardTo(target, note)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  archiveBanner: { gap: Spacing.one, padding: Spacing.three },
  connection: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  notice: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  empty: { alignItems: 'center', padding: Spacing.six },
  flex: { flex: 1 },
  jumpToLatest: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: Spacing.three,
    elevation: 3,
    height: TouchTarget,
    justifyContent: 'center',
    position: 'absolute',
    right: Spacing.three,
    width: TouchTarget,
  },
  headerActions: { alignItems: 'center', flexDirection: 'row' },
  headerTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pendingAvatarSpacer: { width: 36 },
  pendingBody: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two, minWidth: 0, opacity: 0.6 },
  pendingRow: { flexDirection: 'row', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 2 },
  pendingText: { flex: 1 },
  reasonChip: { alignItems: 'center', borderRadius: 8, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, padding: Spacing.three },
  screen: { flex: 1 },
  taskCreateError: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  taskReviewCopy: { gap: Spacing.two, padding: Spacing.three },
  taskSuccess: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four },
  thread: { paddingBottom: Spacing.two, paddingTop: Spacing.two },
});
