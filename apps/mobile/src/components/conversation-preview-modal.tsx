import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { usePaginatedQuery, useQuery } from 'convex/react';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';

import { api } from '../../../../convex/_generated/api';
import { AssistantMessage } from '@/components/chat/assistant-message';
import { MessageBubble } from '@/components/chat/message-bubble';
import type { DetailedMessage } from '@/components/chat/types';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConversationPreview } from '@/lib/conversation-preview';

type PreviewItem =
  | { kind: 'date-sep'; key: string; at: number; label: string }
  | { kind: 'message'; key: string; at: number; item: DetailedMessage; isFirstInGroup: boolean }
  | { kind: 'assistant'; key: string; at: number; stream: Doc<'assistantStreams'>; isFirstInGroup: boolean };

const FIVE_MINUTES = 5 * 60 * 1000;
const NOOP = () => {};

export function ConversationPreviewModal({ onClose, onOpen, preview }: {
  onClose: () => void;
  onOpen: () => void;
  preview: ConversationPreview | null;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { trackUserId } = useTrackUser();
  const scope = preview?.scope;
  const projectId = scope?.projectId as Id<'projects'> | undefined;
  const groupId = scope?.groupId as Id<'groups'> | undefined;
  const companyId = scope?.companyId as Id<'companies'> | undefined;
  const membershipId = scope?.membershipId as Id<'projectMembers'> | undefined;
  const threadId = scope?.threadId as Id<'channelThreads'> | undefined;
  const navigation = useQuery(api.mobile.resolveNavigation, trackUserId && projectId && groupId
    ? { userId: trackUserId, projectId, groupId, actingCompanyId: companyId, projectMemberId: membershipId }
    : 'skip');
  const channelMessages = usePaginatedQuery(api.messages.listPage,
    trackUserId && groupId && preview?.kind === 'channel' && navigation?.available
      ? { userId: trackUserId, groupId, actingCompanyId: companyId, projectMemberId: membershipId }
      : 'skip',
    { initialNumItems: 40 });
  const channelAssistant = usePaginatedQuery(api.assistant.listForGroupPage,
    trackUserId && groupId && preview?.kind === 'channel' && navigation?.available
      ? { userId: trackUserId, groupId, actingCompanyId: companyId, projectMemberId: membershipId }
      : 'skip',
    { initialNumItems: 40 });
  const threadArgs = trackUserId && threadId && preview?.kind === 'thread' && navigation?.available
    ? { userId: trackUserId, threadId, actingCompanyId: companyId, projectMemberId: membershipId }
    : null;
  const thread = useQuery(api.channelThreads.get, threadArgs ?? 'skip');
  const threadMessages = usePaginatedQuery(api.channelThreads.listMessagePage,
    threadArgs ? { ...threadArgs } : 'skip',
    { initialNumItems: 40 });
  const threadAssistant = usePaginatedQuery(api.assistant.listForThreadPage,
    threadArgs ? { ...threadArgs } : 'skip',
    { initialNumItems: 40 });

  const messageRows = (preview?.kind === 'thread' ? threadMessages.results : channelMessages.results) as DetailedMessage[] | undefined;
  const assistantRows = (preview?.kind === 'thread' ? threadAssistant.results : channelAssistant.results) as Doc<'assistantStreams'>[] | undefined;
  const items = useMemo(() => buildPreviewItems(messageRows ?? [], assistantRows ?? []), [assistantRows, messageRows]);
  const loading = preview?.kind === 'thread'
    ? threadMessages.status === 'LoadingFirstPage' || threadAssistant.status === 'LoadingFirstPage'
    : channelMessages.status === 'LoadingFirstPage' || channelAssistant.status === 'LoadingFirstPage';
  const canLoadMore = preview?.kind === 'thread'
    ? threadMessages.status === 'CanLoadMore' || threadAssistant.status === 'CanLoadMore'
    : channelMessages.status === 'CanLoadMore' || channelAssistant.status === 'CanLoadMore';
  const loadMore = () => {
    if (preview?.kind === 'thread') {
      if (threadMessages.status === 'CanLoadMore') threadMessages.loadMore(40);
      if (threadAssistant.status === 'CanLoadMore') threadAssistant.loadMore(40);
    } else {
      if (channelMessages.status === 'CanLoadMore') channelMessages.loadMore(40);
      if (channelAssistant.status === 'CanLoadMore') channelAssistant.loadMore(40);
    }
  };
  const title = preview?.kind === 'thread' && thread?.thread.name ? thread.thread.name : preview?.title ?? '';
  const unavailable = Boolean(preview?.scope && navigation?.available === false);
  const source = preview?.kind === 'thread' ? thread?.source : null;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={Boolean(preview)}>
      <View style={[styles.overlay, { paddingBottom: insets.bottom + Spacing.three, paddingTop: insets.top + Spacing.three }]}>
        <Pressable accessibilityLabel="Dismiss conversation preview" accessibilityRole="button" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]} />
        {preview ? <ThemedView accessibilityViewIsModal style={[styles.card, { backgroundColor: theme.homeBackground, borderColor: theme.homeBorder }]}>
          <View style={styles.header}>
            <View style={[styles.channelMark, { backgroundColor: theme.accentSoft }]}><PlatformIcon color={theme.accentStrong} name={preview.kind === 'thread' ? 'thread' : 'channel'} size={19} weight="regular" /></View>
            <View style={styles.headingCopy}>
              <ThemedText numberOfLines={1} type="title">{title}</ThemedText>
              <View style={styles.contextLine}>
                <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{preview.projectName}</ThemedText>
                <PlatformIcon color={theme.textTertiary} name="chevron-right" size={14} weight="regular" />
                <PlatformIcon color={theme.accentStrong} name="channel" size={14} weight="regular" />
                <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">#{preview.channelName}</ThemedText>
              </View>
            </View>
            <Pressable accessibilityLabel="Close conversation preview" accessibilityRole="button" hitSlop={8} onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder }]}>
              <PlatformIcon color={theme.textSecondary} name="close" size={18} weight="regular" />
            </Pressable>
          </View>
          {preview.unread ? <View style={[styles.unread, { backgroundColor: theme.accentSoft }]}><View style={[styles.unreadDot, { backgroundColor: theme.accentStrong }]} /><ThemedText themeColor="accentStrong" type="captionBold">Unread activity</ThemedText></View> : null}
          <View style={[styles.chatSurface, { backgroundColor: theme.homeBackground, borderColor: theme.homeBorder }]}>
            {source ? <View style={[styles.sourceCard, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
              <View style={styles.sourceHeader}>
                <View style={styles.sourceBadges}>
                  <View style={[styles.sourceBadge, { backgroundColor: theme.accentSoft }]}>
                    <PlatformIcon color={theme.accentStrong} name="reply" size={13} />
                    <ThemedText themeColor="accentStrong" type="captionBold">Source</ThemedText>
                  </View>
                  <View style={[styles.sourceChannel, { backgroundColor: theme.backgroundElement }]}>
                    <PlatformIcon color={theme.textSecondary} name="channel" size={13} />
                    <ThemedText numberOfLines={1} themeColor="textSecondary" type="captionBold">#{preview.channelName}</ThemedText>
                  </View>
                </View>
                {!('unavailable' in source) ? <ThemedText themeColor="textTertiary" type="caption">{new Date(source.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</ThemedText> : null}
              </View>
              <ThemedText numberOfLines={2} themeColor="textSecondary" type="small">
                {'unavailable' in source ? 'Reference message unavailable.' : source.body || 'Attachment message'}
              </ThemedText>
            </View> : null}
            {unavailable ? <View style={styles.state}><ThemedText type="smallBold">Conversation unavailable</ThemedText><ThemedText themeColor="textSecondary" type="caption">You no longer have access to this conversation.</ThemedText></View>
              : loading ? <View accessibilityLiveRegion="polite" style={styles.state}><ThemedText themeColor="textSecondary" type="caption">Loading conversation…</ThemedText></View>
                : <FlatList
                  contentContainerStyle={styles.messageList}
                  data={[...items].reverse()}
                  inverted
                  keyExtractor={(item) => item.key}
                  ListEmptyComponent={<View style={styles.state}><ThemedText themeColor="textSecondary" type="caption">No messages yet. Open this {preview.kind} to start the conversation.</ThemedText></View>}
                  onEndReached={canLoadMore ? loadMore : undefined}
                  onEndReachedThreshold={0.3}
                  renderItem={({ item }) => item.kind === 'date-sep'
                    ? <View style={styles.dateRow}><View style={[styles.datePill, { backgroundColor: theme.backgroundElement }]}><ThemedText themeColor="textSecondary" type="captionBold">{item.label}</ThemedText></View></View>
                    : item.kind === 'assistant'
                      ? <AssistantMessage isFirstInGroup={item.isFirstInGroup} onLongPress={NOOP} stream={item.stream} timeLabel={previewTime(item.at)} />
                      : <MessageBubble isFirstInGroup={item.isFirstInGroup} isOwnMessage={item.item.author?._id === trackUserId} message={item.item} onLongPress={NOOP} timeLabel={previewTime(item.at)} />}
                  showsVerticalScrollIndicator={false}
                  style={styles.list}
                />}
            <Pressable accessibilityHint={`Opens the full ${preview.kind}`} accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.composerPreview, { backgroundColor: theme.backgroundElement, borderColor: theme.homeBorder, opacity: pressed ? 0.76 : 1 }]}>
              <View style={[styles.composerMark, { backgroundColor: theme.backgroundSelected }]}><PlatformIcon color={theme.textSecondary} name="plus" size={18} weight="regular" /></View>
              <ThemedText style={styles.composerHint} themeColor="textTertiary" type="small">Open {preview.kind === 'thread' ? 'thread' : 'Channel'} to reply…</ThemedText>
              <PlatformIcon color={theme.accentStrong} name="chevron-right" size={19} weight="regular" />
            </Pressable>
          </View>
        </ThemedView> : null}
      </View>
    </Modal>
  );
}

