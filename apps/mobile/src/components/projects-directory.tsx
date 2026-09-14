import type { FunctionReturnType } from 'convex/server';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '../../../../convex/_generated/api';
import type { Doc } from '../../../../convex/_generated/dataModel';
import { PlatformIcon } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hapticLight } from '@/lib/haptics';
import { projectRoleLabel } from '@/lib/role-label';

export type DirectoryProject = {
  project: Pick<Doc<'projects'>, '_id' | 'name'>;
  membership: Doc<'projectMembers'>;
  groupCount: number;
  unreadCount: number;
};

export type DirectoryChannel = FunctionReturnType<typeof api.mobile.listGroupsPage>['page'][number];

export function WorkspaceOverview({
  activeProjects,
  companyLabel,
  companyScoped,
  onPressCompany,
  visibleChannels,
}: {
  activeProjects: number;
  companyLabel: string;
  companyScoped: boolean;
  onPressCompany: () => void;
  visibleChannels: number;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.overview, { backgroundColor: theme.backgroundElevated }]}> 
      <Pressable
        accessibilityHint="Opens Company selection"
        accessibilityLabel={`Current scope: ${companyLabel}`}
        accessibilityRole="button"
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={() => { hapticLight(); onPressCompany(); }}
        style={({ pressed }) => [styles.identity, pressed && { backgroundColor: theme.backgroundElement }]}
      >
        <View style={[styles.identityMark, { backgroundColor: theme.text }]}>
          <ThemedText style={{ color: theme.background }} type="mono">{initials(companyLabel)}</ThemedText>
        </View>
        <View style={styles.identityCopy}>
          <ThemedText numberOfLines={1} type="subtitle">{companyLabel}</ThemedText>
          <ThemedText themeColor="textSecondary" type="caption">{companyScoped ? 'Company workspace' : 'All Company workspaces'}</ThemedText>
        </View>
        <PlatformIcon color={theme.textTertiary} name="chevron-down" size={16} />
      </Pressable>
      <View style={[styles.overviewDivider, { backgroundColor: theme.hairline }]} />
      <View style={styles.metrics}> 
        <Metric icon="project" label="Active Projects" value={activeProjects} />
        <View style={[styles.metricDivider, { backgroundColor: theme.hairline }]} />
        <Metric icon="channel" label="Visible Channels" value={visibleChannels} />
      </View>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: 'channel' | 'project'; label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: theme.backgroundElement }]}>
        <PlatformIcon color={theme.textSecondary} name={icon} size={16} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.metricValue}>{value}</ThemedText>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{label}</ThemedText>
      </View>
    </View>
  );
}

