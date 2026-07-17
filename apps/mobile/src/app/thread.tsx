import { useAction, useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import * as DocumentPicker from 'expo-document-picker';
import { useNetworkState } from 'expo-network';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { Composer } from '@/components/composer';
import { EmptyState } from '@/components/empty-state';
import { MessageActions } from '@/components/message-actions';
import { OptionsSheet, SheetInput, SheetRow, SheetSection } from '@/components/options-sheet';
import { PlatformIcon } from '@/components/platform-icon';
import { TaskInlineCards } from '@/components/task-inline-cards';
import { ThreadRow, type DetailedMessage, type GroupedThreadItem, type ProjectMemberRow, resolveMentionIds, resolveMentionProjectMemberIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { hapticLight } from '@/lib/haptics';
import { useReleaseConfig } from '@/lib/release-config';
import type { MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref } from '@/lib/thread-navigation';

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
  const [composer, setComposer] = useState('');
  const [replyTo, setReplyTo] = useState<DetailedMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [actionTarget, setActionTarget] = useState<GroupedThreadItem | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const sendKey = useRef<string | null>(null);
  const listRef = useRef<FlatList<GroupedThreadItem>>(null);
  const memberItems = useMemo(() => (projectMembers ?? []) as ProjectMemberRow[], [projectMembers]);
  const readOnly = archive === '1' || navigation?.archived === true || thread?.thread.status === 'archived';
  const taskIdentity: MobileTaskIdentity | null = cid && pmid ? {
    archived: readOnly,
    companyId: cid,
    membershipId: pmid,
  } : null;

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

  async function submitMessage() {
    if (!trackUserId || !pid || !gid || !tid || readOnly) return;
    const body = composer.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    sendKey.current ??= crypto.randomUUID();
    try {
      const { parseMentions } = await import('@track/shared');
      const messageId = await sendMessage({
        projectId: pid,
        groupId: gid,
        channelThreadId: tid,
        authorId: trackUserId,
        actingCompanyId: cid,
        projectMemberId: pmid,
        idempotencyKey: sendKey.current,
        body,
        mentions: resolveMentionIds(body, memberItems),
        mentionedProjectMemberIds: resolveMentionProjectMemberIds(body, memberItems),
        replyToMessageId: replyTo?.message._id,
        notificationPreview: body,
      });
      if (parseMentions(body).includes('track')) {
        await askTrack({ projectId: pid, groupId: gid, channelThreadId: tid, requesterId: trackUserId, actingCompanyId: cid, projectMemberId: pmid, promptMessageId: messageId, question: body });
      }
      sendKey.current = null;
      setComposer('');
      setReplyTo(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  async function pickAttachment(audioOnly = false) {
    if (!trackUserId || !pid || !gid || !tid || readOnly) return;
    const picked = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      type: audioOnly ? 'audio/*' : '*/*',
    });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    setBusy(true);
    setError(null);
    sendKey.current ??= crypto.randomUUID();
    try {
      const contentType = file.mimeType ?? 'application/octet-stream';
      const uploadUrl = await generateUploadUrl({ groupId: gid, channelThreadId: tid, userId: trackUserId, actingCompanyId: cid, projectMemberId: pmid });
      const blob = await (await fetch(file.uri)).blob();
      const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': contentType }, body: blob });
      if (!response.ok) throw new Error('upload_failed');
      const { storageId } = await response.json() as { storageId: Id<'_storage'> };
      const body = composer.trim() || (audioOnly ? 'Sent a voice note.' : `Attached ${file.name}`);
      const messageId = await sendMessage({
        projectId: pid,
        groupId: gid,
        channelThreadId: tid,
        authorId: trackUserId,
        actingCompanyId: cid,
        projectMemberId: pmid,
        idempotencyKey: sendKey.current,
        body,
        mentions: resolveMentionIds(body, memberItems),
        mentionedProjectMemberIds: resolveMentionProjectMemberIds(body, memberItems),
        replyToMessageId: replyTo?.message._id,
        notificationPreview: body,
      });
      await attachFile({ projectId: pid, groupId: gid, messageId, userId: trackUserId, actingCompanyId: cid, projectMemberId: pmid, storageId, filename: file.name, contentType, size: blob.size, kind: audioOnly ? 'voice_note' : 'file' });
      sendKey.current = null;
      setComposer('');
      setReplyTo(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't save");
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
      { label: 'Report', icon: 'trash-can-outline' as const, destructive: true, onPress: () => {
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
  }, [actionTarget, cid, createReport, createTask, gid, pid, pmid, readOnly, releaseConfig.tasks, trackUserId]);

  const renderItem = useCallback<ListRenderItem<GroupedThreadItem>>(({ item }) => {
    if (item.kind === 'date-sep') return null;
    return <>
      <ThreadRow
        isFirstInGroup={item.isFirstInGroup}
        isOwnMessage={item.kind === 'message' && item.item.author?._id === trackUserId}
        item={item}
        onLongPress={() => { hapticLight(); setActionTarget(item); setActionsOpen(true); }}
        onSwipeReply={readOnly || item.kind !== 'message' ? undefined : () => setReplyTo(item.item)}
      />
      {releaseConfig.tasks && pid ? <TaskInlineCards
        assistantStreamId={item.kind === 'assistant' ? item.stream._id : undefined}
        identity={taskIdentity}
        messageId={item.kind === 'message' ? item.item.message._id : undefined}
        projectId={pid}
      /> : null}
    </>;
  }, [pid, readOnly, releaseConfig.tasks, taskIdentity, trackUserId]);

  async function changeFollowing() {
    if (!queryArgs || !thread) return;
    setError(null);
    try {
      await setFollowing({ ...queryArgs, following: !thread.following });
      setNotice(thread.following ? 'Thread unfollowed.' : 'Thread followed.');
      setToolsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't update follow state");
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
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't update thread");
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
      setError(caught instanceof Error ? caught.message.replaceAll('_', ' ') : "Couldn't rename thread");
    }
  }

  if (!releaseConfig.threads || (navigation && !navigation.available) || thread === null) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread unavailable' }} /><EmptyState body={navigationUnavailableCopy(Boolean(cid))} icon="forum-outline" title="Thread unavailable or access changed" /></ThemedView>;
  }
  if ((network.isConnected === false || network.isInternetReachable === false) && thread === undefined) {
    return <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Thread unavailable' }} />
      <EmptyState body="You're offline and this thread isn't available on this device." icon="forum-outline" title="Offline unavailable" />
      <Pressable
        accessibilityRole="button"
        onPress={() => pid && gid && tid && router.replace(threadConversationHref(pid, gid, tid, context, targetMessageId) as never)}
        style={[styles.retry, { backgroundColor: theme.accent }]}>
        <ThemedText style={{ color: '#1b1917' }} type="smallBold">Retry</ThemedText>
      </Pressable>
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
        headerRight: () => <Pressable accessibilityLabel="Thread options" hitSlop={8} onPress={() => setToolsOpen(true)} style={styles.headerButton}><PlatformIcon color={theme.text} name="dots-horizontal" size={22} /></Pressable>,
      }} />
      {source ? <Pressable
        onPress={() => pid && gid && router.push(channelHref(
          pid,
          gid,
          context,
          'unavailable' in source ? undefined : source.messageId,
        ) as never)}
        style={[styles.source, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="code">SOURCE MESSAGE</ThemedText>
        <ThemedText numberOfLines={2} type="small">{'unavailable' in source ? 'Source message unavailable.' : source.body || 'Attachment message'}</ThemedText>
      </Pressable> : null}
      {notice ? <ThemedText accessibilityLiveRegion="polite" style={styles.notice} type="small">{notice}</ThemedText> : null}
      {error ? <ThemedText accessibilityLiveRegion="assertive" style={styles.error} type="small">{error}. Your unsent reply is still here.</ThemedText> : null}
      {readOnly ? <View style={[styles.archive, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Archived thread</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="small">This conversation is read-only.</ThemedText></View> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <FlatList
          contentContainerStyle={styles.list}
          data={threadItems}
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
          renderItem={renderItem}
        />
        {!readOnly ? <Composer
          activeGroupName={thread.thread.name}
          busy={busy}
          isRecording={false}
          onAttach={() => void pickAttachment(false)}
          onCancelReply={() => setReplyTo(null)}
          onChangeText={setComposer}
          onRecord={() => void pickAttachment(true)}
          onSend={() => void submitMessage()}
          replyTo={replyTo}
          value={composer}
        /> : null}
      </KeyboardAvoidingView>
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
          <SheetInput label="THREAD NAME" onChangeText={setRenameValue} value={renameValue} />
          <SheetRow label="Save name" icon="check-circle" onPress={() => void saveRename()} />
        </SheetSection> : null}
      </OptionsSheet>
      <MessageActions actions={messageActions} onClose={() => setActionsOpen(false)} visible={actionsOpen} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  archive: { gap: 2, padding: Spacing.three },
  error: { color: '#b91c1c', padding: Spacing.three },
  flex: { flex: 1 },
  headerButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  list: { flexGrow: 1, paddingVertical: Spacing.two },
  loadMore: { alignItems: 'center', minHeight: TouchTarget, justifyContent: 'center', padding: Spacing.two },
  notice: { color: '#166534', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  retry: { alignItems: 'center', alignSelf: 'center', borderRadius: 9, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  screen: { flex: 1 },
  source: { gap: 3, margin: Spacing.three, marginBottom: 0, padding: Spacing.three, borderRadius: 10 },
});
