import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { EmptyState } from '@/components/empty-state';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { SkeletonList } from '@/components/skeleton-row';
import { useTrackUser } from '@/contexts/track-user-context';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { idempotencyKey } from '@/lib/idempotency';
import { useReleaseConfig } from '@/lib/release-config';
import { threadConversationHref } from '@/lib/thread-navigation';

type ThreadListRow = {
  key: string;
  groupId: Id<'groups'> | undefined;
  threadId: Id<'channelThreads'>;
  messageId?: Id<'messages'>;
  title: string;
  subtitle: string;
  unread: boolean;
};

export default function ThreadsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const releaseConfig = useReleaseConfig();
  const { trackUserId } = useTrackUser();
  const { groupId, projectId, companyId, membershipId, archive, sourceMessageId } = useLocalSearchParams<{
    groupId: string;
    projectId: string;
    companyId?: string;
    membershipId?: string;
    archive?: string;
    sourceMessageId?: string;
  }>();
  const gid = groupId as Id<'groups'> | undefined;
  const pid = projectId as Id<'projects'> | undefined;
  const cid = companyId as Id<'companies'> | undefined;
  const pmid = membershipId as Id<'projectMembers'> | undefined;
  const sourceId = sourceMessageId as Id<'messages'> | undefined;
  const context = cid && pmid ? { companyId: cid, membershipId: pmid, archived: archive === '1' } : null;
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createKey = useRef<string | null>(null);
  const createThread = useMutation(api.channelThreads.create);
  const navigation = useQuery(
    api.mobile.resolveNavigation,
    releaseConfig.threads && trackUserId && pid && gid
      ? { userId: trackUserId, projectId: pid, groupId: gid, actingCompanyId: cid, projectMemberId: pmid }
      : 'skip',
  );
  const threads = useQuery(
    api.channelThreads.list,
    releaseConfig.threads && trackUserId && gid && navigation?.available
      ? { userId: trackUserId, groupId: gid, actingCompanyId: cid, projectMemberId: pmid, status }
      : 'skip',
  );
  const searchTerm = searchQuery.trim();
  const searchResults = useQuery(
    api.search.project,
    releaseConfig.threads && trackUserId && pid && navigation?.available && searchTerm.length >= 2
      ? {
          userId: trackUserId,
          projectId: pid,
          actingCompanyId: cid,
          projectMemberId: pmid,
          filter: 'all',
          limit: 12,
          query: searchTerm,
        }
      : 'skip',
  );
  const searchActive = searchTerm.length >= 2;
  const rows = useMemo<ThreadListRow[]>(() => searchActive
    ? [
        ...(searchResults?.threads ?? []).map((item) => ({
          key: `thread-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: undefined,
          title: item.title,
          subtitle: `${item.preview} · ${item.groupName}`,
          unread: false,
        })),
        ...(searchResults?.messages ?? []).flatMap((item) => item.threadId ? [{
          key: `message-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: item.messageId,
          title: item.threadName ?? 'Thread reply',
          subtitle: item.preview,
          unread: false,
        }] : []),
        ...(searchResults?.files ?? []).flatMap((item) => item.threadId ? [{
          key: `file-${item.id}`,
          groupId: item.groupId,
          threadId: item.threadId,
          messageId: item.messageId,
          title: item.title,
          subtitle: `${item.threadName ?? 'Thread attachment'} · ${item.groupName}`,
          unread: false,
        }] : []),
      ]
    : (threads ?? []).map((item) => ({
        key: `thread-${item.thread._id}`,
        groupId: gid,
        threadId: item.thread._id,
        messageId: undefined,
        title: item.thread.name,
        subtitle: `${item.replyCount} ${item.replyCount === 1 ? 'reply' : 'replies'}${item.following ? ' · Following' : ''}`,
        unread: item.unread,
      })), [searchActive, searchResults, threads]);
  const readOnly = archive === '1' || navigation?.archived === true;

  async function submit() {
    if (!trackUserId || !pid || !gid || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      // Generated inside the guard: a throw here used to strand the button on
      // "Starting…" with the rejection swallowed by the caller's `void`.
      createKey.current ??= idempotencyKey();
      const threadId = await createThread({
        projectId: pid,
        groupId: gid,
        creatorId: trackUserId,
        actingCompanyId: cid,
        projectMemberId: pmid,
        sourceMessageId: sourceId,
        idempotencyKey: createKey.current,
        name,
      });
      createKey.current = null;
      router.replace(threadConversationHref(pid, gid, threadId, context) as never);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message.split('\n')[0].replaceAll('_', ' ').trim()
        : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  if (!releaseConfig.threads || (navigation && !navigation.available)) {
    return <ThemedView style={styles.screen}><Stack.Screen options={{ title: 'Thread unavailable' }} /><EmptyState body="Thread unavailable or access changed." icon="forum-outline" title="Unavailable" /></ThemedView>;
  }

  return (
    <ThemedView style={styles.screen}>
      <Stack.Screen options={{ title: 'Threads' }} />
      <View style={[styles.tabs, { borderBottomColor: theme.hairline }]}>
        {(['active', 'archived'] as const).map((value) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: status === value }}
            key={value}
            onPress={() => { hapticLight(); setStatus(value); }}
            style={[styles.tab, { borderBottomColor: status === value ? theme.accent : 'transparent' }]}>
            <ThemedText type="title">{value === 'active' ? 'Active' : 'Archived'}</ThemedText>
          </Pressable>
        ))}
      </View>
      {sourceId ? <View style={[styles.sourceNotice, { backgroundColor: theme.backgroundElement }]}><ThemedText type="small">Starting from the selected Channel message.</ThemedText></View> : null}
      <TextInput
        accessibilityLabel="Search threads and replies"
        cursorColor={theme.accent}
        onChangeText={setSearchQuery}
        placeholder="Search threads and replies"
        placeholderTextColor={theme.textTertiary}
        selectionColor={theme.accent}
        selectionHandleColor={theme.accent}
        style={[styles.search, { borderColor: theme.hairline, color: theme.text }]}
        value={searchQuery}
      />
      {error ? <ThemedText accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]} type="small">{error}. Retry keeps the same request.</ThemedText> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={(searchActive ? searchResults : threads) === undefined
          ? <SkeletonList count={3} label={searchActive ? 'Searching' : 'Loading threads'} />
          : <EmptyState body={searchActive ? `No thread results for “${searchTerm}”.` : `No ${status} threads in this Channel.`} icon="forum-outline" title={searchActive ? 'No results' : 'No threads'} />}
        renderItem={({ item }) => (
          // The themed fill sits on a plain view: Android folds a ripple and a
          // background colour into one layered drawable whose repaint is lost,
          // so a colour set on the pressable itself survives a theme change.
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            <Pressable
              accessibilityHint={item.unread ? 'Unread followed thread' : undefined}
              android_ripple={{ color: theme.backgroundSelected }}
              onPress={() => pid && item.groupId && item.threadId && router.push(threadConversationHref(pid, item.groupId, item.threadId, context, item.messageId) as never)}
              style={styles.rowPressable}>
              <View style={styles.rowCopy}>
                <ThemedText numberOfLines={1} type="title">{item.title}</ThemedText>
                <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.subtitle}</ThemedText>
              </View>
              {item.unread ? (
                <View style={styles.unread}>
                  <PlatformIcon color={theme.accent} name="circle-outline" size={13} />
                  <ThemedText style={{ color: theme.accentStrong }} type="captionBold">Unread</ThemedText>
                </View>
              ) : (
                <PlatformIcon color={theme.textTertiary} name="chevron-right" size={18} />
              )}
            </Pressable>
          </View>
        )}
      />
      {!readOnly && status === 'active' && !searchActive ? (
        <View style={[styles.create, { borderTopColor: theme.hairline }]}>
          <TextInput
            accessibilityLabel="Thread name"
            cursorColor={theme.accent}
            maxLength={100}
            onChangeText={setName}
            placeholder="Thread name"
            placeholderTextColor={theme.textTertiary}
            selectionColor={theme.accent}
            selectionHandleColor={theme.accent}
            style={[styles.input, { borderColor: theme.hairline, color: theme.text }]}
            value={name}
          />
          <Pressable
            accessibilityRole="button"
            disabled={saving || !name.trim()}
            onPress={() => void submit()}
            style={[styles.createButton, { backgroundColor: theme.accent, opacity: saving || !name.trim() ? 0.5 : 1 }]}>
            <ThemedText style={styles.createButtonText} type="title">{saving ? 'Starting…' : 'Start thread'}</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  create: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: Spacing.two, padding: Spacing.three },
  createButton: { alignItems: 'center', borderRadius: Radius.medium, justifyContent: 'center', minHeight: TouchTarget, paddingHorizontal: Spacing.four },
  // Fixed light-theme stone: the accent is the same yellow in both themes.
  createButtonText: { color: Colors.light.text },
  error: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  input: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, flex: 1, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  list: { flexGrow: 1, gap: Spacing.two, padding: Spacing.three },
  row: { borderRadius: Radius.large, overflow: 'hidden' },
  rowCopy: { flex: 1, gap: 3, minWidth: 0 },
  rowPressable: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 64, padding: Spacing.three },
  search: { borderRadius: Radius.medium, borderWidth: StyleSheet.hairlineWidth, marginHorizontal: Spacing.three, marginTop: Spacing.three, minHeight: TouchTarget, paddingHorizontal: Spacing.three },
  screen: { flex: 1 },
  sourceNotice: { margin: Spacing.three, marginBottom: 0, padding: Spacing.three, borderRadius: Radius.large },
  tab: { alignItems: 'center', borderBottomWidth: 2, flex: 1, minHeight: TouchTarget, justifyContent: 'center' },
  tabs: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  unread: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
});
