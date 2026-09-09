import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { useNetworkState } from 'expo-network';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Clipboard, FlatList, Platform, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { ActionButton } from '@/components/action-button';
import { Composer } from '@/components/composer';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { EmptyState } from '@/components/empty-state';
import { ForwardMessageSheet } from '@/components/forward-message-sheet';
import { IconButton } from '@/components/icon-button';
import { MessageActions } from '@/components/message-actions';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { TaskInlineCards } from '@/components/task-inline-cards';
import { ThreadRow, type DetailedMessage, type GroupedThreadItem, type ProjectMemberRow, resolveMentionIds, resolveMentionProjectMemberIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { sendComposerMessage, type ComposerSubmission, type ComposerSubmissionResult } from '@/lib/attachment-upload';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { displayText } from '@/lib/display-text';
import { useReleaseConfig } from '@/lib/release-config';
import type { MobileTaskIdentity } from '@/lib/task-navigation';
import { forwardedSourceHref, threadConversationHref } from '@/lib/thread-navigation';
import { setActivePushContext } from '@/lib/push-presentation';
import { communicationErrorMessage } from '@/lib/user-facing-error';

export default function ThreadScreen() {
  const theme = useTheme();
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
  const queryArgs = useMemo(() => trackUserId && tid && navigation?.available
    ? { userId: trackUserId, threadId: tid, actingCompanyId: cid, projectMemberId: pmid }
    : null, [cid, navigation?.available, pmid, tid, trackUserId]);
  const thread = useQuery(api.channelThreads.get, queryArgs ?? 'skip');
  const { results: messages, status: messagePageStatus, loadMore: loadMoreMessages } = usePaginatedQuery(
    api.channelThreads.listMessagePage,
    queryArgs ? { ...queryArgs, targetMessageId } : 'skip',
    { initialNumItems: 50 },
  );
  const assistantStreams = useQuery(api.assistant.listForThread, queryArgs ? { ...queryArgs, limit: 40 } : 'skip');
  const projectMembers = useQuery(api.mobile.listProjectMembers, trackUserId && pid && navigation?.available
    ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid }
    : 'skip');
  const groups = useQuery(api.mobile.listGroups, trackUserId && pid && navigation?.available
    ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid }
    : 'skip');
  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachFile = useMutation(api.messages.attachFile);
  const askTrack = useAction(api.assistant.ask);
  const markRead = useMutation(api.channelThreads.markRead);
  const setFollowing = useMutation(api.channelThreads.setFollowing);
  const setStatus = useMutation(api.channelThreads.setStatus);
  const rename = useMutation(api.channelThreads.rename);
  const createReport = useMutation(api.reports.create);
  const createTask = useMutation(api.tasks.create);
  const deleteMessage = useMutation(api.messages.remove);
  const forwardMessage = useMutation(api.messages.forwardMessage);
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<DetailedMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [actionTarget, setActionTarget] = useState<GroupedThreadItem | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [forwardTarget, setForwardTarget] = useState<DetailedMessage | null>(null);
  const [forwardBusyTargetId, setForwardBusyTargetId] = useState<string | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const sendKey = useRef<string | null>(null);
  const forwardKeys = useRef(new Map<string, string>());
  const listRef = useRef<FlatList<GroupedThreadItem>>(null);
  const memberItems = useMemo(() => (projectMembers ?? []) as ProjectMemberRow[], [projectMembers]);
  const membershipArchived = archive === '1' || navigation?.readStateImmutable === true;
  const readOnly = membershipArchived || navigation?.archived === true || thread?.thread.status === 'archived';
  const taskIdentity: MobileTaskIdentity | null = cid && pmid ? {
    archived: readOnly,
    companyId: cid,
    membershipId: pmid,
  } : null;
  const forwardGroups = useMemo(() => groups === undefined ? undefined : groups as Array<{
    group: Doc<'groups'>;
    membership: Doc<'groupMembers'>;
  }>, [groups]);

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

  useEffect(() => {
    if (thread) setRenameValue(thread.thread.name);
  }, [thread]);
  useEffect(() => {
    if (!queryArgs || messages === undefined || navigation?.readStateImmutable) return;
    void markRead(queryArgs).catch(() => undefined);
  }, [markRead, messages, navigation?.readStateImmutable, queryArgs]);

  const threadItems = useMemo<GroupedThreadItem[]>(() => {
    const uniqueMessages = [...new Map(
      ((messages ?? []) as DetailedMessage[]).map((item) => [item.message._id, item] as const),
    ).values()];
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
    return [...messageItems, ...assistantItems].sort((a, b) => a.at - b.at);
  }, [assistantStreams, messages]);
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
    setBusy(true);
    setError(null);
    try {
      // Generated inside the guard: Hermes does not guarantee
      // `crypto.randomUUID`, and a throw out here left the composer stuck busy
      // with nothing shown to the sender.
      sendKey.current ??= idempotencyKey();
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
          generateUploadUrl: () => generateUploadUrl({ groupId: gid, channelThreadId: tid, userId: trackUserId, actingCompanyId: cid, projectMemberId: pmid }),
          sendMessage: (input) => sendMessage({
            projectId: pid,
            groupId: gid,
            channelThreadId: tid,
            authorId: trackUserId,
            actingCompanyId: cid,
            projectMemberId: pmid,
            idempotencyKey: sendKey.current ?? undefined,
            body: input.body,
            mentions: resolveMentionIds(input.body, memberItems),
            mentionedProjectMemberIds: resolveMentionProjectMemberIds(input.body, memberItems),
            replyToMessageId: input.replyToMessageId as Id<'messages'> | undefined,
            notificationPreview: input.body,
          }),
        },
      });

      const { parseMentions } = await import('@track/shared');
      if (result.messageId && parseMentions(body).includes('track')) {
        await askTrack({
          projectId: pid, groupId: gid, channelThreadId: tid, requesterId: trackUserId,
          actingCompanyId: cid, projectMemberId: pmid,
          promptMessageId: result.messageId as Id<'messages'>, question: body,
        });
      }
      // Only retire the idempotency key once every attachment landed; a retry reuses the same message.
      if (result.failedIds.length === 0) sendKey.current = null;
      return result;
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'send this reply'));
      return { failedIds: payload.attachments.map((a) => a.id), messageId: null };
    } finally {
      setBusy(false);
    }
  }

  const messageActions = useMemo(() => {
    if (!actionTarget || actionTarget.kind === 'date-sep') return [];
    return [
      ...(!readOnly && actionTarget.kind === 'message' ? [{ label: 'Reply', icon: 'arrow-up' as const, onPress: () => setReplyTo(actionTarget.item) }] : []),
      ...(!readOnly && releaseConfig.tasks ? [{
        label: 'Create task',
        icon: 'plus' as const,
        onPress: () => {
          if (!pid || !gid) return;
          const source = actionTarget.kind === 'message' ? actionTarget.item.message.body : actionTarget.stream.answer;
          const reference = actionTarget.kind === 'message'
            ? { type: 'message' as const, messageId: actionTarget.item.message._id, isPrimary: true }
            : { type: 'assistant_answer' as const, assistantStreamId: actionTarget.stream._id, isPrimary: true };
          void createTask({
            projectId: pid,
            groupId: gid,
            title: source.trim().slice(0, 180) || 'Follow up',
            priority: 'none',
            references: [reference],
            idempotencyKey: `${actionTarget.key}:${Date.now()}`,
            actingCompanyId: cid,
            projectMemberId: pmid,
          });
        },
      }] : []),
      ...(!readOnly && actionTarget.kind === 'message' && forwardGroups?.some(({ group, membership }) =>
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
                    setReplyTo((current) => current?.message._id === actionTarget.item.message._id ? null : current);
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
      { label: 'Report', icon: 'alert-circle' as const, destructive: true, onPress: () => {
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
        });
      } },
    ];
  }, [actionTarget, cid, createReport, createTask, deleteMessage, forwardGroups, gid, pid, pmid, readOnly, releaseConfig.tasks, trackUserId]);

  const renderItem = useCallback<ListRenderItem<GroupedThreadItem>>(({ item }) => {
    if (item.kind === 'date-sep') return null;
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
          context ? { ...context, archived: membershipArchived } : null,
        ) as never)
      : undefined;
    return <>
      <ThreadRow
        isFirstInGroup={item.isFirstInGroup}
        isOwnMessage={item.kind === 'message' && item.item.author?._id === trackUserId}
        item={item}
        onLongPress={() => { hapticLight(); setActionTarget(item); setActionsOpen(true); }}
        onOpenForwardSource={openForwardSource}
        onSwipeReply={readOnly || item.kind !== 'message' ? undefined : () => setReplyTo(item.item)}
      />
      {releaseConfig.tasks && pid ? <TaskInlineCards
        assistantStreamId={item.kind === 'assistant' ? item.stream._id : undefined}
        identity={taskIdentity}
        messageId={item.kind === 'message' ? item.item.message._id : undefined}
        projectId={pid}
      /> : null}
    </>;
  }, [context, membershipArchived, pid, readOnly, releaseConfig.tasks, router, taskIdentity, trackUserId]);

  async function changeFollowing() {
    if (!queryArgs || !thread) return;
    setError(null);
    try {
      await setFollowing({ ...queryArgs, following: !thread.following });
      setNotice(thread.following ? 'Thread unfollowed.' : 'Thread followed.');
      setToolsOpen(false);
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'update the follow setting'));
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
    } catch (caught) {
      setError(communicationErrorMessage(caught, 'rename this thread'));
    }
  }

  if (!releaseConfig.threads || (navigation && !navigation.available) || thread === null) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread unavailable' }} /><EmptyState body={navigationUnavailableCopy(Boolean(cid))} icon="forum-outline" title="Thread unavailable or access changed" /></ThemedView>;
  }
  if ((network.isConnected === false || network.isInternetReachable === false) && thread === undefined) {
    return <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Thread unavailable' }} />
      <EmptyState body="You're offline and this thread isn't available on this device." icon="forum-outline" title="Offline unavailable" />
      <ActionButton
        label="Retry"
        onPress={() => pid && gid && tid && router.replace(threadConversationHref(pid, gid, tid, context, targetMessageId) as never)}
        style={styles.retry}
      />
    </ThemedView>;
  }
  if (!trackUserId || navigation === undefined || thread === undefined) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread' }} /><EmptyState body="Opening the authorized conversation…" icon="forum-outline" title="Loading thread" /></ThemedView>;
  }
  const source = thread.source

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{
        title: thread.thread.name,
        headerRight: () => <IconButton accessibilityLabel="Thread options" icon="dots-horizontal" onPress={() => setToolsOpen(true)} size={22} />,
      }} />
      <ConnectivityBanner message="You’re offline. Saved replies remain readable; new replies will need a connection." style={styles.connection} />
      {source ? <Pressable
        accessibilityLabel="Open the reference message in its Channel"
        accessibilityRole="link"
        onPress={() => pid && gid && router.push(channelHref(
          pid,
          gid,
          context,
          'unavailable' in source ? undefined : source.messageId,
        ) as never)}
        style={[styles.source, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={{ color: theme.textSecondary }} type="captionBold">Reference message</ThemedText>
        <ThemedText numberOfLines={2} type="small">{'unavailable' in source ? 'Reference message unavailable.' : source.body || 'Attachment message'}</ThemedText>
      </Pressable> : null}
      {notice ? <ThemedText accessibilityLiveRegion="polite" style={[styles.notice, { color: theme.success }]} type="small">{notice}</ThemedText> : null}
      {error ? <ThemedText accessibilityLiveRegion="assertive" style={[styles.error, { color: theme.danger }]} type="small">{error}. Your unsent reply is still here.</ThemedText> : null}
      {readOnly ? <View style={[styles.archive, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Archived thread</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="small">This conversation is read-only.</ThemedText></View> : null}
      <FlatList
          contentContainerStyle={styles.list}
          style={styles.flex}
          data={threadItems}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.key}
          ListEmptyComponent={messagePageStatus === 'LoadingFirstPage'
            ? <ThemedText style={{ color: theme.textSecondary, padding: Spacing.three }}>Loading replies…</ThemedText>
            : <EmptyState body="Start the focused conversation." icon="forum-outline" title="No replies yet" />}
          ListHeaderComponent={messagePageStatus === 'CanLoadMore' ? <Pressable
            accessibilityRole="button"
            onPress={() => loadMoreMessages(50)}
            style={styles.loadMore}>
            <ThemedText type="smallBold">Load older replies</ThemedText>
          </Pressable> : null}
          onScrollToIndexFailed={({ index }) => requestAnimationFrame(() => listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 0.5 }))}
          ref={listRef}
          // Matches conversation.tsx: Android cell clipping leaves stale colors after a theme change.
          removeClippedSubviews={false}
          renderItem={renderItem}
        />
      {!readOnly ? <Composer
        activeGroupName={thread.thread.name}
        busy={busy}
        onCancelReply={() => setReplyTo(null)}
        onChangeText={setComposer}
        onFocus={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
        onSendMessage={handleSendMessage}
        replyTo={replyTo}
        value={composer}
      /> : null}
      <OptionsSheet onClose={() => setToolsOpen(false)} title="Thread" visible={toolsOpen}>
        <SheetSection>
          {!navigation.archived ? <SheetRow label={thread.following ? 'Unfollow' : 'Follow'} icon="bell-outline" onPress={() => void changeFollowing()} /> : null}
          {thread.canManage && !navigation.archived ? <SheetRow
            label={thread.thread.status === 'active' ? 'Archive' : 'Reopen'}
            icon="clock-outline"
            onPress={() => void changeStatus()}
          /> : null}
        </SheetSection>
        {thread.canManage && !navigation.archived ? <SheetSection title="Rename">
          <SheetInput label="Thread name" maxLength={100} onChangeText={setRenameValue} value={renameValue} />
          <SheetRow disabled={!renameValue.trim()} label="Save name" icon="check-circle" onPress={() => void saveRename()} />
        </SheetSection> : null}
      </OptionsSheet>
      <MessageActions actions={messageActions} onClose={() => setActionsOpen(false)} visible={actionsOpen} />
      <ForwardMessageSheet
        busyTargetId={forwardBusyTargetId}
        currentGroupId={gid}
        error={forwardError}
        groups={groups === undefined ? undefined : forwardGroups}
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
  archive: { gap: 2, padding: Spacing.three },
  connection: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  error: { padding: Spacing.three },
  flex: { flex: 1 },
  list: { flexGrow: 1, paddingVertical: Spacing.two },
  loadMore: { alignItems: 'center', minHeight: TouchTarget, justifyContent: 'center', padding: Spacing.two },
  notice: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  retry: { alignSelf: 'center' },
  screen: { flex: 1 },
  source: { gap: 3, margin: Spacing.three, marginBottom: 0, padding: Spacing.three, borderRadius: Radius.large },
});
