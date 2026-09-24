import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AssistantMark } from '@/components/chat/assistant-mark';
import { ColoredAvatar } from '@/components/colored-avatar';
import { PlatformIcon, type IconName } from '@/components/platform-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { attentionAction, attentionContext, attentionTitle, relativeAttentionTime, type MobileAttentionItem } from '@/lib/mobile-attention';

export function ProjectHero({ archived, company, description, memberCount, name, onBack, role }: { archived: boolean; company: string; description?: string; memberCount?: number | string; name: string; onBack: () => void; role: string }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  const statusColor = archived ? theme.textTertiary : theme.success;
  return <View style={styles.hero}>
    <View style={[styles.heroTopline, largeText && styles.heroToplineLarge]}>
      <Pressable accessibilityLabel="Back to Projects" accessibilityRole="button" hitSlop={8} onPress={onBack} style={styles.backLink}><PlatformIcon color={theme.textSecondary} name="chevron-left" size={15} /><ThemedText themeColor="textSecondary" type="caption">Projects</ThemedText></Pressable>
      <View style={styles.statusLine}><ThemedText style={{ color: statusColor }} type="captionBold">{role}</ThemedText><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><ThemedText style={{ color: statusColor }} type="caption">{archived ? 'Archived' : 'Active'}</ThemedText>{memberCount !== undefined ? <><View style={[styles.statusDot, { backgroundColor: theme.hairline }]} /><ThemedText themeColor="textSecondary" type="caption">{memberCount} {memberCount === 1 || memberCount === '1' ? 'member' : 'members'}</ThemedText></> : null}</View>
    </View>
    <View style={styles.companyLine}><PlatformIcon color={theme.textTertiary} name="office-building" size={12} /><ThemedText numberOfLines={largeText ? undefined : 1} style={styles.company} themeColor="textSecondary" type="captionBold">{company}</ThemedText></View>
    <ThemedText numberOfLines={largeText ? undefined : 2} type="titleLarge">{name}</ThemedText>
    <ThemedText numberOfLines={largeText ? undefined : 3} themeColor="textSecondary" type="caption">{description || 'Conversation, tasks, and references for this Project.'}</ThemedText>
  </View>;
}

export function ProjectMetrics({ channels, people, tasks, tasksEnabled, unread }: { channels: number; people: number | string; tasks: number; tasksEnabled: boolean; unread: number }) {
  const largeText = useWindowDimensions().fontScale > 1.2;
  return <View style={[styles.metrics, largeText && styles.metricsLarge]}>
    <Metric detail={`${unread} unread`} emphasis={unread > 0} label="Channels" value={channels} />
    {tasksEnabled ? <Metric detail="open" label="Tasks" value={tasks} /> : null}
    <Metric detail="collabs" label="People" value={people} />
  </View>;
}