function buildPreviewItems(messages: DetailedMessage[], streams: Doc<'assistantStreams'>[]): PreviewItem[] {
  const uniqueMessages = [...new Map(messages.map((item) => [String(item.message._id), item] as const)).values()];
  const uniqueStreams = [...new Map(streams.map((item) => [String(item._id), item] as const)).values()];
  const sorted: Array<Extract<PreviewItem, { kind: 'message' | 'assistant' }>> = [
    ...uniqueMessages.map((item) => ({ kind: 'message' as const, key: String(item.message._id), at: item.message.createdAt, item, isFirstInGroup: true })),
    ...uniqueStreams.map((stream) => ({ kind: 'assistant' as const, key: String(stream._id), at: stream.createdAt, stream, isFirstInGroup: true })),
  ].sort((left, right) => left.at - right.at);
  const result: PreviewItem[] = [];
  let lastDate = '';
  let lastAuthor = '';
  let lastAt = 0;
  for (const row of sorted) {
    const date = new Date(row.at).toDateString();
    if (date !== lastDate) {
      result.push({ kind: 'date-sep', key: `date:${date}`, at: row.at, label: previewDate(row.at) });
      lastDate = date;
    }
    const author = row.kind === 'message' ? String(row.item.author?._id ?? 'anon') : 'assistant';
    const isFirstInGroup = author !== lastAuthor || row.at - lastAt > FIVE_MINUTES || result.at(-1)?.kind === 'date-sep';
    result.push({ ...row, isFirstInGroup });
    lastAuthor = author;
    lastAt = row.at;
  }
  return result;
}

