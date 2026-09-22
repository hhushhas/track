import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View, type FlatListProps, type ListRenderItem } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { Composer } from '@/components/composer';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { ForwardMessageSheet } from '@/components/forward-message-sheet';
import { IconButton } from '@/components/icon-button';
import { MessageActions } from '@/components/message-actions';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { TaskInlineCards } from '@/components/task-inline-cards';
import { ThreadRow, DateSeparator, type DetailedMessage, type GroupedThreadItem, resolveMentionIds, resolveMentionProjectMemberIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useAppToast } from '@/components/app-toast';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { sendComposerMessage, type ComposerSubmission, type ComposerSubmissionResult } from '@/lib/attachment-upload';
import { hapticLight } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { buildMentionCandidates } from '@/lib/mention-autocomplete';
import { useReleaseConfig } from '@/lib/release-config';
import { taskDetailHref, type MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';
import { setActivePushContext } from '@/lib/push-presentation';
import { useComposerDraft } from '@/hooks/use-composer-draft';
import { TaskLinkBatchProvider } from '@/lib/task-link-context';
import { communicationErrorMessage, taskErrorMessage } from '@/lib/user-facing-error';

const FIVE_MINUTES = 5 * 60 * 1000;

function dateSepLabel(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ThreadScreen() {
  const theme = useTheme();
  const { showToast } = useAppToast();
  const router = useRouter();
  const network = useNetworkState();
  const releaseConfig = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const { groupId, projectId, threadId, companyId, membershipId, archive, messageId } = useLocalSearchParams<{
    groupId: string;
    projectId: string;
    threadId: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    messageId?: string;
  }>();
  const gid = groupId as Id<'groups'> | undefined;
  const pid = projectId as Id<'projects'> | undefined;
  const tid = threadId as Id<'channelThreads'> | undefined;
  const targetMessageId = messageId as Id<'messages'> | undefined;
  const cid = companyId as Id<'companies'> | undefined;
  const pmid = membershipId as Id<'projectMembers'> | undefined;
  useFocusEffect(useCallback(() => {
    if (pid && gid && tid) setActivePushContext({ projectId: pid, groupId: gid, threadId: tid });
    return () => setActivePushContext(null);
  }, [gid, pid, tid]));
  const context = cid && pmid ? { companyId: cid, membershipId: pmid, archived: archive === '1' } : null;
  const navigation = useQuery(api.mobile.resolveNavigation, releaseConfig.threads && trackUserId && pid && gid
    ? { userId: trackUserId, projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid }
    : 'skip');
  const groups = useQuery(api.mobile.listGroups, releaseConfig.threads && trackUserId && pid && navigation?.available
    ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid }
    : 'skip');
  const queryArgs = useMemo(() => trackUserId && tid && navigation?.available
    ? { userId: trackUserId, threadId: tid, actingCompanyId: cid, projectMemberId: pmid }
    : null, [cid, navigation?.available, pmid, tid, trackUserId]);
  const thread = useQuery(api.channelThreads.get, queryArgs ?? 'skip');
  const { results: messages, status: messagePageStatus, loadMore: loadMoreMessages } = usePaginatedQuery(
    api.channelThreads.listMessagePage,
    queryArgs ? { ...queryArgs, targetMessageId } : 'skip',
    { initialNumItems: 50 },
  );
  const assistantPage = usePaginatedQuery(
    api.assistant.listForThreadPage,
    queryArgs ? { ...queryArgs, targetMessageId } : 'skip',
    { initialNumItems: 50 },
  );
  const assistantStreams = assistantPage.status === 'LoadingFirstPage' ? undefined : assistantPage.results;
  const projectMembersPage = usePaginatedQuery(
    api.mobile.listProjectMembersPage,
    trackUserId && pid && navigation?.available
      ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid }
      : 'skip',
    { initialNumItems: 100 },
  );
  const projectMembers = projectMembersPage.status === 'LoadingFirstPage'
    ? undefined
    : projectMembersPage.results;
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const claimUploadIntent = useMutation(api.messages.claimUploadIntent);
  const attachFile = useMutation(api.messages.attachFile);
  const askTrack = useAction(api.assistant.ask);
  const markRead = useMutation(api.channelThreads.markRead);
  const setFollowing = useMutation(api.channelThreads.setFollowing);
  const setStatus = useMutation(api.channelThreads.setStatus);
  const rename = useMutation(api.channelThreads.rename);
  const forwardMessage = useMutation(api.messages.forwardMessage);
  const createReport = useMutation(api.reports.create);
  const createTask = useMutation(api.tasks.create);
  const deleteMessage = useMutation(api.messages.remove);
  const sendSignatureRef = useRef<string | null>(null);
  const [replySelection, setReplySelection] = useState<{ scopeKey: string; message: DetailedMessage } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creatingTaskKey, setCreatingTaskKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [actionTarget, setActionTarget] = useState<GroupedThreadItem | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<DetailedMessage | null>(null);
  const [forwardBusyGroupId, setForwardBusyGroupId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const hasMoreThreadItems = messagePageStatus === 'CanLoadMore' || assistantPage.status === 'CanLoadMore';
  const composerDraftScope = useMemo(() => trackUserId && pid && gid && tid ? {
    actorId: trackUserId,
    actingCompanyId: cid,
    projectMemberId: pmid,
    projectId: pid,
    groupId: gid,
    threadId: tid,
  } : null, [cid, gid, pid, pmid, tid, trackUserId]);
  const composerDraft = useComposerDraft(composerDraftScope);
  const composer = composerDraft.draft.composer;
  const setComposer = useCallback((nextComposer: string) => {
    composerDraft.setDraft((current) => current.composer === nextComposer
      ? current
      : { ...current, composer: nextComposer });
  }, [composerDraft]);
  const sendKey = useRef<string | null>(null);
  const listRef = useRef<FlatList<GroupedThreadItem>>(null);
  const screenActiveRef = useRef(false);
  const lastViewedSequenceRef = useRef(0);
  const lastAcknowledgedSequenceRef = useRef(0);
  const acknowledgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberItems = useMemo(() => projectMembers ?? [], [projectMembers]);
  const mentionCandidates = useMemo(() => buildMentionCandidates(memberItems), [memberItems]);
  const readOnly = archive === '1' || navigation?.archived === true || thread?.thread.status === 'archived';
  const taskIdentity = useMemo<MobileTaskIdentity | null>(() => cid && pmid ? {
    archived: readOnly,
    companyId: cid,
    membershipId: pmid,
  } : null, [cid, pmid, readOnly]);

  useEffect(() => {
    if (thread) setRenameValue(thread.thread.name);
  }, [thread]);
  useEffect(() => {
    return () => {
      if (acknowledgeTimeoutRef.current) clearTimeout(acknowledgeTimeoutRef.current);
    };
  }, []);
  useFocusEffect(useCallback(() => {
    screenActiveRef.current = true;
    return () => {
      screenActiveRef.current = false;
    };
  }, []));

  const acknowledgeViewedMessage = useCallback((sequence: number) => {
    if (!queryArgs || !screenActiveRef.current || navigation?.readStateImmutable) return;
    if (!Number.isInteger(sequence) || sequence <= lastAcknowledgedSequenceRef.current) return;
    lastViewedSequenceRef.current = Math.max(lastViewedSequenceRef.current, sequence);
    if (acknowledgeTimeoutRef.current) return;
    acknowledgeTimeoutRef.current = setTimeout(() => {
      acknowledgeTimeoutRef.current = null;
      const nextSequence = lastViewedSequenceRef.current;
      if (!nextSequence || !screenActiveRef.current || nextSequence <= lastAcknowledgedSequenceRef.current) return;
      lastAcknowledgedSequenceRef.current = nextSequence;
      void markRead({ ...queryArgs, viewedChannelSequence: nextSequence }).catch(() => {
        lastAcknowledgedSequenceRef.current = Math.min(lastAcknowledgedSequenceRef.current, nextSequence - 1);
      });
    }, 150);
  }, [markRead, navigation?.readStateImmutable, queryArgs]);

  const onViewableItemsChanged = useCallback<NonNullable<FlatListProps<GroupedThreadItem>['onViewableItemsChanged']>>(({ viewableItems }) => {
    const visibleMessages = viewableItems
      .filter((token) => token.isViewable && token.item.kind === 'message')
      .map((token) => token.item);
    // eslint-disable-next-line unicorn/no-array-sort -- reason: Copy first to preserve immutability while supporting the web ES2022 target.
    visibleMessages.sort((left, right) => left.at - right.at);
    const lastVisible = visibleMessages.at(-1);
    if (lastVisible?.kind === 'message') acknowledgeViewedMessage(lastVisible.item.message.channelSequence ?? 0);
  }, [acknowledgeViewedMessage]);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 60 }), []);

  const threadItems = useMemo<GroupedThreadItem[]>(() => {
    const uniqueMessages = [...new Map(
      ((messages ?? []) as DetailedMessage[]).map((item) => [item.message._id, item] as const),
    ).values()];
    // eslint-disable-next-line unicorn/no-array-reverse -- reason: Reverse a newly copied array for the existing message ordering while supporting the web ES2022 target.
    const messageItems = uniqueMessages.reverse().map((item) => ({
      kind: 'message' as const,
      key: item.message._id,
      at: item.message.createdAt,
      item,
      isFirstInGroup: true,
    }));
    const assistantItems = ((assistantStreams ?? []) as Doc<'assistantStreams'>[]).map((stream) => ({
      kind: 'assistant' as const,
      key: stream._id,
      at: stream.createdAt,
      stream,
      isFirstInGroup: true,
    }));
    const sortedItems = [...messageItems, ...assistantItems];
    // eslint-disable-next-line unicorn/no-array-sort -- reason: Copy first to preserve immutability while supporting the web ES2022 target.
    sortedItems.sort((a, b) => a.at - b.at);
    const result: GroupedThreadItem[] = [];
    let lastDate = '';
    let lastAuthor = '';
    let lastAt = 0;
    let interrupted = true;
    for (const item of sortedItems) {
      const date = new Date(item.at).toDateString();
      if (date !== lastDate) {
        result.push({ kind: 'date-sep', key: `sep-${item.at}`, at: item.at, label: dateSepLabel(item.at) });
        lastDate = date;
        interrupted = true;
      }
      const author = item.kind === 'message' ? item.item.author?._id ?? 'unknown' : '__assistant__';
      const isFirstInGroup = interrupted || author !== lastAuthor || item.at - lastAt > FIVE_MINUTES;
      result.push({ ...item, isFirstInGroup });
      lastAuthor = author;
      lastAt = item.at;
      interrupted = false;
    }
    return result;
  }, [assistantStreams, messages]);
  const taskLinkMessageIds = useMemo(() => threadItems.flatMap((item) => item.kind === 'message' ? [item.item.message._id] : []), [threadItems]);
  const linkedTasks = useQuery(
    api.tasks.listForMessages,
    releaseConfig.tasks && taskLinkMessageIds.length
      ? { messageIds: taskLinkMessageIds, actingCompanyId: cid, projectMemberId: pmid }
      : 'skip',
  );
  const firstLinkedTask = linkedTasks?.flatMap((item) => item.tasks)[0]?.task;
  const draftReply = useMemo(() => {
    const pendingReplyId = composerDraft.draft.replyToMessageId;
    if (!pendingReplyId) return null;
    const reply = threadItems.find(
      (item) => item.kind === 'message' && item.item.message._id === pendingReplyId,
    );
    return reply?.kind === 'message' ? reply.item : null;
  }, [composerDraft.draft.replyToMessageId, threadItems]);
  const replyTo = replySelection?.scopeKey === composerDraft.scopeKey
    ? replySelection.message
    : draftReply;
  const replyMessageId = replyTo?.message._id;
  const setReplyTo = useCallback((nextReply: DetailedMessage | null) => {
    const replyToMessageId = nextReply?.message._id ?? null;
    composerDraft.setDraft((current) => current.replyToMessageId === replyToMessageId
      ? current
      : { ...current, replyToMessageId });
    setReplySelection(nextReply && composerDraft.scopeKey
      ? { scopeKey: composerDraft.scopeKey, message: nextReply }
      : null);
  }, [composerDraft]);
  useEffect(() => {
    if (!targetMessageId) return;
    const index = threadItems.findIndex((item) => item.kind === 'message' && item.item.message._id === targetMessageId);
    if (index < 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToIndex({ animated: true, index, viewPosition: 0.5 }));
  }, [targetMessageId, threadItems]);

  async function handleSendMessage(payload: ComposerSubmission): Promise<ComposerSubmissionResult> {
    if (!trackUserId || !pid || !gid || !tid || readOnly) {
      return { failedIds: payload.attachments.map((a) => a.id), messageId: null };
    }
    const body = payload.body.trim();
    const replyToMessageId = replyTo?.message._id;
    const sendSignature = JSON.stringify({
      attachmentIds: payload.attachments.map((attachment) => attachment.id),
      body,
      replyToMessageId: replyToMessageId ?? null,
    });
    if (!sendKey.current || sendSignatureRef.current !== sendSignature) {
      sendKey.current = idempotencyKey();
      sendSignatureRef.current = sendSignature;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendComposerMessage({
        ...payload,
        body,
        idempotencyKey: sendKey.current,
        replyToMessageId,
        target: {
          attachFile: (input) => attachFile({
            projectId: pid, groupId: gid, userId: trackUserId,
            actingCompanyId: cid, projectMemberId: pmid,
            messageId: input.messageId,
            uploadIntentId: input.uploadIntentId,
            storageId: input.storageId,
            filename: input.filename, contentType: input.contentType,
            size: input.size, kind: input.kind, durationMs: input.durationMs,
          }),
          claimUploadIntent: (input) => claimUploadIntent({
            intentId: input.intentId,
            storageId: input.storageId,
            userId: trackUserId,
            actingCompanyId: cid,
            projectMemberId: pmid,
          }),
          generateUploadUrl: (input) => generateUploadUrl({
            ...input,
            groupId: gid,
            channelThreadId: tid,
            userId: trackUserId,
            actingCompanyId: cid,
            projectMemberId: pmid,
          }),
          sendMessage: (input) => sendMessage({
            projectId: pid,
            groupId: gid,
            channelThreadId: tid,
            authorId: trackUserId,
            actingCompanyId: cid,
            projectMemberId: pmid,
            idempotencyKey: input.idempotencyKey,
            body: input.body,
            mentions: resolveMentionIds(input.body, memberItems),
            mentionedProjectMemberIds: resolveMentionProjectMemberIds(input.body, memberItems),
            replyToMessageId: input.replyToMessageId,
            notificationPreview: input.body,
          }),
        },
      });

      const { parseMentions } = await import('@track/shared');
      if (result.messageId && parseMentions(body).includes('track')) {
        try {
          await askTrack({
            projectId: pid, groupId: gid, channelThreadId: tid, requesterId: trackUserId,
            actingCompanyId: cid, projectMemberId: pmid,
            promptMessageId: result.messageId, question: body,
          });
        } catch {
          showToast({
            title: 'Message sent',
            message: 'Track Assistant could not respond. Retry the Assistant request.',
            tone: 'error',
          });
        }
      }
      // Only retire the idempotency key once every attachment landed; a retry reuses the same message.
      if (result.failedIds.length === 0) {
        sendKey.current = null;
        sendSignatureRef.current = null;
      }
      return result;
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'send this message'));
      return { failedIds: payload.attachments.map((a) => a.id), messageId: null };
    } finally {
      setBusy(false);
    }
  }

  async function handleForward(
    target: { group: { _id: Id<'groups'>; name: string; kind: string; status?: string }; membership: object },
    note: string,
  ) {
    if (!forwardTarget || !trackUserId || !pid) return;
    setForwardBusyGroupId(target.group._id);
    setForwardError(null);
    try {
      await forwardMessage({
        projectId: pid,
        sourceMessageId: forwardTarget.message._id,
        targetGroupId: target.group._id,
        actorId: trackUserId,
        actingCompanyId: cid,
        projectMemberId: pmid,
        body: note.trim() || undefined,
        idempotencyKey: idempotencyKey(),
      });
      setForwardTarget(null);
      showToast({ icon: 'forward', message: `Copied to ${target.group.name}.`, title: 'Message forwarded', tone: 'success' });
    } catch (caught) {
      setForwardError(communicationErrorMessage(caught, 'forward this message'));
    } finally {
      setForwardBusyGroupId(null);
    }
  }

  const messageActions = useMemo(() => {
    if (!actionTarget || actionTarget.kind === 'date-sep') return [];
    return [
      ...(!readOnly && actionTarget.kind === 'message' ? [{ label: 'Reply', icon: 'arrow-up' as const, onPress: () => setReplyTo(actionTarget.item) }] : []),
      ...(actionTarget.kind === 'message' ? [{ label: 'Forward', icon: 'forward' as const, onPress: () => { setForwardError(null); setForwardTarget(actionTarget.item); } }] : []),
      ...(!readOnly && releaseConfig.tasks ? [{
        label: 'Create task',
        icon: 'plus' as const,
        onPress: async () => {
          if (!pid || !gid) return;
          const source = actionTarget.kind === 'message' ? actionTarget.item.message.body : actionTarget.stream.answer;
          const reference = actionTarget.kind === 'message'
            ? { type: 'message' as const, messageId: actionTarget.item.message._id, isPrimary: true }
            : { type: 'assistant_answer' as const, assistantStreamId: actionTarget.stream._id, isPrimary: true };
          const taskKey = `message-task:${actionTarget.key}`;
          if (creatingTaskKey === taskKey) return;
          setCreatingTaskKey(taskKey);
          try {
            const task = await createTask({
              projectId: pid,
              groupId: gid,
              title: source.trim().slice(0, 180) || 'Follow up',
              priority: 'none',
              references: [reference],
              idempotencyKey: taskKey,
              actingCompanyId: cid,
              projectMemberId: pmid,
            });
            showToast({ title: 'Task created', message: `Task ${task.publicKey} is ready to review.`, tone: 'success' });
          } catch (failure) {
            showToast({ title: 'Task not created', message: taskErrorMessage(failure, 'The task could not be created. Check your connection and try again.'), tone: 'error' });
          } finally {
            setCreatingTaskKey(null);
          }
        },
      }] : []),
      ...(!readOnly &&
        actionTarget.kind === 'message' &&
        actionTarget.item.message.authorId === trackUserId &&
        (!pmid || !actionTarget.item.message.authorProjectMemberId ||
          actionTarget.item.message.authorProjectMemberId === pmid) ? [{
        label: 'Delete message',
        icon: 'trash-can-outline' as const,
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
                  setBusy(true);
                  setError(null);
                  void deleteMessage({
                    messageId: actionTarget.item.message._id,
                    actorId: trackUserId,
                    actingCompanyId: cid,
                    projectMemberId: pmid,
                  }).then(() => {
                    if (replyMessageId === actionTarget.item.message._id) setReplyTo(null);
                    setNotice('Message deleted.');
                  }).catch((caught) => {
                    setError(communicationErrorMessage(caught, 'delete this message'));
                  }).finally(() => setBusy(false));
                },
              },
            ],
          );
        },
      }] : []),
      { label: 'Report', icon: 'flag' as const, destructive: true, onPress: () => {
        if (!trackUserId || !pid) return;
        void createReport({
          projectId: pid,
          reporterId: trackUserId,
          actingCompanyId: cid,
          projectMemberId: pmid,
          targetType: actionTarget.kind === 'assistant' ? 'assistant_answer' : 'message',
          targetMessageId: actionTarget.kind === 'message' ? actionTarget.item.message._id : undefined,
          targetAssistantStreamId: actionTarget.kind === 'assistant' ? actionTarget.stream._id : undefined,
          reason: 'other',
        }).then(() => {
          showToast({ icon: 'flag', message: 'Thanks. The report was submitted for review.', title: 'Message reported', tone: 'success' });
        }).catch((caught) => {
          setError(communicationErrorMessage(caught, 'submit this report'));
        });
      } },
    ];
  }, [actionTarget, cid, createReport, createTask, creatingTaskKey, deleteMessage, gid, pid, pmid, readOnly, releaseConfig.tasks, replyMessageId, setReplyTo, showToast, trackUserId]);

  const renderItem = useCallback<ListRenderItem<GroupedThreadItem>>(({ item }) => {
    if (item.kind === 'date-sep') return <DateSeparator label={item.label} />;
    return <>
      <ThreadRow
        isFirstInGroup={item.isFirstInGroup}
        isOwnMessage={item.kind === 'message' && item.item.author?._id === trackUserId}
        item={item}
        onLongPress={() => { hapticLight(); setActionTarget(item); setActionsOpen(true); }}
        onSwipeReply={readOnly || item.kind !== 'message' ? undefined : () => setReplyTo(item.item)}
        variant="thread"
      />
      {releaseConfig.tasks && pid ? <TaskInlineCards
        assistantStreamId={item.kind === 'assistant' ? item.stream._id : undefined}
        identity={taskIdentity}
        messageId={item.kind === 'message' ? item.item.message._id : undefined}
        projectId={pid}
      /> : null}
    </>;
  }, [pid, readOnly, releaseConfig.tasks, setReplyTo, taskIdentity, trackUserId]);

  async function changeFollowing() {
    if (!queryArgs || !thread) return;
    setError(null);
    try {
      await setFollowing({ ...queryArgs, following: !thread.following });
      setNotice(thread.following ? 'Thread unfollowed.' : 'Thread followed.');
      setToolsOpen(false);
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'update the follow state'));
    }
  }

  async function changeStatus() {
    if (!queryArgs || !thread) return;
    setError(null);
    try {
      const result = await setStatus({ ...queryArgs, expectedRevision: thread.thread.revision, status: thread.thread.status === 'active' ? 'archived' : 'active' });
      setNotice(result.conflict ? 'Thread changed elsewhere. Refreshed current state.' : result.status === 'archived' ? 'Thread archived.' : 'Thread reopened.');
      setToolsOpen(false);
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'update this thread'));
    }
  }

  async function saveRename() {
    if (!queryArgs || !thread) return;
    setError(null);
    try {
      const result = await rename({ ...queryArgs, expectedRevision: thread.thread.revision, name: renameValue });
      setNotice(result.conflict ? 'Thread changed elsewhere. Refresh and retry.' : 'Thread renamed.');
      setToolsOpen(false);
      setRenameOpen(false);
      if (!result.conflict) showToast({ icon: 'check-circle', message: 'The new name is visible to everyone with access.', title: 'Thread renamed', tone: 'success' });
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'rename this thread'));
    }
  }

  if (!releaseConfig.threads || (navigation && !navigation.available) || thread === null) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread unavailable' }} /><EmptyState body={navigationUnavailableCopy(Boolean(cid))} icon="thread" title="Thread unavailable or access changed" /></ThemedView>;
  }
  if ((network.isConnected === false || network.isInternetReachable === false) && thread === undefined) {
    return <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Thread unavailable' }} />
      <EmptyState body="You're offline and this thread isn't available on this device." icon="thread" title="Offline unavailable" />
      <Pressable
        accessibilityRole="button"
        onPress={() => pid && gid && tid && router.replace(threadConversationHref(pid, gid, tid, context, targetMessageId) as never)}
        style={[styles.retry, { backgroundColor: theme.accent }]}>
        <ThemedText style={{ color: theme.background }} type="smallBold">Retry</ThemedText>
      </Pressable>
    </ThemedView>;
  }
  if (!trackUserId || navigation === undefined || thread === undefined) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread' }} /><EmptyState body="Opening the authorized conversation…" icon="thread" title="Loading thread" /></ThemedView>;
  }
  const source = thread.source
  const sourceDate = source && !('unavailable' in source) ? source.createdAt : null;
  const taskLinkAssistantStreamIds = threadItems.flatMap((entry) => entry.kind === 'assistant' ? [entry.stream._id] : []);
  const channelName = groups?.find((item) => item.group._id === gid)?.group.name ?? 'Channel';
  const sourceContextCard = source ? <Pressable
    accessibilityHint="Opens the source message in its Channel"
    accessibilityLabel={`Source message in ${channelName}`}
    accessibilityRole="button"
    onPress={() => pid && gid && router.push(channelHref(
      pid,
      gid,
      context,
      'unavailable' in source ? undefined : source.messageId,
    ) as never)}
    style={({ pressed }) => [
      styles.source,
      { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder },
      pressed && styles.sourcePressed,
    ]}>
    <View style={styles.sourceHeader}>
      <View style={styles.sourceBadges}>
        <View style={[styles.sourceBadge, { backgroundColor: theme.accentSoft }]}>
          <PlatformIcon color={theme.accentStrong} name="reply" size={13} />
          <ThemedText themeColor="accentStrong" type="captionBold">Source</ThemedText>
        </View>
        <View style={[styles.channelBadge, { backgroundColor: theme.backgroundElement }]}>
          <PlatformIcon color={theme.textSecondary} name="channel" size={13} />
          <ThemedText numberOfLines={1} style={styles.sourceChannel} themeColor="textSecondary" type="captionBold">#{channelName}</ThemedText>
        </View>
      </View>
      <View style={styles.sourceMeta}>
        {sourceDate ? <ThemedText themeColor="textTertiary" type="caption">{new Date(sourceDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}</ThemedText> : null}
        <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />
      </View>
    </View>
    <ThemedText numberOfLines={2} themeColor="textSecondary" type="small">
      {'unavailable' in source ? 'Reference message unavailable.' : source.body || 'Attachment message'}
    </ThemedText>
    {firstLinkedTask ? <View style={[styles.sourceTaskLink, { backgroundColor: theme.accentSoft }]}>
      <PlatformIcon color={theme.accentStrong} name="link" size={13} />
      <ThemedText numberOfLines={1} style={styles.sourceTaskLabel} themeColor="accentStrong" type="captionBold">
        {firstLinkedTask.publicKey} · {firstLinkedTask.title}
      </ThemedText>
    </View> : null}
  </Pressable> : null;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        headerTitle: () => <View style={styles.headerTitle}>
          <ThemedText numberOfLines={1} type="subtitle">{thread.thread.name}</ThemedText>
          <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">#{channelName}</ThemedText>
        </View>,
        headerLeft: () => <IconButton
          accessibilityLabel="Back to Channel"
          icon="arrow-left"
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else if (pid && gid) {
              router.replace(channelHref(pid, gid, context) as never);
            }
          }}
        />,
        headerRight: () => <IconButton accessibilityLabel="Thread options" icon="dots-horizontal" onPress={() => setToolsOpen(true)} />,
      }} />
      <ConnectivityBanner message="You’re offline. Cached replies stay available; sending will retry when you reconnect." style={styles.connection} />
      {notice ? <ThemedText accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.success }]} type="small">{notice}</ThemedText> : null}
      {error ? <ThemedText accessibilityLiveRegion="assertive" style={[styles.error, { color: theme.danger }]} type="small">{error}. Your unsent reply is still here.</ThemedText> : null}
      {readOnly ? <View style={[styles.archive, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Archived thread</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="small">This conversation is read-only.</ThemedText></View> : null}
      <TaskLinkBatchProvider
        assistantStreamIds={taskLinkAssistantStreamIds}
        enabled={releaseConfig.tasks}
        identity={taskIdentity}
        messageIds={taskLinkMessageIds}
      >
      <FlatList
          contentContainerStyle={styles.list}
          style={styles.flex}
          data={threadItems}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.key}
          ListEmptyComponent={messagePageStatus === 'LoadingFirstPage' || assistantPage.status === 'LoadingFirstPage'
            ? <ThemedText style={{ color: theme.textSecondary, padding: Spacing.three }}>Loading replies…</ThemedText>
            : <EmptyState body="Start the focused conversation." icon="thread" title="No replies yet" />}
          ListHeaderComponent={<>
            {sourceContextCard}
            {hasMoreThreadItems ? <Pressable
              accessibilityRole="button"
              disabled={messagePageStatus === 'LoadingMore' || assistantPage.status === 'LoadingMore'}
              onPress={() => {
                if (messagePageStatus === 'CanLoadMore') loadMoreMessages(50);
                if (assistantPage.status === 'CanLoadMore') assistantPage.loadMore(50);
              }}
              style={styles.loadMore}>
              <ThemedText type="smallBold">Load older replies</ThemedText>
            </Pressable> : null}
          </>}
          onScrollToIndexFailed={({ index }) => requestAnimationFrame(() => listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.5 }))}
          onViewableItemsChanged={onViewableItemsChanged}
          ref={listRef}
          // Matches conversation.tsx: Android cell clipping leaves stale colors after a theme change.
          removeClippedSubviews={false}
          renderItem={renderItem}
          viewabilityConfig={viewabilityConfig}
        />
      </TaskLinkBatchProvider>
      {!readOnly ? <Composer
        activeGroupName={thread.thread.name}
        busy={busy}
        mentionCandidatesHasMore={projectMembersPage.status === 'CanLoadMore'}
        mentionCandidatesLoading={projectMembersPage.status === 'LoadingMore'}
        mentionCandidates={mentionCandidates}
        onCancelReply={() => setReplyTo(null)}
        onChangeText={setComposer}
        onFocus={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
        onLoadMoreMentionCandidates={() => {
          if (projectMembersPage.status === 'CanLoadMore') projectMembersPage.loadMore(100);
        }}
        onSendMessage={handleSendMessage}
        replyTo={replyTo}
        value={composer}
      /> : null}
      <OptionsSheet onClose={() => setToolsOpen(false)} title="Thread" visible={toolsOpen}>
        <SheetSection>
          {!navigation.archived ? <SheetRow label={thread.following ? 'Unfollow' : 'Follow'} icon="bell-outline" onPress={() => void changeFollowing()} /> : null}
          {source && !('unavailable' in source) && pid && gid ? <SheetRow
            label="Open source Channel"
            icon="channel"
            onPress={() => { setToolsOpen(false); router.push(channelHref(pid, gid, context, source.messageId) as never); }}
          /> : null}
          {firstLinkedTask && pid ? <SheetRow
            label="View linked Task"
            icon="task"
            onPress={() => { setToolsOpen(false); router.push(taskDetailHref(pid, firstLinkedTask.publicKey, taskIdentity) as never); }}
          /> : null}
          {thread.canManage && !navigation.archived ? <SheetRow label="Rename thread" icon="edit" onPress={() => { setToolsOpen(false); setRenameOpen(true); }} /> : null}
          {thread.canManage && !navigation.archived ? <SheetRow
            label={thread.thread.status === 'active' ? 'Archive' : 'Reopen'}
            icon="clock-outline"
            onPress={() => void changeStatus()}
          /> : null}
        </SheetSection>
      </OptionsSheet>
      <OptionsSheet onClose={() => setRenameOpen(false)} title="Rename thread" visible={renameOpen}>
        <SheetSection>
          <SheetInput autoFocus label="Thread name" maxLength={100} onChangeText={setRenameValue} value={renameValue} />
          <SheetRow label="Save name" icon="check-circle" onPress={() => void saveRename()} />
        </SheetSection>
      </OptionsSheet>
      <MessageActions actions={messageActions} onClose={() => setActionsOpen(false)} visible={actionsOpen} />
      <ForwardMessageSheet
        busyTargetId={forwardBusyGroupId}
        currentGroupId={gid}
        error={forwardError}
        groups={groups}
        message={forwardTarget}
        onClose={() => { if (!forwardBusyGroupId) setForwardTarget(null); }}
        onForward={(target, note) => { void handleForward(target, note); }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  archive: { gap: 2, padding: Spacing.three },
  connection: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  error: { padding: Spacing.three },
  flex: { flex: 1 },
  headerTitle: { flexShrink: 1, minWidth: 0 },
  list: { flexGrow: 1, paddingVertical: Spacing.two },
  loadMore: { alignItems: 'center', minHeight: TouchTarget, justifyContent: 'center', padding: Spacing.two },
  notice: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  retry: { alignItems: 'center', alignSelf: 'center', borderRadius: 9, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  screen: { flex: 1 },
  channelBadge: { alignItems: 'center', borderRadius: Radius.pill, flex: 1, flexDirection: 'row', gap: 5, maxWidth: 150, minWidth: 0, paddingHorizontal: Spacing.two, paddingVertical: 4 },
  source: { borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.two, marginHorizontal: Spacing.three, marginTop: Spacing.two, padding: Spacing.three },
  sourceBadge: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: 5, paddingHorizontal: Spacing.two, paddingVertical: 4 },
  sourceBadges: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  sourceChannel: { flexShrink: 1, minWidth: 0 },
  sourceHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  sourceMeta: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: 2 },
  sourcePressed: { opacity: 0.72 },
  sourceTaskLabel: { flex: 1 },
  sourceTaskLink: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, maxWidth: '100%', paddingHorizontal: Spacing.two, paddingVertical: 5 },
});