export function ProjectProgress({ completed, latestUpdate, total }: { completed: number; latestUpdate?: string; total: number }) {
  const theme = useTheme();
  const percent = total ? Math.round((completed / total) * 100) : 0;
  return <View style={[styles.progress, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
    <View style={styles.progressHeading}>
      <View>
        <ThemedText type="title">Project progress</ThemedText>
        <ThemedText themeColor="textSecondary" type="caption">{completed} of {total} tasks complete</ThemedText>
      </View>
      <ThemedText style={styles.progressValue} type="subtitle">{percent}%</ThemedText>
    </View>
    <View accessibilityLabel={`${percent} percent complete`} accessibilityRole="progressbar" accessibilityValue={{ max: 100, min: 0, now: percent }} style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${percent}%` }]} />
    </View>
    {latestUpdate ? <View style={styles.latestUpdate}><PlatformIcon color={theme.textTertiary} name="clock-outline" size={15} /><ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{latestUpdate}</ThemedText></View> : null}
  </View>;
}

function Metric({ detail, emphasis, label, value }: { detail: string; emphasis?: boolean; label: string; value: number | string }) {
  const theme = useTheme();
  return <View style={[styles.metric, { backgroundColor: theme.homeSurface }]}><ThemedText style={styles.metricLabel} themeColor="textSecondary" type="captionBold">{label}</ThemedText><View style={styles.metricResult}><ThemedText style={styles.metricValue}>{value}</ThemedText><ThemedText numberOfLines={1} themeColor={emphasis ? 'accentStrong' : 'textSecondary'} type="caption">{detail}</ThemedText></View></View>;
}

export function ProjectWorkHub({ channelCount, dueSoonCount, evidenceCount, onBoard, onChannels, onEvidence, onTasks, openTaskCount, tasksEnabled, unreadCount }: { channelCount: number; dueSoonCount: number; evidenceCount: number | string; onBoard: () => void; onChannels: () => void; onEvidence: () => void; onTasks: () => void; openTaskCount: number; tasksEnabled: boolean; unreadCount: number }) {
  const theme = useTheme();
  return <View>
    <SectionHeading title="Continue working" />
    <View style={[styles.hub, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder }]}>
      <HubRow detail={`${channelCount} ${channelCount === 1 ? 'Channel' : 'Channels'}${unreadCount ? ` \u00b7 ${unreadCount} unread` : ''}`} icon="channel" label="Channels" onPress={onChannels} />
      <HubDivider />
      {tasksEnabled ? <><HubRow detail={`${openTaskCount} open ${openTaskCount === 1 ? 'task' : 'tasks'}${dueSoonCount ? ` \u00b7 ${dueSoonCount} due in 7 days` : ''}`} icon="task" label="Tasks" onPress={onTasks} /><HubDivider /></> : null}
      {tasksEnabled ? <><HubRow detail="Move work through Project statuses" icon="view-board" label="Board" onPress={onBoard} /><HubDivider /></> : null}
      <HubRow detail={`${evidenceCount} linked references`} icon="evidence" label="Evidence" onPress={onEvidence} />
    </View>
  </View>;
}

function HubDivider() {
  const theme = useTheme();
  return <View style={[styles.hubDivider, { backgroundColor: theme.hairline }]} />;
}

function HubRow({ detail, icon, label, onPress }: { detail: string; icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityLabel={`${label}. ${detail}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.hubRow, pressed && { backgroundColor: theme.backgroundElement }]}>
    <View style={[styles.hubIcon, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.text} name={icon} size={17} /></View>
    <View style={styles.flex}><ThemedText type="title">{label}</ThemedText><ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{detail}</ThemedText></View>
    <PlatformIcon color={theme.textTertiary} name="chevron-right" size={16} />
  </Pressable>;
}

export function ProjectAttention({ items, onOpen }: { items: MobileAttentionItem[]; onOpen: (item: MobileAttentionItem) => void }) {
  const theme = useTheme();
  return <View style={styles.attentionSection}>
    <SectionHeading title="Your attention" />
    {items.length ? items.map((item) => <AttentionCard item={item} key={`${item.kind}:${item.id}`} onPress={() => onOpen(item)} />) : <View style={[styles.clearState, { backgroundColor: theme.backgroundElement }]}><PlatformIcon color={theme.success} name="check-circle" size={17} /><ThemedText themeColor="textSecondary" type="caption">Nothing else needs your attention in this Project.</ThemedText></View>}
  </View>;
}

function AttentionCard({ item, onPress }: { item: MobileAttentionItem; onPress: () => void }) {
  const theme = useTheme();
  const largeText = useWindowDimensions().fontScale > 1.2;
  const task = item.kind === 'task';
  const suggestion = item.kind === 'suggestion';
  const message = item.kind === 'message';
  const urgent = task && (item.eventType === 'overdue' || item.eventType === 'due_soon');
  const identity = message ? `${item.senderName} in #${item.groupName}` : task ? item.taskKey : suggestion ? 'Track assistant' : item.companyName;
  const attentionTone = urgent
    ? theme.danger
    : suggestion
      ? theme.accent
      : message
        ? item.eventType === 'mention' ? theme.workflowBacklog : theme.info
        : theme.hairline;
  const actionLabel = suggestion ? 'Review & Create' : task ? 'View Task' : message ? item.threadId ? 'Reply in thread' : 'Open Channel' : 'Review invitation';
  return <View style={[styles.attentionSurface, { backgroundColor: theme.homeSurface, borderColor: theme.homeBorder, borderLeftColor: attentionTone }]}>
    <Pressable accessibilityLabel={`${attentionTitle(item)}. ${attentionAction(item)}. ${attentionContext(item)}`} accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} onPress={onPress} style={({ pressed }) => [styles.attentionCard, pressed && { backgroundColor: theme.backgroundElement }]}>
    <View style={styles.attentionTopline}>
      <View style={styles.attentionIdentity}>{suggestion ? <AssistantMark size={24} /> : message ? <ColoredAvatar label={item.senderName} seed={item.senderName} size={24} /> : <View style={[styles.attentionIcon, { backgroundColor: urgent ? theme.dangerSoft : theme.backgroundElement }]}><PlatformIcon color={urgent ? theme.danger : theme.textSecondary} name="check-circle" size={14} /></View>}<ThemedText numberOfLines={1} style={styles.flex} themeColor="textSecondary" type="captionBold">{identity}</ThemedText></View>
      <ThemedText themeColor={urgent ? 'danger' : 'textTertiary'} type="caption">{relativeAttentionTime(item.createdAt)}</ThemedText>
    </View>
    {message ? <ThemedText numberOfLines={3} type="caption">{item.preview}</ThemedText> : <><ThemedText numberOfLines={2} type="title">{attentionTitle(item)}</ThemedText>{suggestion || item.kind === 'invitation' ? <ThemedText numberOfLines={2} themeColor="textSecondary" type="caption">{item.preview}</ThemedText> : null}</>}
    <View style={[styles.attentionFooter, largeText && styles.attentionFooterLarge]}><ThemedText style={styles.flex} themeColor="textTertiary" type="caption">{attentionAction(item)}</ThemedText><View style={[styles.inlineAction, { backgroundColor: suggestion ? theme.accent : theme.backgroundElement }]}><ThemedText style={suggestion ? styles.actionInk : { color: theme.text }} type="captionBold">{actionLabel}</ThemedText></View></View>
    </Pressable>
  </View>;
}

