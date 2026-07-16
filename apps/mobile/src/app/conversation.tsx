import { useAction, useMutation, useQuery } from 'convex/react';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';
import { api } from '../../../../convex/_generated/api';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';
import { useTrackUser } from '@/contexts/track-user-context';
import { Composer } from '@/components/composer';
import { MessageActions } from '@/components/message-actions';
import { PlatformIcon } from '@/components/platform-icon';
import { DateSeparator, ThreadRow, type DetailedMessage, type GroupedThreadItem, type ProjectMemberRow, resolveMentionIds } from '@/components/thread-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OptionsSheet, SheetSection, SheetRow } from '@/components/options-sheet';
import { Spacing, TouchTarget } from '@/constants/theme';
import { hapticLight, hapticMedium, hapticDestructive } from '@/lib/haptics';
import { useTheme } from '@/hooks/use-theme';
import { channelHref, navigationUnavailableCopy } from '@/lib/company-navigation';
import { useReleaseConfig } from '@/lib/release-config';
import { threadConversationHref, threadListHref } from '@/lib/thread-navigation';

const reportReasons = ['inaccurate', 'unsafe', 'spam', 'harassment', 'privacy', 'other'] as const;

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
  const { groupId, projectId, companyId, membershipId, archive } = useLocalSearchParams<{ groupId: string; projectId: string; companyId?: string; membershipId?: string; archive?: string }>();

  const sendMessage = useMutation(api.messages.send);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const attachFile = useMutation(api.messages.attachFile);
  const askTrack = useAction(api.assistant.ask);
  const markRead = useMutation(api.mobile.markGroupRead);
  const setLastActive = useMutation(api.mobile.setLastActiveContext);
  const setGlobalNotif = useMutation(api.notifications.setGlobalMode);
  const setGroupNotif = useMutation(api.notifications.setGroupMode);
  const createReport = useMutation(api.reports.create);

  const gid = groupId as Id<'groups'> | undefined;
  const pid = projectId as Id<'projects'> | undefined;
  const cid = companyId as Id<'companies'> | undefined;
  const pmid = membershipId as Id<'projectMembers'> | undefined;
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && pid && gid ? { userId: trackUserId, projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');
  const readOnly = archive === '1' || navigation?.archived === true;

  const groups = useQuery(api.mobile.listGroups, trackUserId && pid && navigation?.available ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');
  const messages = useQuery(api.messages.listDetailed, trackUserId && gid && navigation?.available ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, limit: 120 } : 'skip');
  const assistantStreams = useQuery(api.assistant.listForGroup, trackUserId && gid && navigation?.available ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, limit: 40 } : 'skip');
  const notifSettings = useQuery(api.notifications.getSettings, trackUserId ? { userId: trackUserId, projectMemberId: pmid } : 'skip');
  const projectMembers = useQuery(api.mobile.listProjectMembers, trackUserId && pid && navigation?.available ? { userId: trackUserId, projectId: pid, actingCompanyId: cid, projectMemberId: pmid } : 'skip');

  const listRef = useRef<FlatList<GroupedThreadItem>>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recordingState = useAudioRecorderState(recorder, 250);

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

  const groupItems = useMemo(() => (groups ?? []) as { group: Doc<'groups'>; membership: Doc<'groupMembers'>; lastMessage: Doc<'messages'> | null; unreadCount: number }[], [groups]);
  const memberItems = useMemo(() => (projectMembers ?? []) as ProjectMemberRow[], [projectMembers]);
  const activeGroup = groupItems.find((g) => g.group._id === gid)?.group ?? null;
  const globalMode = notifSettings?.global?.globalMode ?? 'mentions';
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
    let lastWasDateSep = false;

    for (const raw of sorted) {
      const dateStr = new Date(raw.at).toDateString();
      if (dateStr !== lastDateStr) {
        result.push({ kind: 'date-sep', key: `sep-${raw.at}`, at: raw.at, label: dateSepLabel(raw.at) });
        lastDateStr = dateStr;
        lastWasDateSep = true;
      }

      const authorKey = raw.kind === 'message' ? (raw.item.author?._id ?? 'anon') : '__assistant__';
      const tooLong = raw.at - lastAt > 5 * 60 * 1000;
      const isFirstInGroup = lastWasDateSep || authorKey !== lastAuthorKey || tooLong;

      result.push({ ...raw, isFirstInGroup });
      lastAuthorKey = authorKey;
      lastAt = raw.at;
      lastWasDateSep = false;
    }

    return result;
  }, [assistantStreams, messages]);

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
      {
        label: 'Report',
        icon: 'trash-can-outline' as const,
        destructive: true,
        onPress: () => setReportTarget(actionTarget),
      },
    ];
  }, [actionTarget, cid, gid, pid, pmid, readOnly, releaseConfig.threads, router]);

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
    if (!trackUserId || !gid || readOnly || threadItems.length === 0) return;
    const last = [...threadItems].reverse().find((i) => i.kind === 'message');
    void markRead({
      userId: trackUserId, groupId: gid,
      actingCompanyId: cid, projectMemberId: pmid,
      lastReadMessageId: last?.kind === 'message' ? last.item.message._id : undefined,
    }).catch(() => undefined);
  }, [cid, gid, markRead, pmid, readOnly, threadItems, trackUserId]);

  async function withBusy(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  async function handleSend() {
    if (!trackUserId || !pid || !gid) return;
    const body = composer.trim();
    if (!body) return;
    hapticMedium();
    const replyToMessageId = replyTo?.message._id;
    setComposer('');
    setReplyTo(null);
    const pendingId = Date.now().toString();
    setPendingMessages((prev) => [...prev, { id: pendingId, body, at: Date.now() }]);
    await withBusy('send', async () => {
      const { parseMentions } = await import('@track/shared');
      const messageId = await sendMessage({
        projectId: pid, groupId: gid, authorId: trackUserId,
        actingCompanyId: cid, projectMemberId: pmid,
        body, mentions: resolveMentionIds(body, memberItems),
        replyToMessageId, notificationPreview: body,
      });
      if (parseMentions(body).includes('track')) {
        await askTrack({ projectId: pid, groupId: gid, requesterId: trackUserId, actingCompanyId: cid, projectMemberId: pmid, promptMessageId: messageId, question: body });
      }
    });
  }

  async function uploadAttachment(input: { uri: string; filename: string; contentType: string; body: string; kind?: 'file' | 'voice_note'; durationMs?: number }) {
    if (!trackUserId || !pid || !gid) return;
    await withBusy(input.kind ?? 'attach', async () => {
      const uploadUrl = await generateUploadUrl({ groupId: gid, userId: trackUserId, actingCompanyId: cid, projectMemberId: pmid });
      const blob = await (await fetch(input.uri)).blob();
      const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': input.contentType }, body: blob });
      if (!res.ok) throw new Error('upload_failed');
      const { storageId } = await res.json() as { storageId: Id<'_storage'> };
      const messageId = await sendMessage({
        projectId: pid, groupId: gid, authorId: trackUserId,
        actingCompanyId: cid, projectMemberId: pmid,
        body: input.body, mentions: resolveMentionIds(input.body, memberItems),
        replyToMessageId: replyTo?.message._id, notificationPreview: input.body,
      });
      await attachFile({
        projectId: pid, groupId: gid, messageId, userId: trackUserId,
        actingCompanyId: cid, projectMemberId: pmid,
        storageId, filename: input.filename, contentType: input.contentType,
        size: blob.size, kind: input.kind, durationMs: input.durationMs,
      });
      setComposer('');
      setReplyTo(null);
    });
  }

  async function pickDocument() {
    hapticLight();
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    await uploadAttachment({ uri: file.uri, filename: file.name, contentType: file.mimeType ?? 'application/octet-stream', body: composer.trim() || `Attached ${file.name}`, kind: 'file' });
  }

  async function toggleRecording() {
    if (recordingState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) return;
      await uploadAttachment({ uri, filename: `voice-note-${Date.now()}.m4a`, contentType: 'audio/mp4', body: composer.trim() || 'Sent a voice note.', kind: 'voice_note', durationMs: Math.max(0, Math.round(recordingState.durationMillis)) });
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return;
    await recorder.prepareToRecordAsync();
    recorder.record();
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
      />
    );
  }, [readOnly, trackUserId]);

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.flex}>
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.thread}
          contentInsetAdjustmentBehavior="automatic"
          data={threadItems}
          initialNumToRender={24}
          keyExtractor={(item) => item.key}
          maxToRenderPerBatch={16}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          removeClippedSubviews={false}
          renderItem={renderItem}
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

        {readOnly ? <View style={[styles.archiveBanner, { backgroundColor: theme.backgroundElement }]}><ThemedText type="smallBold">Read-only Company exit archive</ThemedText><ThemedText style={{ color: theme.textSecondary }} type="small">Messages and frozen memory stop at the Company exit cutoff.</ThemedText></View> : <Composer
          activeGroupName={activeGroup?.name ?? null}
          busy={busy === 'send'}
          isRecording={recordingState.isRecording}
          recordingDuration={recordingState.durationMillis}
          onAttach={() => void pickDocument()}
          onCancelReply={() => setReplyTo(null)}
          onChangeText={setComposer}
          onRecord={() => void toggleRecording()}
          onSend={() => void handleSend()}
          replyTo={replyTo}
          value={composer}
        />}
      </KeyboardAvoidingView>

      <OptionsSheet onClose={() => setGroupSwitchOpen(false)} title="Switch Group" visible={groupSwitchOpen}>
        <SheetSection>
          {groupItems.map((item) => (
            <SheetRow
              key={item.group._id}
              label={item.group.name}
              selected={item.group._id === gid}
              onPress={() => {
                setGroupSwitchOpen(false);
                hapticLight();
                router.replace(channelHref(pid!, item.group._id, cid && pmid ? { archived: readOnly, companyId: cid, membershipId: pmid } : null));
              }}
            />
          ))}
        </SheetSection>
      </OptionsSheet>

      <OptionsSheet onClose={() => setToolsOpen(false)} title="Notifications" visible={toolsOpen}>
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
        <SheetSection title="This Group">
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
                <ThemedText type="code">{r}</ThemedText>
              </Pressable>
            ))}
          </View>
        </SheetSection>
        <Pressable
          disabled={busy === 'report'}
          onPress={() => void submitReport()}
          style={[styles.reportButton, { backgroundColor: busy === 'report' ? theme.hairline : '#b91c1c' }]}>
          <ThemedText style={{ color: '#fff' }} type="smallBold">Submit Report</ThemedText>
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
