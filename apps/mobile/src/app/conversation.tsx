import { useAction, useMutation, useQuery } from 'convex/react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Platform, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { Composer } from '@/components/composer';
import { MessageActions } from '@/components/message-actions';
import { PlatformIcon } from '@/components/platform-icon';
import { TaskInlineCards } from '@/components/task-inline-cards';
import { DateSeparator, ThreadRow, type DetailedMessage, type GroupedThreadItem, type ProjectMemberRow, resolveMentionIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OptionsSheet, SheetSection, SheetRow } from '@/components/options-sheet';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { sendComposerMessage, type ComposerSubmission, type ComposerSubmissionResult } from '@/lib/attachment-upload';
import { hapticLight, hapticMedium, hapticDestructive } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { buildMentionCandidates } from '@/lib/mention-autocomplete';
import { useReleaseConfig } from '@/lib/release-config';
import type { MobileTaskIdentity } from '@/lib/task-navigation';
import { threadConversationHref, threadListHref } from '@/lib/thread-navigation';
import { setActivePushContext } from '@/lib/push-presentation';

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
  const readOnly = archive === '1' || navigation?.archived === true;
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
  const globalMode = notifSettings?.global?.globalMode ?? 'all';
  const groupMode = notifSettings?.groups?.find((g) => g.groupId === gid)?.mode ?? 'inherit';

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
          const source = actionTarget.kind === 'message' ? actionTarget.item.message.body : actionTarget.stream.answer;
          const reference = actionTarget.kind === 'message'
            ? { type: 'message' as const, messageId: actionTarget.item.message._id, isPrimary: true }
            : { type: 'assistant_answer' as const, assistantStreamId: actionTarget.stream._id, isPrimary: true };
          if (!pid || !gid) return;
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
  }, [actionTarget, cid, createTask, deleteMessage, gid, pid, pmid, readOnly, releaseConfig.tasks, releaseConfig.threads, router, trackUserId]);

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
  }, [cid, gid, pid, pmid, readOnly, releaseConfig.tasks, releaseConfig.threads, router, taskIdentity, trackCardRow, trackUserId]);

  if (navigation && !navigation.available) return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Channel unavailable' }} /><View style={styles.empty}><ThemedText type="subtitle">Channel unavailable</ThemedText><ThemedText style={{ color: theme.textSecondary }}>{navigationUnavailableCopy(Boolean(cid))}</ThemedText></View></ThemedView>;

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen
        options={{
          headerTransparent: Platform.OS === 'ios',
          headerBlurEffect: 'systemMaterial',
          headerTitle: () => (
            <Pressable
              hitSlop={8}
              onPress={() => { hapticLight(); setGroupSwitchOpen(true); }}
              style={styles.headerTitle}>
              <ThemedText numberOfLines={1} type="smallBold">{activeGroup?.name ?? 'Conversation'}</ThemedText>
              <PlatformIcon color={theme.textSecondary} name="chevron-down" size={16} />
            </Pressable>
          ),
          headerRight: () => !readOnly ? (
            <Pressable
              accessibilityLabel="Notifications"
              android_ripple={{ color: theme.backgroundSelected, borderless: true }}
              hitSlop={8}
              onPress={() => { hapticLight(); setToolsOpen(true); }}
              style={styles.headerButton}>
              <PlatformIcon color={theme.text} name="dots-horizontal" size={22} />
            </Pressable>
          ) : null,
        }}
      />

      <View style={styles.flex}>
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

      <OptionsSheet onClose={() => setToolsOpen(false)} title="Notifications" visible={toolsOpen}>
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
                key={r}
                onPress={() => setReportReason(r)}
                style={[styles.reasonChip, { backgroundColor: reportReason === r ? theme.backgroundSelected : theme.backgroundElement }]}>
                <ThemedText type="small">{reportReasonLabels[r]}</ThemedText>
              </Pressable>
            ))}
          </View>
        </SheetSection>
        <Pressable
          disabled={busy === 'report'}
          onPress={() => void submitReport()}
          style={[styles.reportButton, { backgroundColor: busy === 'report' ? theme.hairline : theme.danger }]}>
          <ThemedText style={{ color: theme.background }} type="smallBold">Submit report</ThemedText>
        </Pressable>
      </OptionsSheet>

      <MessageActions
        visible={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        actions={messageActions}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  archiveBanner: { gap: Spacing.one, padding: Spacing.three },
  empty: { alignItems: 'center', padding: Spacing.six },
  flex: { flex: 1 },
  jumpToLatest: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: Spacing.three,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: Spacing.three,
    width: 40,
  },
  headerButton: { alignItems: 'center', height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  headerTitle: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  pendingAvatarSpacer: { width: 36 },
  pendingBody: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two, minWidth: 0, opacity: 0.6 },
  pendingRow: { flexDirection: 'row', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 2 },
  pendingText: { flex: 1 },
  reasonChip: { borderRadius: 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, padding: Spacing.three },
  reportButton: { alignItems: 'center', borderRadius: 10, justifyContent: 'center', minHeight: 46, paddingHorizontal: Spacing.four },
  screen: { flex: 1 },
  thread: { paddingBottom: Spacing.two, paddingTop: Spacing.two },
});