function SectionHeading({ title }: { title: string }) {
  return <View style={styles.sectionHeading}><ThemedText style={styles.sectionTitle} type="subtitle">{title}</ThemedText></View>;
}

const styles = StyleSheet.create({
  actionInk: { color: '#1b1917' }, attentionCard: { gap: Spacing.two, padding: Spacing.three }, attentionFooter: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'space-between' }, attentionFooterLarge: { alignItems: 'flex-start', flexDirection: 'column' }, attentionIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 24, justifyContent: 'center', width: 24 }, attentionIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: Spacing.two, minWidth: 0 }, attentionSection: { gap: Spacing.two }, attentionSurface: { borderCurve: 'continuous', borderLeftWidth: 3, borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }, attentionTopline: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  backLink: { alignItems: 'center', flexDirection: 'row', minHeight: TouchTarget }, clearState: { alignItems: 'center', borderCurve: 'continuous', borderRadius: Radius.medium, flexDirection: 'row', gap: Spacing.two, minHeight: 52, padding: Spacing.three }, company: { textTransform: 'uppercase' }, companyLine: { alignItems: 'center', flexDirection: 'row', gap: 6 }, flex: { flex: 1, minWidth: 0 },
  hero: { gap: Spacing.one }, heroTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, heroToplineLarge: { alignItems: 'flex-start', flexDirection: 'column' },
  hub: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' }, hubDivider: { height: StyleSheet.hairlineWidth, marginLeft: 68 }, hubIcon: { alignItems: 'center', borderRadius: Radius.medium, height: 40, justifyContent: 'center', width: 40 }, hubRow: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three, minHeight: 76, overflow: 'hidden', padding: Spacing.four }, inlineAction: { borderRadius: Radius.small, minHeight: 30, paddingHorizontal: Spacing.two, paddingVertical: 7 },
  metric: { borderCurve: 'continuous', borderRadius: Radius.medium, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', flex: 1, gap: 2, minWidth: 0, padding: Spacing.three }, metricLabel: { fontSize: 10, lineHeight: 14, textTransform: 'uppercase' }, metricResult: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one }, metrics: { flexDirection: 'row', gap: Spacing.three }, metricsLarge: { flexDirection: 'column' }, metricValue: { fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '700', lineHeight: 22 }, sectionHeading: { marginBottom: Spacing.three, marginTop: Spacing.two }, sectionTitle: { letterSpacing: -0.15 }, statusDot: { borderRadius: Radius.pill, height: 6, width: 6 }, statusLine: { alignItems: 'center', flexDirection: 'row', gap: Spacing.one },
  latestUpdate: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two }, progress: { borderCurve: 'continuous', borderRadius: Radius.large, borderWidth: StyleSheet.hairlineWidth, gap: Spacing.three, padding: Spacing.four }, progressFill: { borderRadius: Radius.pill, bottom: 0, left: 0, position: 'absolute', top: 0 }, progressHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, progressTrack: { borderRadius: Radius.pill, height: 8, overflow: 'hidden' }, progressValue: { fontVariant: ['tabular-nums'] },
});