export function ProjectDirectoryCard({
  channels,
  expanded,
  item,
  loadingChannels,
  onOpenChannel,
  onOpenProject,
  onToggle,
}: {
  channels: DirectoryChannel[];
  expanded: boolean;
  item: DirectoryProject;
  loadingChannels: boolean;
  onOpenChannel: (channel: DirectoryChannel) => void;
  onOpenProject: () => void;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const archived = item.membership.status === 'archived';
  const role = archived ? 'Read-only archive' : projectRoleLabel(item.membership.role);
  return (
    <View style={[styles.card, { backgroundColor: archived ? theme.backgroundElement : theme.backgroundElevated, borderColor: theme.hairline }]}>
      <Pressable
        accessibilityHint={archived ? 'Opens this read-only Project archive' : expanded ? 'Collapses the Channel preview' : 'Expands the Channel preview'}
        accessibilityLabel={`${item.project.name}. ${role}. ${item.groupCount} Channels.${item.unreadCount ? ` ${item.unreadCount} unread.` : ''}`}
        accessibilityRole="button"
        accessibilityState={archived ? undefined : { expanded }}
        android_ripple={{ color: theme.backgroundSelected }}
        onPress={() => {
          hapticLight();
          if (archived) onOpenProject();
          else onToggle();
        }}
        style={styles.cardHeader}
      >
        <View style={styles.topline}>
          <View style={styles.roleLine}>
            <View style={[styles.projectGlyph, { backgroundColor: archived ? theme.backgroundSelected : theme.accentSoft }]}>
              <PlatformIcon color={archived ? theme.textSecondary : theme.accentStrong} name={archived ? 'archive' : 'project'} size={14} />
            </View>
            <ThemedText themeColor={archived ? 'textTertiary' : 'textSecondary'} type="captionBold">{role}</ThemedText>
          </View>
          {archived ? <PlatformIcon color={theme.textTertiary} name="archive" size={16} /> : item.unreadCount > 0 ? (
            <View style={[styles.unread, { backgroundColor: theme.accentSoft }]}>
              <ThemedText style={{ color: theme.accentStrong }} type="captionBold">{compact(item.unreadCount)} unread</ThemedText>
            </View>
          ) : <ThemedText themeColor="textTertiary" type="caption">All read</ThemedText>}
        </View>
        <View style={styles.titleRow}>
          <ThemedText numberOfLines={2} style={[styles.flex, archived && { color: theme.textSecondary }]} type="subtitle">{item.project.name}</ThemedText>
          {!archived ? <PlatformIcon color={theme.textSecondary} name={expanded ? 'chevron-up' : 'chevron-right'} size={17} /> : null}
        </View>
        <View style={styles.metaRow}>
          <PlatformIcon color={theme.textTertiary} name="channel" size={14} />
          <ThemedText themeColor="textSecondary" type="caption">{item.groupCount} {item.groupCount === 1 ? 'Channel' : 'Channels'}</ThemedText>
          {!expanded && item.membership.companyDisplayNameSnapshot ? <ThemedText numberOfLines={1} style={styles.companyMeta} themeColor="textSecondary" type="caption">{item.membership.companyDisplayNameSnapshot}</ThemedText> : null}
        </View>
      </Pressable>

      {expanded && !archived ? (
        <View style={[styles.channelList, { borderTopColor: theme.hairline }]}> 
          {loadingChannels ? <View accessibilityLabel="Loading Channels" style={[styles.channelSkeleton, { backgroundColor: theme.skeleton }]} /> : channels.length ? channels.map((channel) => (
            <ChannelRow channel={channel} key={channel.group._id} onPress={() => onOpenChannel(channel)} />
          )) : <ThemedText style={styles.emptyChannels} themeColor="textSecondary" type="caption">No Channels are visible for this membership.</ThemedText>}
          <Pressable accessibilityRole="button" onPress={onOpenProject} style={styles.openProject}>
            <ThemedText style={{ color: theme.accentStrong }} type="captionBold">Open Project</ThemedText>
            <PlatformIcon color={theme.accentStrong} name="chevron-right" size={15} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ChannelRow({ channel, onPress }: { channel: DirectoryChannel; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityLabel={`${channel.group.name}.${channel.unreadCount ? ` ${channel.unreadCount} unread.` : ''}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [styles.channel, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.channelIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.textSecondary} name="channel" size={16} /></View>
      <View style={styles.flex}>
        <View style={styles.channelTitle}><ThemedText numberOfLines={1} style={styles.flex} type="title">{channel.group.name}</ThemedText>{channel.unreadCount > 0 ? <View style={[styles.channelUnread, { backgroundColor: theme.accentSoft }]}><ThemedText style={{ color: theme.accentStrong }} type="captionBold">{compact(channel.unreadCount)}</ThemedText></View> : null}</View>
        <ThemedText numberOfLines={1} themeColor="textSecondary" type="caption">{channel.lastMessage?.body || 'No messages yet'}</ThemedText>
      </View>
    </Pressable>
  );
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ''}` : value.slice(0, 2)).toUpperCase();
}

function compact(value: number) { return value > 99 ? '99+' : String(value); }

const styles = StyleSheet.create({
  card: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, boxShadow: '0 2px 8px rgba(0,0,0,0.045)', overflow: 'hidden' }, cardHeader: { gap: Spacing.two, minHeight: 112, padding: Spacing.four },
  channel: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.small, flexDirection: 'row', gap: Spacing.three, minHeight: 60, paddingHorizontal: Spacing.two, paddingVertical: Spacing.two },
  channelIcon: { alignItems: 'center', borderRadius: Radius.small, height: 32, justifyContent: 'center', width: 32 },
  channelList: { borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.one, padding: Spacing.two }, channelSkeleton: { borderRadius: Radius.small, height: 60 },
  channelTitle: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, channelUnread: { borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  companyMeta: { flex: 1, marginLeft: Spacing.one, textAlign: 'right' }, emptyChannels: { minHeight: 52, padding: Spacing.two }, flex: { flex: 1, minWidth: 0 },
  identity: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.large, flexDirection: 'row', gap: Spacing.three, minHeight: 64, padding: Spacing.four }, identityCopy: { flex: 1, gap: 2, minWidth: 0 },
  identityMark: { alignItems: 'center', borderRadius: Radius.medium, height: 36, justifyContent: 'center', width: 36 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one }, metric: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two, minWidth: 0 },
  metricDivider: { width: StyleSheet.hairlineWidth }, metricIcon: { alignItems: 'center', borderRadius: Radius.small, height: 28, justifyContent: 'center', width: 28 }, metricValue: { fontSize: 22, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 27 },
  metrics: { flexDirection: 'row', gap: Spacing.four, padding: Spacing.four, paddingTop: Spacing.three }, openProject: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one, justifyContent: 'center', minHeight: TouchTarget },
  overview: { borderCurve: 'continuous', borderRadius: Radius.large, boxShadow: '0 2px 10px rgba(0,0,0,0.045)', overflow: 'hidden' }, overviewDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: Spacing.four },
  projectGlyph: { alignItems: 'center', borderRadius: Radius.small, height: 28, justifyContent: 'center', width: 28 }, roleLine: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: Spacing.two }, titleRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  topline: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' }, unread: { borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
});