function previewDate(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function previewTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', borderCurve: 'continuous', borderRadius: Radius.xlarge, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 16px 40px rgba(0,0,0,0.24)', gap: Spacing.three, height: '78%', maxHeight: 760, maxWidth: 520, minHeight: 360, overflow: 'hidden', padding: Spacing.three, width: '100%' },
  channelMark: { alignItems: 'center', borderRadius: Radius.pill, height: 40, justifyContent: 'center', width: 40 },
  closeButton: { alignItems: 'center', borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth, height: TouchTarget, justifyContent: 'center', width: TouchTarget },
  composerHint: { flex: 1, minWidth: 0 },
  composerMark: { alignItems: 'center', borderRadius: Radius.pill, height: 34, justifyContent: 'center', width: 34 },
  composerPreview: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, minHeight: TouchTarget, paddingHorizontal: Spacing.two },
  contextLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  datePill: { borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  dateRow: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.two },
  headingCopy: { flex: 1, gap: Spacing.one, minWidth: 0 },
  header: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  list: { flex: 1 },
  messageList: { flexGrow: 1, justifyContent: 'flex-end', paddingBottom: Spacing.two },
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.three },
  chatSurface: { borderColor: 'transparent', borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: Spacing.two, minHeight: 0, overflow: 'hidden', padding: Spacing.two },
  sourceBadge: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  sourceBadges: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, minWidth: 0 },
  sourceCard: { borderCurve: 'continuous', borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.one, marginBottom: Spacing.two, padding: Spacing.two },
  sourceChannel: { alignItems: 'center', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.one, maxWidth: 170, minWidth: 0, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  sourceHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' },
  state: { alignItems: 'center', flex: 1, gap: Spacing.two, justifyContent: 'center', minHeight: 120, padding: Spacing.four },
  unread: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.pill, flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  unreadDot: { borderRadius: Radius.pill, height: 7, width: 7 },
});
